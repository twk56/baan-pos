# Commercial readiness

สถานะนี้เป็นผลตรวจจากโค้ด repository ปัจจุบัน ไม่ใช่ใบรับรอง security หรือ legal compliance

## ทำแล้วในรุ่นนี้

- bcrypt password hashing, session token แบบสุ่ม 256-bit ที่เก็บในฐานข้อมูลเป็น SHA-256, expiry 8 ชั่วโมง และ logout revoke
- จำกัด JSON body 100 KB, rate limit login แบบ in-memory, ตรวจ Origin ของ mutation request และใช้ parameterized SQL
- ปิด `x-powered-by`, security headers, `HttpOnly`/`SameSite=Strict` cookie, no-store สำหรับ API และป้องกัน cache ข้อมูลธุรกรรม
- เปิด HTTPS redirect เมื่อ deploy โดยตั้ง `HTTPS_ONLY=1` และ `TRUST_PROXY=1` หลัง TLS terminator
- checkout ใช้ transaction, server-side price/stock check, idempotency key, audit log และ rollback
- มี CI build/test ที่ Node 20/22/24 และ `npm audit --audit-level=high`
- มี backup script เก็บ 14 รุ่น: `pwsh scripts/backup.ps1` หรือ `sh scripts/backup.sh`

## ยังเป็น blocker ก่อนรับลูกค้าจริง

1. **Pen test ภายนอก:** มี baseline audit และ integration tests แต่ยังไม่มีการทดสอบโดยผู้ตรวจอิสระ, DAST, dependency scanning แบบ scheduled หรือ threat model ที่เซ็นรับรอง
2. **SaaS multi-tenant/billing:** รุ่นปัจจุบันเป็น single-store SQLite ผูกกับฐานข้อมูลเดียว ยังไม่มี `tenant_id` isolation, PostgreSQL, subscription provider, invoice billing, usage limits หรือ tenant-aware authorization
3. **Offline-first:** ไม่มี IndexedDB/sync queue/conflict resolution จึงต้องมี network ระหว่างใช้งาน
4. **ภาษีไทย:** VAT ในระบบเป็นยอดคำนวณเพื่อ demo ยังไม่ใช่ใบกำกับภาษีอิเล็กทรอนิกส์, รายงาน ภ.พ.30, ภาษีซื้อ/ขาย หรือการเชื่อมระบบกรมสรรพากร ต้องให้ผู้เชี่ยวชาญภาษีตรวจและออกแบบก่อนขาย
5. **PDPA:** ต้องเพิ่ม consent/notice, retention/deletion workflow, data export, processor/subprocessor register, breach process, DPA และแต่งตั้งผู้รับผิดชอบตามบริบทจริง
6. **Operational SLA:** ยังไม่มี monitoring, alerting, managed backup restore drill, RPO/RTO, support workflow, status page หรือ on-call

## SaaS migration sequence

1. ย้าย data layer ไป PostgreSQL และเพิ่ม `tenants`, `tenant_members`, `plans`, `subscriptions`, `usage_events`; ทุก query ต้องรับ tenant context จาก session และมี database policy/automated isolation tests
2. แยก billing service ผ่านผู้ให้บริการที่รองรับไทย, webhook idempotency, invoice states และ plan entitlements
3. เพิ่ม object storage/versioned encrypted backups และทดสอบ restore รายสัปดาห์
4. เพิ่ม PWA/IndexedDB queue เฉพาะ cart และ offline sale ที่มี device id, sequence, replay status และ conflict policy
5. ให้ผู้สอบบัญชี/ที่ปรึกษาภาษีและ PDPA review ก่อนเปิด commercial beta

## License and pricing

ตรวจ dependency แบบอัตโนมัติด้วย `npm install --package-lock-only` และ `npm audit`; ก่อนขายควรสร้าง SBOM (`npm sbom --sbom-format cyclonedx`) และตรวจ license ของ transitive dependencies กับ counsel. Proposed pilot pricing: per branch/month with a fixed base tier plus optional add-ons; avoid percentage-of-sales until payment and tax responsibilities are contractually clear. Publish support hours, response targets, backup policy, data export and SLA before accepting payment.
