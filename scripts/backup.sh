#!/usr/bin/env bash
#
# Nightly Postgres backup to a SEPARATE S3 bucket.
#
# Why a separate bucket + service account: if the application's S3 keys leak,
# the attacker must not be able to wipe both product files and the backups.
# The backups bucket service account must NOT be the one in YANDEX_S3_*.
#
# Configure via an env file sourced before running (e.g. /opt/polka/backup.env):
#   BACKUP_S3_BUCKET=polka-backups
#   BACKUP_S3_ENDPOINT=https://storage.yandexcloud.net
#   AWS_ACCESS_KEY_ID=...        # service account scoped to the backups bucket only
#   AWS_SECRET_ACCESS_KEY=...
#   COMPOSE_FILE=/opt/polka/docker-compose.yml   # optional
#   PG_USER=polka  PG_DB=polka_db                # optional
#
# Crontab (daily 03:00):
#   0 3 * * * set -a; . /opt/polka/backup.env; set +a; /opt/polka/scripts/backup.sh >> /var/log/polka-backup.log 2>&1
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-/opt/polka/docker-compose.yml}"
PG_USER="${PG_USER:-polka}"
PG_DB="${PG_DB:-polka_db}"
: "${BACKUP_S3_BUCKET:?set BACKUP_S3_BUCKET}"
: "${BACKUP_S3_ENDPOINT:?set BACKUP_S3_ENDPOINT}"

STAMP=$(date +%Y-%m-%d_%H%M)
FILE="/tmp/polka_${STAMP}.sql.gz"
trap 'rm -f "$FILE"' EXIT

echo "[$(date -Is)] dumping ${PG_DB}…"
docker compose -f "$COMPOSE_FILE" exec -T db pg_dump -U "$PG_USER" "$PG_DB" | gzip > "$FILE"

SIZE=$(stat -c%s "$FILE")
if [ "$SIZE" -lt 1000 ]; then
  echo "[$(date -Is)] backup too small (${SIZE} bytes) — aborting, not uploading" >&2
  exit 1
fi

aws s3 cp "$FILE" "s3://${BACKUP_S3_BUCKET}/db/" --endpoint-url "$BACKUP_S3_ENDPOINT"
echo "[$(date -Is)] uploaded s3://${BACKUP_S3_BUCKET}/db/$(basename "$FILE") (${SIZE} bytes)"
