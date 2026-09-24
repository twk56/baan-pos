#!/usr/bin/env sh
set -eu
: "${DATABASE_URL:?DATABASE_URL is required}"
OUT_DIR="${1:-./backups}"; mkdir -p "$OUT_DIR"; STAMP="$(date +%Y%m%d-%H%M%S)"; TARGET="$OUT_DIR/baan-pos-$STAMP.dump"
pg_dump "$DATABASE_URL" --format=custom --no-owner --file="$TARGET"
pg_restore --list "$TARGET" >/dev/null
if [ -n "${BACKUP_ENCRYPTION_KEY:-}" ]; then openssl enc -aes-256-cbc -pbkdf2 -salt -in "$TARGET" -out "$TARGET.enc" -pass env:BACKUP_ENCRYPTION_KEY; rm -f "$TARGET"; TARGET="$TARGET.enc"; fi
ls -1t "$OUT_DIR"/baan-pos-*.dump* 2>/dev/null | tail -n +15 | xargs -r rm -f
if [ -n "${S3_BUCKET:-}" ]; then PREFIX="${S3_PREFIX:-postgres}"; DESTINATION="s3://$S3_BUCKET/$PREFIX/$(basename "$TARGET")"; aws s3 cp "$TARGET" "$DESTINATION" --sse AES256; echo "Off-site backup uploaded: $DESTINATION"; fi
echo "PostgreSQL backup created: $TARGET"
