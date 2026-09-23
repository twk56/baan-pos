// Provider-neutral production payment boundary. Implement a verified provider webhook before enabling paid mode.
export class PaymentProvider {
  constructor(config={}) { this.config=config; }
  async createPayment() { throw new Error('PAYMENT_PROVIDER_NOT_CONFIGURED'); }
  async verifyWebhook() { throw new Error('PAYMENT_PROVIDER_NOT_CONFIGURED'); }
  async reconcile() { throw new Error('PAYMENT_PROVIDER_NOT_CONFIGURED'); }
}
import {createHmac,timingSafeEqual} from 'node:crypto';
export function verifyHmacWebhook(rawBody,signature,secret,timestamp){if(!secret||!signature||!timestamp)return false;const expected=createHmac('sha256',Buffer.from(secret,'base64')).update(`${timestamp}.${rawBody.toString('utf8')}`).digest('hex');return String(signature).split(',').some(value=>{const a=Buffer.from(expected,'hex');const b=Buffer.from(value.trim(),'hex');return a.length===b.length&&timingSafeEqual(a,b);});}
export function paymentMode(){ return process.env.PAYMENT_MODE || 'simulation'; }
