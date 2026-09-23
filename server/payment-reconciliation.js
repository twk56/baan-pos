import {OpnPaymentProvider} from './opn-payment-adapter.js';

const terminal=new Set(['successful','failed','expired']);

export async function reconcilePendingPayments({repo,tenantId,provider=new OpnPaymentProvider(),limit=50,logger=console}){
  const pending=await repo.listPendingOpnPayments(tenantId,limit);
  const result={checked:pending.length,settled:0,errors:0};
  for(const payment of pending){
    try{
      const charge=await provider.getCharge(payment.reference);
      if(!terminal.has(charge.status))continue;
      await repo.applyOpnEvent(tenantId,{id:`reconcile:${charge.id}:${charge.status}`,key:'charge.complete',data:charge});
      result.settled++;
    }catch(error){result.errors++;logger.error?.(JSON.stringify({level:'error',event:'payment_reconciliation_failed',charge_id:payment.reference,error:error.message}));}
  }
  return result;
}

export function startPaymentReconciliation(options){
  const intervalMs=Math.max(60_000,Number(process.env.PAYMENT_RECONCILE_INTERVAL_MS||300_000));
  const run=()=>reconcilePendingPayments(options).then(result=>options.logger?.info?.(JSON.stringify({level:'info',event:'payment_reconciliation',...result}))).catch(error=>options.logger?.error?.(JSON.stringify({level:'error',event:'payment_reconciliation_crashed',error:error.message})));
  const first=setTimeout(run,30_000);first.unref();
  const timer=setInterval(run,intervalMs);timer.unref();
  return ()=>{clearTimeout(first);clearInterval(timer);};
}
