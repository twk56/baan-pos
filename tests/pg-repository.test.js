import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {PgRepository} from '../server/pg-repository.js';
const url=process.env.DATABASE_URL;
const repo=url?new PgRepository(url):null;
after(async()=>{if(repo)await repo.close();});
test('postgres repository transaction and tenant isolation',async t=>{
  if(!repo){t.skip('DATABASE_URL not configured');return;}
  const tenants=(await repo.pool.query('SELECT id FROM tenants ORDER BY created_at LIMIT 2')).rows;assert.ok(tenants.length>=2);
  const products=await repo.listProducts(tenants[0].id);assert.equal(Array.isArray(products),true);
  const cross=await repo.withTenant(tenants[0].id,async client=>(await client.query('SELECT count(*)::int count FROM tenant_products WHERE tenant_id=$1',[tenants[1].id])).rows[0].count);assert.equal(Number(cross),0);
});
