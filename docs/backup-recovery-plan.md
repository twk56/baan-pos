# Backup and recovery plan

## Target

- RPO: 24 hours for pilot, reduce to 1 hour before SaaS launch.
- RTO: 4 hours for pilot, reduce to 1 hour before SaaS launch.
- Primary database: PostgreSQL. SQLite is test-only.

## Daily backup

Run `npm run backup:postgres` from a host with `pg_dump`. Set `DATABASE_URL` and `BACKUP_ENCRYPTION_KEY`. Upload the resulting `.dump.enc` file to encrypted object storage with server-side encryption and a separate access key.

Keep 14 daily copies, 8 weekly copies, and 12 monthly copies. Never store the only copy on the application host.

## Restore drill

1. Provision a disposable PostgreSQL database.
2. Decrypt the dump outside the production host.
3. Run `pg_restore --clean --if-exists --no-owner`.
4. Apply `server/postgres-schema.sql`.
5. Run `npm run test:pg` with the disposable `DATABASE_URL`.
6. Record duration, row counts, and any errors.

## Failure fallback

If object storage is unavailable, retain the local encrypted dump and alert the operator immediately. Do not claim the backup is durable until an off-host upload succeeds. If restore fails, keep the original database untouched and escalate for manual recovery.

## Required production work

- Object storage bucket with versioning and lifecycle retention.
- Scheduled job/CI runner and failure alert.
- Quarterly restore drill, plus a drill before onboarding paid tenants.
