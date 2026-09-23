// Provider-neutral production payment boundary. Implement a verified provider webhook before enabling paid mode.
export class PaymentProvider {
  constructor(config={}) { this.config=config; }
  async createPayment() { throw new Error('PAYMENT_PROVIDER_NOT_CONFIGURED'); }
  async verifyWebhook() { throw new Error('PAYMENT_PROVIDER_NOT_CONFIGURED'); }
  async reconcile() { throw new Error('PAYMENT_PROVIDER_NOT_CONFIGURED'); }
}
export function paymentMode(){ return process.env.PAYMENT_MODE || 'simulation'; }
