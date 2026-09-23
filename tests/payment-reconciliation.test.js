import {test} from 'node:test';
import assert from 'node:assert/strict';
import {reconcilePendingPayments} from '../server/payment-reconciliation.js';

test('reconciliation applies terminal Opn states and tolerates individual lookup failures',async()=>{
  const applied=[];
  const repo={
    listPendingOpnPayments:async()=>[{reference:'chrg_test_paid'},{reference:'chrg_test_pending'},{reference:'chrg_test_error'}],
    applyOpnEvent:async(_tenant,event)=>applied.push(event),
  };
  const provider={getCharge:async id=>{if(id.endsWith('error'))throw new Error('network');return {id,status:id.endsWith('paid')?'successful':'pending'};}};
  const result=await reconcilePendingPayments({repo,tenantId:'tenant',provider,logger:{error(){}}});
  assert.deepEqual(result,{checked:3,settled:1,errors:1});
  assert.equal(applied.length,1);
  assert.equal(applied[0].id,'reconcile:chrg_test_paid:successful');
});
