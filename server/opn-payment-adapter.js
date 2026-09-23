const API='https://api.omise.co';
export class OpnPaymentProvider {
  constructor({secretKey=process.env.OPN_SECRET_KEY,apiBase=API}={}){this.secretKey=secretKey;this.apiBase=apiBase;}
  async createCharge({amount,currency='thb',source,description,metadata={}}){if(!this.secretKey)throw new Error('OPN_SECRET_KEY_REQUIRED');const body=new URLSearchParams({amount:String(amount),currency,description:description||'',...Object.fromEntries(Object.entries(metadata).map(([k,v])=>[`metadata[${k}]`,String(v)]))});if(source)body.set('source',source);const r=await fetch(`${this.apiBase}/charges`,{method:'POST',headers:{Authorization:`Basic ${Buffer.from(`${this.secretKey}:`).toString('base64')}`,'Content-Type':'application/x-www-form-urlencoded'},body});if(!r.ok)throw new Error(`OPN_CHARGE_FAILED_${r.status}`);return r.json();}
}
