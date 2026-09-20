import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import bcrypt from 'bcryptjs';
const path=process.env.DB_PATH||resolve('data/pos.sqlite');
mkdirSync(dirname(path),{recursive:true});
export const db=new DatabaseSync(path);
db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,name TEXT NOT NULL,email TEXT UNIQUE NOT NULL,password_hash TEXT NOT NULL,role TEXT NOT NULL,status TEXT DEFAULT 'active');
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id INTEGER REFERENCES users(id),expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS categories(id INTEGER PRIMARY KEY,name TEXT UNIQUE NOT NULL,status TEXT DEFAULT 'active');
CREATE TABLE IF NOT EXISTS products(id INTEGER PRIMARY KEY,category_id INTEGER REFERENCES categories(id),sku TEXT UNIQUE NOT NULL,barcode TEXT UNIQUE,name TEXT NOT NULL,cost_price INTEGER NOT NULL CHECK(cost_price>=0),sale_price INTEGER NOT NULL CHECK(sale_price>=0),stock_qty INTEGER NOT NULL DEFAULT 0 CHECK(stock_qty>=0),min_stock INTEGER DEFAULT 5,image_url TEXT DEFAULT '',status TEXT DEFAULT 'active',created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS customers(id INTEGER PRIMARY KEY,name TEXT NOT NULL,phone TEXT DEFAULT '',email TEXT DEFAULT '',created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS orders(id INTEGER PRIMARY KEY,order_no TEXT UNIQUE NOT NULL,cashier_id INTEGER REFERENCES users(id),customer_id INTEGER REFERENCES customers(id),subtotal INTEGER NOT NULL,discount INTEGER NOT NULL,tax INTEGER NOT NULL,total INTEGER NOT NULL,payment_status TEXT NOT NULL,order_status TEXT NOT NULL,request_key TEXT UNIQUE NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS order_items(id INTEGER PRIMARY KEY,order_id INTEGER REFERENCES orders(id),product_id INTEGER REFERENCES products(id),name TEXT NOT NULL,quantity INTEGER NOT NULL,unit_price INTEGER NOT NULL,cost_price INTEGER NOT NULL,line_total INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS payments(id INTEGER PRIMARY KEY,order_id INTEGER REFERENCES orders(id),method TEXT NOT NULL,amount INTEGER NOT NULL,tendered INTEGER NOT NULL,status TEXT NOT NULL,reference TEXT,paid_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS stock_movements(id INTEGER PRIMARY KEY,product_id INTEGER REFERENCES products(id),type TEXT NOT NULL,quantity INTEGER NOT NULL,reference_id INTEGER,note TEXT,created_by INTEGER REFERENCES users(id),created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS audit_logs(id INTEGER PRIMARY KEY,user_id INTEGER REFERENCES users(id),action TEXT NOT NULL,entity_type TEXT,entity_id INTEGER,metadata TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS settings(id INTEGER PRIMARY KEY CHECK(id=1),shop_name TEXT NOT NULL,tax_rate REAL NOT NULL,receipt_footer TEXT NOT NULL);
INSERT OR IGNORE INTO settings VALUES(1,'Baan Store',7,'ขอบคุณที่อุดหนุน แล้วพบกันใหม่');`);
export const all=(sql,...args)=>db.prepare(sql).all(...args);
export const get=(sql,...args)=>db.prepare(sql).get(...args);
export const run=(sql,...args)=>db.prepare(sql).run(...args);
export function transaction(fn){db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}
export function audit(user,action,entity,id,metadata={}){run('INSERT INTO audit_logs(user_id,action,entity_type,entity_id,metadata) VALUES(?,?,?,?,?)',user,action,entity,id,JSON.stringify(metadata));}
if(!get('SELECT id FROM users LIMIT 1')) transaction(()=>{
 const hash=bcrypt.hashSync('Demo@1234',10);
 run('INSERT INTO users(name,email,password_hash,role) VALUES(?,?,?,?)','ผู้ดูแลร้าน','admin@demo.local',hash,'admin');
 run('INSERT INTO users(name,email,password_hash,role) VALUES(?,?,?,?)','พนักงานขาย','cashier@demo.local',hash,'cashier');
 ['เครื่องดื่ม','เบเกอรี่','ขนมและของว่าง','ของใช้'].forEach(name=>run('INSERT INTO categories(name) VALUES(?)',name));
 const products=[['อเมริกาโน่',1,65,24,48,'☕'],['ลาเต้',1,75,30,36,'🥛'],['ชาเขียวมัทฉะ',1,85,35,28,'🍵'],['น้ำส้มคั้น',1,55,22,24,'🍊'],['ครัวซองต์เนยสด',2,69,28,18,'🥐'],['เค้กสตรอว์เบอร์รี',2,115,52,8,'🍰'],['คุกกี้ช็อกโกแลต',2,45,16,32,'🍪'],['โดนัทเคลือบช็อกโกแลต',2,49,18,4,'🍩'],['มันฝรั่งทอด',3,35,19,42,'🥔'],['อัลมอนด์อบ',3,59,31,16,'🥜'],['น้ำแร่',1,20,7,60,'💧'],['ถุงผ้า Baan',4,129,48,3,'🛍️']];
 products.forEach(([name,cat,price,cost,qty,icon],i)=>{const id=Number(run('INSERT INTO products(category_id,sku,barcode,name,cost_price,sale_price,stock_qty,min_stock,image_url) VALUES(?,?,?,?,?,?,?,?,?)',cat,`BAAN-${String(i+1).padStart(3,'0')}`,`885000000${String(i+1).padStart(4,'0')}`,name,cost*100,price*100,qty,5,icon).lastInsertRowid);run('INSERT INTO stock_movements(product_id,type,quantity,note,created_by) VALUES(?,?,?,?,1)',id,'opening',qty,'ยอดยกมา');});
 run('INSERT INTO customers(name,phone,email) VALUES(?,?,?)','คุณมิน','0812345678','min@example.com');
 run('INSERT INTO customers(name,phone,email) VALUES(?,?,?)','คุณต้น','0898765432','ton@example.com');
});
