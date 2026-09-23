#!/usr/bin/env sh
set -eu
: "${DATABASE_URL:?DATABASE_URL is required}"
OUT_DIR="${1:-./backups}"; mkdir -p "$OUT_DIR"; STAMP="$(date +%Y%m%d-%H%M%S)"; TARGET="$OUT_DIR/baan-pos-$STAMP.dump"
pg_dump "$DATABASE_URL" --format=custom --no-owner --file="$TARGET"
if [ -n "${BACKUP_ENCRYPTION_KEY:-}" ]; then openssl enc -aes-256-cbc -pbkdf2 -salt -in "$TARGET" -out "$TARGET.enc" -pass env:BACKUP_ENCRYPTION_KEY; rm -f "$TARGET"; TARGET="$TARGET.enc"; fi
find "$OUT_DIR" -name 'baan-pos-*.dump*' -type f -printf '%T@ %p\n' | sort -nr | tail -n +15 | cut -d' ' -f2- | xargs -r rm -f
if [ -n "${S3_BUCKET:-}" ]; then aws s3 cp "$TARGET" "s3://$S3_BUCKET/$(basename "$TARGET")" --sse AES256; echo "Off-site backup uploaded: s3://$S3_BUCKET/$(basename "$TARGET")"; fi
echo "PostgreSQL backup created: $TARGET"
