import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHmac,randomBytes} from 'node:crypto';
import {verifyHmacWebhook} from '../server/payment-adapter.js';

test('verifies Opn timestamped HMAC and rejects altered payload',()=>{
  const secret=randomBytes(32).toString('base64');
  const timestamp=String(Math.floor(Date.now()/1000));
  const body=Buffer.from(JSON.stringify({id:'evnt_test_1',key:'charge.complete'}));
  const signature=createHmac('sha256',Buffer.from(secret,'base64')).update(`${timestamp}.${body.toString('utf8')}`).digest('hex');
  assert.equal(verifyHmacWebhook(body,signature,secret,timestamp),true);
  assert.equal(verifyHmacWebhook(Buffer.from('{}'),signature,secret,timestamp),false);
  assert.equal(verifyHmacWebhook(body,`${'0'.repeat(64)},${signature}`,secret,timestamp),true);
  assert.equal(verifyHmacWebhook(body,signature,secret,'1'),false);
});
