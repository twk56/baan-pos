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
  async authenticate(tenantId,email,password){const bcrypt=await import('bcryptjs');const result=await this.pool.query("SELECT * FROM tenant_users WHERE tenant_id=$1 AND lower(email)=lower($2) AND status='active'",[tenantId,email]);const user=result.rows[0];if(!user||!(await bcrypt.compare(password,user.password_hash)))return null;return {id:user.user_id,name:user.name,email:user.email,role:user.role};}
  async createSession(tenantId,userId,tokenHash){const expires=new Date(Date.now()+8*3600000);await this.pool.query('INSERT INTO tenant_sessions(tenant_id,token_hash,user_id,expires) VALUES($1,$2,$3,$4) ON CONFLICT(token_hash) DO UPDATE SET expires=EXCLUDED.expires',[tenantId,tokenHash,userId,expires]);return expires;}
  async authSession(tenantId,tokenHash){const result=await this.pool.query("SELECT u.user_id id,u.name,u.email,u.role FROM tenant_sessions s JOIN tenant_users u ON u.tenant_id=s.tenant_id AND u.user_id=s.user_id WHERE s.tenant_id=$1 AND s.token_hash=$2 AND s.expires>now() AND u.status='active'",[tenantId,tokenHash]);return result.rows[0]||null;}
  async revokeSession(tokenHash){await this.pool.query('DELETE FROM tenant_sessions WHERE token_hash=$1',[tokenHash]);}
  async listProducts(tenantId){return this.withTenant(tenantId,async client=>(await client.query('SELECT p.*,c.name category_name FROM tenant_products p LEFT JOIN tenant_categories c ON c.tenant_id=p.tenant_id AND c.id=p.category_id WHERE p.tenant_id=current_setting(\'app.tenant_id\')::uuid ORDER BY p.id')).rows);}
  async listCategories(tenantId){return this.withTenant(tenantId,async client=>(await client.query('SELECT * FROM tenant_categories WHERE tenant_id=current_setting(\'app.tenant_id\')::uuid ORDER BY id')).rows);}
  async createCategory(tenantId,{name}){return this.withTenant(tenantId,async client=>(await client.query('INSERT INTO tenant_categories(tenant_id,name) VALUES(current_setting(\'app.tenant_id\')::uuid,$1) RETURNING *',[name])).rows[0]);}
  async listCustomers(tenantId){return this.withTenant(tenantId,async client=>(await client.query('SELECT * FROM tenant_customers WHERE tenant_id=current_setting(\'app.tenant_id\')::uuid ORDER BY id DESC')).rows);}
  async createCustomer(tenantId,{name,phone='',email=''}){return this.withTenant(tenantId,async client=>(await client.query('INSERT INTO tenant_customers(tenant_id,name,phone,email) VALUES(current_setting(\'app.tenant_id\')::uuid,$1,$2,$3) RETURNING *',[name,phone,email])).rows[0]);}
  async listOrders(tenantId){return this.withTenant(tenantId,async client=>(await client.query('SELECT * FROM tenant_orders WHERE tenant_id=current_setting(\'app.tenant_id\')::uuid ORDER BY created_at DESC LIMIT 1000')).rows);}
  async inventory(tenantId){return this.withTenant(tenantId,async client=>(await client.query('SELECT * FROM tenant_products WHERE tenant_id=current_setting(\'app.tenant_id\')::uuid ORDER BY stock_qty ASC')).rows);}
  async saveProduct(tenantId,input){return this.withTenant(tenantId,async client=>{const values=[input.categoryId,input.sku,input.barcode||null,input.name,input.costPrice,input.salePrice,input.stockQty||0,input.minStock||5,input.imageUrl||'📦',input.status||'active'];if(input.id){const result=await client.query('UPDATE tenant_products SET category_id=$1,sku=$2,barcode=$3,name=$4,cost_price=$5,sale_price=$6,min_stock=$7,image_url=$8,status=$9,updated_at=now() WHERE tenant_id=current_setting(\'app.tenant_id\')::uuid AND id=$10 RETURNING *',[values[0],values[1],values[2],values[3],values[4],values[5],values[7],values[8],values[9],input.id]);if(!result.rowCount)throw new Error('PRODUCT_NOT_FOUND');return result.rows[0];}return (await client.query('INSERT INTO tenant_products(tenant_id,category_id,sku,barcode,name,cost_price,sale_price,stock_qty,min_stock,image_url,status) VALUES(current_setting(\'app.tenant_id\')::uuid,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *',values)).rows[0];});}
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
