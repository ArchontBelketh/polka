#!/usr/bin/env bash
# Deploy ПОЛКА to Hetzner server via SSH
# Usage: ./scripts/deploy.sh [host] [user]
# Example: ./scripts/deploy.sh 1.2.3.4 root
#
# Prerequisites:
#   - SSH key auth configured (no password prompt)
#   - Docker + Docker Compose installed on server
#   - /opt/polka directory with .env.local on server

set -euo pipefail

HOST="${1:-${DEPLOY_HOST:?Set DEPLOY_HOST or pass as first argument}}"
USER="${2:-${DEPLOY_USER:-root}}"
REMOTE="${USER}@${HOST}"
APP_DIR="/opt/polka"

echo "▶ Deploying to ${REMOTE}:${APP_DIR}"

# ── 1. Push latest code ──────────────────────────────────────────────────────
echo "▶ Syncing source..."
rsync -az --delete \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='.env.local' \
  --exclude='prisma/migrations/*.db' \
  ./ "${REMOTE}:${APP_DIR}/"

# ── 2. Build & restart on server ────────────────────────────────────────────
echo "▶ Building image and restarting..."
ssh "${REMOTE}" bash <<EOF
  set -euo pipefail
  cd ${APP_DIR}

  # Pull latest base images
  docker compose pull --quiet db 2>/dev/null || true

  # Build app image
  docker compose build --no-cache app

  # Run migrations
  docker compose run --rm app npx prisma migrate deploy

  # Zero-downtime restart: start new container before stopping old
  docker compose up -d --remove-orphans

  # Clean up dangling images
  docker image prune -f
EOF

echo "✅ Deploy complete. App running at https://${HOST}"
