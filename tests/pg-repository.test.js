import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {PgRepository} from '../server/pg-repository.js';
const url=process.env.DATABASE_URL;
const repo=url?new PgRepository(url):null;
after(async()=>{if(repo)await repo.close();});
test('postgres repository transaction and tenant isolation',async t=>{
  if(!repo){t.skip('DATABASE_URL not configured');return;}
  const tenants=(await repo.pool.query('SELECT id FROM tenants ORDER BY created_at LIMIT 2')).rows;assert.ok(tenants.length>=2);
  const products=await repo.listProducts(tenants[0].id);assert.equal(Array.isArray(products),true);
  const reports=await repo.reports(tenants[0].id,'2020-01-01','2099-12-31');assert.equal(Array.isArray(reports.payments),true);
  const cross=await repo.withTenant(tenants[0].id,async client=>(await client.query('SELECT count(*)::int count FROM tenant_products WHERE tenant_id=$1',[tenants[1].id])).rows[0].count);assert.equal(Number(cross),0);
});

test('failed and expired PromptPay events cancel once and restore reserved stock',async t=>{
  if(!repo){t.skip('DATABASE_URL not configured');return;}
  const tenantId=randomUUID();
  await repo.pool.query('INSERT INTO tenants(id,name,slug) VALUES($1,$2,$3)',[tenantId,'Payment E2E',`payment-${tenantId}`]);
  try{
    await repo.withTenant(tenantId,async c=>{
      await c.query("INSERT INTO tenant_users(tenant_id,user_id,name,email,password_hash,role) VALUES($1,1,'Test','test@example.com','unused','admin')",[tenantId]);
      const category=(await c.query("INSERT INTO tenant_categories(tenant_id,name) VALUES($1,'Test') RETURNING id",[tenantId])).rows[0];
      await c.query("INSERT INTO tenant_products(tenant_id,category_id,sku,name,cost_price,sale_price,stock_qty,min_stock) VALUES($1,$2,'SKU-1','Test product',100,200,10,1)",[tenantId,category.id]);
    });
    for(const [index,status] of ['failed','expired'].entries()){
      const product=(await repo.listProducts(tenantId))[0];
      const order=await repo.createOrder(tenantId,{cashierId:1,items:[{productId:product.id,quantity:2,expectedPrice:200}],method:'promptpay',paymentStatus:'pending',requestKey:randomUUID()});
      const reference=`chrg_test_${status}`;await repo.linkPaymentReference(tenantId,order.id,reference);
      assert.equal(Number((await repo.listProducts(tenantId))[0].stock_qty),8);
      const event={id:`evnt_${status}`,key:'charge.complete',data:{id:reference,status}};
      const first=await repo.applyOpnEvent(tenantId,event);const duplicate=await repo.applyOpnEvent(tenantId,event);
      const detail=await repo.getOrder(tenantId,order.id);
      assert.equal(first.status,status);assert.equal(duplicate.duplicate,true);assert.equal(detail.order_status,'cancelled');assert.equal(detail.payment_status,status);
      assert.equal(Number((await repo.listProducts(tenantId))[0].stock_qty),10);
    }
  }finally{
    await repo.withTenant(tenantId,async c=>{for(const table of ['tenant_payment_events','tenant_stock_movements','tenant_payments','tenant_order_items','tenant_orders','tenant_products','tenant_categories','tenant_sessions','tenant_users','tenant_settings'])await c.query(`DELETE FROM ${table}`);});
    await repo.pool.query('DELETE FROM tenants WHERE id=$1',[tenantId]);
  }
});
