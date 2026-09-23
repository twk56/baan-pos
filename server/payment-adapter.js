// Provider-neutral production payment boundary. Implement a verified provider webhook before enabling paid mode.
export class PaymentProvider {
  constructor(config={}) { this.config=config; }
  async createPayment() { throw new Error('PAYMENT_PROVIDER_NOT_CONFIGURED'); }
  async verifyWebhook() { throw new Error('PAYMENT_PROVIDER_NOT_CONFIGURED'); }
  async reconcile() { throw new Error('PAYMENT_PROVIDER_NOT_CONFIGURED'); }
}
import {createHmac,timingSafeEqual} from 'node:crypto';
export function verifyHmacWebhook(rawBody,signature,secret){if(!secret||!signature)return false;const expected=createHmac('sha256',secret).update(rawBody).digest('hex');const a=Buffer.from(expected);const b=Buffer.from(String(signature));return a.length===b.length&&timingSafeEqual(a,b);}
export function paymentMode(){ return process.env.PAYMENT_MODE || 'simulation'; }
