import {z} from 'zod';
import {OpnPaymentProvider} from '../opn-payment-adapter.js';
import {verifyHmacWebhook} from '../payment-adapter.js';

const parse=(schema,body)=>schema.parse(body);
const ok=(res,data)=>res.json({data});

export function registerPublicPaymentRoutes(app,{pgRepo,pgTenant,pgMode}){
  app.post('/api/payments/webhook',async(req,res,next)=>{try{
    if(process.env.PAYMENT_MODE!=='production')return res.status(503).json({code:'PAYMENT_PROVIDER_NOT_CONFIGURED'});
    const signature=req.headers['omise-signature']||req.headers['x-opn-signature']||req.headers['x-omise-signature'];
    const timestamp=req.headers['omise-signature-timestamp'];
    if(process.env.OPN_WEBHOOK_SECRET&&!verifyHmacWebhook(req.rawBody||Buffer.from(JSON.stringify(req.body)),signature,process.env.OPN_WEBHOOK_SECRET,timestamp))return res.status(401).json({code:'INVALID_WEBHOOK_SIGNATURE'});
    if(!pgMode())return res.status(503).json({code:'PG_NOT_CONFIGURED'});
    ok(res,await pgRepo.applyOpnEvent(pgTenant,req.body));
  }catch(error){next(error);}});
}

export function registerAuthenticatedPaymentRoutes(app,{pgRepo,pgTenant,pgMode}){
  app.post('/api/payments/opn/charge',async(req,res,next)=>{try{
    if(!pgMode())return res.status(503).json({code:'PG_NOT_CONFIGURED'});
    const p=parse(z.object({amount:z.number().int().positive(),source:z.string().min(3),description:z.string().max(160).optional(),order_id:z.coerce.number().int().positive().optional()}),req.body);
    const charge=await new OpnPaymentProvider().createCharge({amount:p.amount,currency:'thb',source:p.source,description:p.description||`Baan POS order ${p.order_id||''}`});
    if(p.order_id)await pgRepo.linkPaymentReference(pgTenant,p.order_id,charge.id);
    ok(res,{id:charge.id,status:charge.status,expires_at:charge.expires_at||null,authorize_uri:charge.authorize_uri||null,scannable_code:charge.scannable_code||charge.source?.scannable_code||null});
  }catch(error){next(error);}});
  app.post('/api/payments/opn/promptpay/source',async(req,res,next)=>{try{
    const p=parse(z.object({amount:z.number().int().positive()}),req.body);
    const source=await new OpnPaymentProvider().createPromptPaySource(p.amount);
    ok(res,{id:source.id,type:source.type,amount:source.amount,currency:source.currency});
  }catch(error){next(error);}});
  app.get('/api/payments/opn/charge/:id',async(req,res,next)=>{try{
    const id=z.string().regex(/^chrg_(test|live)_/).parse(req.params.id);
    const charge=await new OpnPaymentProvider().getCharge(id);
    ok(res,{id:charge.id,status:charge.status,paid:charge.paid,expired:charge.expired,expires_at:charge.expires_at});
  }catch(error){next(error);}});
  app.get('/api/payments/opn/config',(req,res)=>ok(res,{provider:'opn',public_key:process.env.OPN_PUBLIC_KEY||'',mode:process.env.PAYMENT_MODE||'simulation'}));
}
