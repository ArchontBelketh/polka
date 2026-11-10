#!/usr/bin/env bash
# Deploy ПОЛКА to Hetzner server via SSH
# Usage: ./scripts/deploy.sh [host] [user]
# Example: ./scripts/deploy.sh 1.2.3.4 root
#
# Prerequisites:
#   - SSH key auth configured (no password prompt)
#   - Docker + Docker Compose installed on server
#   - /opt/polka directory with .env on server
#   - existing databases baselined as documented in docs/DATABASE_MIGRATIONS.md

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
  --exclude='.env*' \
  --exclude='.secrets' \
  --exclude='docs/index.bleve' \
  --exclude='test-results' \
  --exclude='prisma/migrations/*.db' \
  ./ "${REMOTE}:${APP_DIR}/"

# ── 2. Build & restart on server ────────────────────────────────────────────
echo "▶ Building image and restarting..."
ssh "${REMOTE}" bash -s -- "${APP_DIR}" <<'EOF'
  set -euo pipefail
  cd "$1"
  deploy_compose=(docker compose -f docker-compose.yml -f docker-compose.prod.yml)

  # Pull latest base images
  "${deploy_compose[@]}" pull --quiet db 2>/dev/null || true

  # Build app image
  "${deploy_compose[@]}" build app migrate

  # Run migrations
  "${deploy_compose[@]}" up -d db
  "${deploy_compose[@]}" run --rm migrate

  # Only restart the application after migrations have succeeded.
  "${deploy_compose[@]}" up -d app

  # Clean up dangling images
  docker image prune -f
EOF

echo "✅ Deploy complete. App running at https://${HOST}"
