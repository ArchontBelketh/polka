#!/usr/bin/env bash
# =============================================================================
#  Собирает архив для деплоя: polka-deploy.zip
#  Кладёт в архив только то, что нужно собрать образ на сервере — БЕЗ
#  node_modules, .next, .git и секретов (.env / .env.local).
#
#  Запуск:  bash scripts/make-release.sh
#  Результат:  ./polka-deploy.zip
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$REPO_ROOT"

OUT="polka-deploy.zip"
rm -f "$OUT"

EXCLUDES=(
  ".git/*"  "node_modules/*"  ".next/*"  "out/*"  "build/*"
  ".env"  ".env.local"  ".env.*.local"
  "test-screenshots/*"  "playwright-report/*"  "test-results/*"  "coverage/*"
  ".deploy-admin-created"  "polka-deploy.zip"  "*.log"
)

if command -v zip >/dev/null 2>&1; then
  args=(); for e in "${EXCLUDES[@]}"; do args+=(-x "$e"); done
  zip -r -q "$OUT" . "${args[@]}"
else
  # fallback: tar.gz, если zip недоступен
  OUT="polka-deploy.tar.gz"
  rm -f "$OUT"
  tar_excludes=(); for e in "${EXCLUDES[@]}"; do tar_excludes+=(--exclude="./${e%/*}"); done
  tar czf "$OUT" "${tar_excludes[@]}" .
  echo "zip не найден — собрал $OUT"
fi

echo "✓ Готово: $OUT ($(du -h "$OUT" | cut -f1))"
echo "  Залейте на сервер и распакуйте, затем запустите scripts/server-setup.sh"
