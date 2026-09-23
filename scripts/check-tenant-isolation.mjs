import pg from 'pg';
const url=process.env.DATABASE_URL;
if(!url) throw new Error('DATABASE_URL is required');
const pool=new pg.Pool({connectionString:url});
const tenants=await pool.query('SELECT id FROM tenants ORDER BY created_at LIMIT 2');
if(tenants.rows.length<2) throw new Error('Create at least two tenants before running isolation check');
const [a,b]=tenants.rows;
const client=await pool.connect();
try{
 await client.query('BEGIN');
 await client.query("SELECT set_config('app.tenant_id',$1,true)",[a.id]);
 const visible=await client.query('SELECT count(*)::int count FROM tenant_products');
 const cross=await client.query('SELECT count(*)::int count FROM tenant_products WHERE tenant_id=$1',[b.id]);
 if(Number(cross.rows[0].count)!==0) throw new Error(`Tenant isolation failed: ${cross.rows[0].count} cross-tenant rows visible`);
 console.log(JSON.stringify({tenant:a.id,visible:visible.rows[0].count,crossTenantRows:cross.rows[0].count,status:'ok'}));
 await client.query('ROLLBACK');
} finally {client.release();await pool.end();}
