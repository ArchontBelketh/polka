#!/usr/bin/env bash
#
# Hourly watchdog. Alerts to Telegram if:
#   (a) the latest DB backup in S3 is older than ~24h, or
#   (b) a cron job hasn't checked in (CronHeartbeat) within its window.
#
# Env (source backup.env + the app's TELEGRAM_BOT_TOKEN):
#   BACKUP_S3_BUCKET, BACKUP_S3_ENDPOINT, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
#   TELEGRAM_BOT_TOKEN, TELEGRAM_ALERT_CHAT_ID
#   COMPOSE_FILE, PG_USER, PG_DB
#
# Crontab (hourly):
#   0 * * * * set -a; . /opt/polka/backup.env; set +a; /opt/polka/scripts/monitor.sh >> /var/log/polka-monitor.log 2>&1
set -uo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-/opt/polka/docker-compose.yml}"
PG_USER="${PG_USER:-polka}"
PG_DB="${PG_DB:-polka_db}"

alert() {
  echo "[$(date -Is)] ALERT: $1" >&2
  if [ -n "${TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${TELEGRAM_ALERT_CHAT_ID:-}" ]; then
    curl -fsS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
      --data-urlencode "chat_id=${TELEGRAM_ALERT_CHAT_ID}" \
      --data-urlencode "text=🚨 ПОЛКА: $1" >/dev/null || true
  fi
}

# ── (a) backup freshness ─────────────────────────────────────────────────────
if [ -n "${BACKUP_S3_BUCKET:-}" ]; then
  LATEST=$(aws s3 ls "s3://${BACKUP_S3_BUCKET}/db/" --endpoint-url "$BACKUP_S3_ENDPOINT" 2>/dev/null | sort | tail -1)
  if [ -z "$LATEST" ]; then
    alert "В бакете бэкапов нет ни одного файла"
  else
    BACKUP_DATE=$(echo "$LATEST" | awk '{print $1" "$2}')
    BACKUP_EPOCH=$(date -d "$BACKUP_DATE" +%s 2>/dev/null || echo 0)
    AGE_H=$(( ($(date +%s) - BACKUP_EPOCH) / 3600 ))
    if [ "$BACKUP_EPOCH" -eq 0 ] || [ "$AGE_H" -gt 26 ]; then
      alert "Последний бэкап старше суток (возраст ~${AGE_H}ч)"
    fi
  fi
fi

# ── (b) cron heartbeats ──────────────────────────────────────────────────────
check_cron() {
  local job="$1" max_min="$2" mins
  mins=$(docker compose -f "$COMPOSE_FILE" exec -T db psql -U "$PG_USER" -d "$PG_DB" -t -A -c \
    "select coalesce((extract(epoch from (now()-\"ranAt\"))/60)::int, 999999) from \"CronHeartbeat\" where job='${job}';" 2>/dev/null | tr -d '[:space:]')
  if [ -z "$mins" ]; then
    alert "Cron «${job}» ни разу не отметился"
  elif [ "$mins" -gt "$max_min" ]; then
    alert "Cron «${job}» не запускался ~${mins} мин (порог ${max_min})"
  fi
}
check_cron escrow 90      # ожидается раз в час
check_cron ai-review 20   # ожидается раз в 5 минут

echo "[$(date -Is)] monitor ok"
