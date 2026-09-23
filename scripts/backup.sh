#!/usr/bin/env sh
set -eu
DB_PATH="${DB_PATH:-./data/pos.sqlite}"
OUT_DIR="${1:-./backups}"
test -f "$DB_PATH"
mkdir -p "$OUT_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
cp "$DB_PATH" "$OUT_DIR/pos-$STAMP.sqlite"
find "$OUT_DIR" -name '*.sqlite' -type f -printf '%T@ %p\n' | sort -nr | tail -n +15 | cut -d' ' -f2- | xargs -r rm -f
echo "Backup created: $OUT_DIR/pos-$STAMP.sqlite"
