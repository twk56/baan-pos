# Backup and recovery plan

## Target

- RPO: 24 hours for pilot, reduce to 1 hour before SaaS launch.
- RTO: 4 hours for pilot, reduce to 1 hour before SaaS launch.
- Primary database: PostgreSQL. SQLite is test-only.

## Daily backup

Run `npm run backup:postgres` from a host with `pg_dump`. Set `DATABASE_URL` and `BACKUP_ENCRYPTION_KEY`. To upload automatically, also set `S3_BUCKET` and the standard AWS credentials/region variables. The scripts send the encrypted `.dump.enc` file to S3-compatible object storage with server-side AES-256 encryption and fail the job when upload fails.

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

Example scheduled command on Windows:

```powershell
npm run backup:postgres
```

Treat a successful local dump without the `Off-site backup uploaded` message as incomplete for disaster recovery.
