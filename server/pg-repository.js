import pg from 'pg';
import {randomUUID} from 'node:crypto';

export class PgRepository {
  constructor(connectionString=process.env.DATABASE_URL){
    if(!connectionString) throw new Error('DATABASE_URL is required for PostgreSQL mode');
    this.pool=new pg.Pool({connectionString,max:10,connectionTimeoutMillis:5000,idleTimeoutMillis:30000});
  }
  async close(){await this.pool.end();}
  async withTenant(tenantId,work){
    const client=await this.pool.connect();
    try { await client.query('BEGIN'); await client.query("SELECT set_config('app.tenant_id',$1,true)",[tenantId]); const value=await work(client); await client.query('COMMIT'); return value; }
    catch(error){try{await client.query('ROLLBACK');}catch{} throw error;} finally{client.release();}
  }
  async health(){const result=await this.pool.query('SELECT 1 AS ok');return result.rows[0].ok===1;}
  async listProducts(tenantId){return this.withTenant(tenantId,async client=>(await client.query('SELECT p.*,c.name category_name FROM tenant_products p LEFT JOIN tenant_categories c ON c.tenant_id=p.tenant_id AND c.id=p.category_id WHERE p.tenant_id=current_setting(\'app.tenant_id\')::uuid ORDER BY p.id')).rows);}
  async createTenant(name,slug){const result=await this.pool.query('INSERT INTO tenants(name,slug) VALUES($1,$2) RETURNING *',[name,slug]);return result.rows[0];}
  async createOrder(tenantId,{cashierId,customerId=null,items,discount=0,taxRate=7,method='cash',tendered=0,requestKey=randomUUID()}){
    return this.withTenant(tenantId,async client=>{
      const duplicate=await client.query('SELECT * FROM tenant_orders WHERE request_key=$1',[requestKey]); if(duplicate.rowCount)return duplicate.rows[0];
      const ids=items.map(item=>item.productId); const products=(await client.query('SELECT * FROM tenant_products WHERE id=ANY($1::bigint[]) AND status=\'active\' FOR UPDATE',[ids])).rows;
      if(products.length!==items.length)throw new Error('PRODUCT_NOT_AVAILABLE');
      const byId=new Map(products.map(p=>[String(p.id),p])); let subtotal=0;
      for(const item of items){const product=byId.get(String(item.productId));if(!product||product.stock_qty<item.quantity)throw new Error('INSUFFICIENT_STOCK');if(Number(product.sale_price)!==Number(item.expectedPrice))throw new Error('PRICE_CHANGED');subtotal+=Number(product.sale_price)*item.quantity;}
      if(discount>subtotal)throw new Error('INVALID_DISCOUNT'); const tax=Math.round((subtotal-discount)*taxRate/100);const total=subtotal-discount+tax;
      if(method==='cash'&&tendered<total)throw new Error('INSUFFICIENT_PAYMENT');
      const order=(await client.query('INSERT INTO tenant_orders(tenant_id,order_no,cashier_id,customer_id,subtotal,discount,tax,total,payment_status,order_status,request_key) VALUES(current_setting(\'app.tenant_id\')::uuid,$1,$2,$3,$4,$5,$6,$7,$8,\'completed\',$9) RETURNING *',[`BN-${Date.now()}-${randomUUID().slice(0,8).toUpperCase()}`,cashierId,customerId,subtotal,discount,tax,total,'paid',requestKey])).rows[0];
      for(const item of items){const product=byId.get(String(item.productId));await client.query('INSERT INTO tenant_order_items(tenant_id,order_id,product_id,name,quantity,unit_price,cost_price,line_total) VALUES(current_setting(\'app.tenant_id\')::uuid,$1,$2,$3,$4,$5,$6,$7)',[order.id,product.id,product.name,item.quantity,product.sale_price,product.cost_price,product.sale_price*item.quantity]);await client.query('UPDATE tenant_products SET stock_qty=stock_qty-$1,updated_at=now() WHERE tenant_id=current_setting(\'app.tenant_id\')::uuid AND id=$2',[item.quantity,product.id]);await client.query('INSERT INTO tenant_stock_movements(tenant_id,product_id,type,quantity,reference_id,note,created_by) VALUES(current_setting(\'app.tenant_id\')::uuid,$1,\'sale\',$2,$3,\'ขายสินค้า\',$4)',[product.id,-item.quantity,order.id,cashierId]);}
      await client.query('INSERT INTO tenant_payments(tenant_id,order_id,method,amount,tendered,status,reference) VALUES(current_setting(\'app.tenant_id\')::uuid,$1,$2,$3,$4,\'paid\',$5)',[order.id,method,total,tendered,method==='transfer'?'PROVIDER_PENDING':'CASH']);
      return order;
    });
  }
}
