import {readFile} from 'node:fs/promises';
import pg from 'pg';
import bcrypt from 'bcryptjs';

const {DATABASE_URL,PG_TENANT_ID,ADMIN_EMAIL,ADMIN_PASSWORD}=process.env;
if(!DATABASE_URL||!PG_TENANT_ID)throw new Error('DATABASE_URL and PG_TENANT_ID are required');
const pool=new pg.Pool({connectionString:DATABASE_URL,max:1});
try{
  await pool.query(await readFile(new URL('../server/postgres-schema.sql',import.meta.url),'utf8'));
  await pool.query('INSERT INTO tenants(id,name,slug) VALUES($1,$2,$3) ON CONFLICT(id) DO NOTHING',[PG_TENANT_ID,'Baan POS Pilot','baan-pos-pilot']);
  if(ADMIN_EMAIL&&ADMIN_PASSWORD){
    const passwordHash=await bcrypt.hash(ADMIN_PASSWORD,12);
    const client=await pool.connect();
    try{
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.tenant_id',$1,true)",[PG_TENANT_ID]);
      await client.query("INSERT INTO tenant_users(tenant_id,user_id,name,email,password_hash,role,status) VALUES($1,1,'Administrator',$2,$3,'admin','active') ON CONFLICT(tenant_id,email) DO UPDATE SET password_hash=EXCLUDED.password_hash,status='active'",[PG_TENANT_ID,ADMIN_EMAIL.toLowerCase(),passwordHash]);
      await client.query('INSERT INTO tenant_settings(tenant_id) VALUES($1) ON CONFLICT DO NOTHING',[PG_TENANT_ID]);
      await client.query('COMMIT');
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  }
}finally{await pool.end();}
