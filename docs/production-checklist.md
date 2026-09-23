# Production launch checklist

สถานะ: foundation ถูกเพิ่มแล้ว แต่ยังไม่ใช่การเปิดขายจริง

## ทำได้ใน repository นี้

- `docker-compose.postgres.yml` และ `server/postgres-schema.sql` วาง tenant, members, plans และ subscriptions foundation
- `server/payment-adapter.js` กำหนด provider boundary และบังคับให้ตั้ง provider ก่อนเปิด paid mode
- `src/offline-queue.ts`, PWA manifest และ service worker เป็น offline shell/queue foundation
- CI เดิมตรวจ build, tests และ npm audit

## ต้องมีข้อมูลหรือผู้ให้บริการก่อนทำต่อ

- PostgreSQL production URL, migration window และ tenant migration mapping
- Payment provider ที่รองรับไทย, merchant account, webhook secret และ settlement format
- Object storage credentials, encryption key management, retention และ restore destination
- ผู้เชี่ยวชาญภาษีรับรอง VAT/e-Tax/ภ.พ.30 และตัวอย่างเอกสารที่ถูกต้อง
- DPO/ที่ปรึกษา PDPA, privacy notice, consent wording, DPA และ retention period
- External security tester, DAST target, load target และ incident contact
- Barcode/printer model ที่ต้องรองรับจริง
- Monitoring provider, support mailbox, SLA, RPO/RTO และ pilot customers

## ห้ามทำก่อนตรวจรับ

ห้ามใช้ schema foundation นี้กับ production โดยตรงจนกว่าจะย้ายทุก business table ให้มี `tenant_id`, ใช้ tenant context จาก authenticated session, เพิ่ม row-level isolation tests และทำ migration/rollback ที่ทดสอบแล้ว


## PostgreSQL backup
Set `DATABASE_URL` and optionally `BACKUP_ENCRYPTION_KEY`, then run `npm run backup:postgres`. Keep the dump outside the application host and perform a restore test against a disposable database.
