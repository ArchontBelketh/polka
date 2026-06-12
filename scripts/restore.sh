#!/usr/bin/env bash
#
# Verified restore — proves a backup is actually restorable.
#
# Downloads a backup, restores it into a THROWAWAY database (never touches the
# live one), prints row counts so you can eyeball them, then drops the temp DB.
# Run this at least once before launch, and periodically after.
#
#   set -a; . /opt/polka/backup.env; set +a
#   ./scripts/restore.sh polka_2026-06-12_0300.sql.gz
#
# To restore into the LIVE database after a disaster, see the manual steps in
# DEPLOY.md — that is intentionally not automated here.
set -euo pipefail

KEY="${1:?Usage: restore.sh <backup-filename.sql.gz>}"
COMPOSE_FILE="${COMPOSE_FILE:-/opt/polka/docker-compose.yml}"
PG_USER="${PG_USER:-polka}"
RESTORE_DB="${RESTORE_DB:-polka_restore_check}"
: "${BACKUP_S3_BUCKET:?set BACKUP_S3_BUCKET}"
: "${BACKUP_S3_ENDPOINT:?set BACKUP_S3_ENDPOINT}"

TMP="/tmp/restore_$$.sql.gz"
trap 'rm -f "$TMP"' EXIT

echo "[$(date -Is)] downloading ${KEY}…"
aws s3 cp "s3://${BACKUP_S3_BUCKET}/db/${KEY}" "$TMP" --endpoint-url "$BACKUP_S3_ENDPOINT"

psql_db() { docker compose -f "$COMPOSE_FILE" exec -T db psql -U "$PG_USER" -d "$1"; }

echo "[$(date -Is)] (re)creating throwaway DB ${RESTORE_DB}…"
psql_db postgres <<SQL
DROP DATABASE IF EXISTS ${RESTORE_DB};
CREATE DATABASE ${RESTORE_DB} OWNER ${PG_USER};
SQL

echo "[$(date -Is)] restoring…"
gunzip -c "$TMP" | psql_db "$RESTORE_DB" >/dev/null

echo "[$(date -Is)] row counts in restored DB:"
psql_db "$RESTORE_DB" <<'SQL'
SELECT 'User'     AS table, count(*) FROM "User"
UNION ALL SELECT 'Product',  count(*) FROM "Product"
UNION ALL SELECT 'Purchase', count(*) FROM "Purchase";
SQL

echo "[$(date -Is)] dropping throwaway DB…"
psql_db postgres -c "DROP DATABASE ${RESTORE_DB};" >/dev/null
echo "[$(date -Is)] verified restore OK."
