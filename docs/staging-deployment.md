# Staging deployment

## Required configuration

Create a deployment `.env` outside source control with `POSTGRES_PASSWORD`, `PG_TENANT_ID`, the Opn keys, and `PAYMENT_MODE=production`. Never reuse test credentials that appeared in chat, logs, or commits.

## Start

```bash
docker compose -f docker-compose.production.yml up -d --build
docker compose -f docker-compose.production.yml ps
curl -f http://127.0.0.1:3000/readyz
```

Put a TLS reverse proxy or managed HTTPS load balancer in front of `127.0.0.1:3000`. Configure the permanent Opn webhook as:

```text
https://YOUR-DOMAIN/api/payments/webhook
```

The application container runs as a non-root user and exposes a `/readyz` health check. PostgreSQL is not published to the public network.

## Database lifecycle

The Compose init mount applies `server/postgres-schema.sql` only when creating an empty PostgreSQL volume. For an existing database, apply reviewed schema changes before restarting the application.

## Backup

Set `DATABASE_URL`, `BACKUP_ENCRYPTION_KEY`, `S3_BUCKET`, and the object-storage credentials on the backup host, then schedule:

```powershell
npm run backup:postgres
```

A disaster-recovery backup is complete only after the command reports a successful off-site upload. Perform restore drills against a disposable database.
