#!/usr/bin/env bash
# =============================================================================
#  ПОЛКА — автоматическое развёртывание на сервере (Ubuntu/Debian)
# -----------------------------------------------------------------------------
#  Делает всё «под ключ»:
#    1. ставит Docker, nginx, certbot, ufw (если их нет);
#    2. создаёт .env и генерирует секреты (если их нет);
#    3. собирает и поднимает контейнеры (app + postgres);
#    4. применяет схему БД (prisma db push);
#    5. создаёт первого администратора;
#    6. настраивает nginx + бесплатный HTTPS (Let's Encrypt);
#    7. включает firewall и проверяет здоровье.
#
#  Запуск (от root):   sudo bash scripts/server-setup.sh
#  Повторный запуск безопасен (идемпотентно) — например после правки .env.
#
#  Необязательно можно задать значения заранее, без вопросов:
#    sudo DOMAIN=polka.ru LETSENCRYPT_EMAIL=me@polka.ru ADMIN_EMAIL=admin@polka.ru \
#         bash scripts/server-setup.sh
# =============================================================================
set -euo pipefail

# ── Перейти в корень проекта (рядом лежат docker-compose.yml и .env) ──────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$REPO_ROOT"

COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"
export DEBIAN_FRONTEND=noninteractive

c_info()  { printf '\n\033[1;36m▶ %s\033[0m\n' "$*"; }
c_ok()    { printf '\033[1;32m✓ %s\033[0m\n' "$*"; }
c_warn()  { printf '\033[1;33m! %s\033[0m\n' "$*"; }
c_err()   { printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2; }
die()     { c_err "$*"; exit 1; }

# ── 0. Проверки окружения ────────────────────────────────────────────────────
[ "$(id -u)" = "0" ] || die "Запустите от root:  sudo bash scripts/server-setup.sh"
command -v apt-get >/dev/null 2>&1 || die "Скрипт рассчитан на Ubuntu/Debian (apt). На другой ОС поставьте Docker/nginx/certbot вручную."

# ── helpers для работы с .env ────────────────────────────────────────────────
env_get() {
  local key="$1" line
  line="$(grep -E "^${key}=" .env 2>/dev/null | tail -n1 || true)"
  line="${line#${key}=}"
  line="${line%\"}"; line="${line#\"}"
  printf '%s' "$line"
}
env_set() {
  local key="$1" val="$2" tmp
  tmp="$(mktemp)"
  grep -v -E "^${key}=" .env > "$tmp" 2>/dev/null || true
  printf '%s="%s"\n' "$key" "$val" >> "$tmp"
  mv "$tmp" .env
}
# Спросить значение, если оно пустое/плейсхолдер. Приоритет: env-переменная → .env → вопрос.
resolve() {
  local var="$1" prompt="$2" default="${3:-}" cur
  cur="$(eval "printf '%s' \"\${$var:-}\"")"        # значение из окружения скрипта
  [ -n "$cur" ] || cur="$(env_get "$var")"          # иначе из .env
  case "$cur" in ""|*example.com|CHANGEME) cur="" ;; esac
  if [ -z "$cur" ]; then
    if [ -t 0 ]; then
      read -r -p "$prompt${default:+ [$default]}: " cur
      [ -n "$cur" ] || cur="$default"
    else
      cur="$default"
    fi
  fi
  [ -n "$cur" ] || die "Не задано значение: $var"
  eval "$var=\$cur"
  env_set "$var" "$cur"
}

# ── 1. Установка системных пакетов ───────────────────────────────────────────
c_info "Проверяю системные пакеты…"
if ! command -v docker >/dev/null 2>&1; then
  c_info "Ставлю Docker…"
  curl -fsSL https://get.docker.com | sh
fi
docker compose version >/dev/null 2>&1 || die "Docker Compose plugin не найден после установки Docker."

NEED_PKGS=()
command -v nginx   >/dev/null 2>&1 || NEED_PKGS+=(nginx)
command -v certbot >/dev/null 2>&1 || NEED_PKGS+=(certbot python3-certbot-nginx)
command -v ufw     >/dev/null 2>&1 || NEED_PKGS+=(ufw)
command -v openssl >/dev/null 2>&1 || NEED_PKGS+=(openssl)
command -v curl    >/dev/null 2>&1 || NEED_PKGS+=(curl)
if [ "${#NEED_PKGS[@]}" -gt 0 ]; then
  c_info "Ставлю: ${NEED_PKGS[*]}"
  apt-get update -qq
  apt-get install -y -qq "${NEED_PKGS[@]}"
fi
c_ok "Системные пакеты на месте."

# ── 2. Файл .env ─────────────────────────────────────────────────────────────
if [ ! -f .env ]; then
  [ -f .env.production.example ] || die "Нет .env.production.example рядом со скриптом."
  cp .env.production.example .env
  chmod 600 .env
  c_ok "Создал .env из шаблона."
fi

# ── 3. Домен / email / админ ─────────────────────────────────────────────────
c_info "Параметры домена и администратора…"
resolve DOMAIN            "Домен (A-запись уже указывает на этот сервер), напр. polka.ru"
resolve LETSENCRYPT_EMAIL "Email для уведомлений Let's Encrypt" "admin@${DOMAIN}"
resolve ADMIN_EMAIL       "Email первого администратора"        "admin@${DOMAIN}"

# Производные значения от домена
env_set NEXTAUTH_URL        "https://${DOMAIN}"
env_set NEXT_PUBLIC_APP_URL "https://${DOMAIN}"

# ── 4. Секреты (генерируем, только если пустые) ──────────────────────────────
c_info "Секреты…"
[ -n "$(env_get NEXTAUTH_SECRET)" ] || { env_set NEXTAUTH_SECRET "$(openssl rand -base64 32)"; c_ok "NEXTAUTH_SECRET сгенерирован"; }
[ -n "$(env_get CRON_SECRET)" ]     || { env_set CRON_SECRET     "$(openssl rand -base64 32)"; c_ok "CRON_SECRET сгенерирован"; }
PGPW="$(env_get POSTGRES_PASSWORD)"
if [ -z "$PGPW" ]; then
  PGPW="$(openssl rand -hex 24)"            # hex → безопасно для строки подключения
  env_set POSTGRES_PASSWORD "$PGPW"
  c_ok "POSTGRES_PASSWORD сгенерирован"
fi
# DATABASE_URL всегда пересобираем из пароля, чтобы они не разъехались
env_set DATABASE_URL "postgresql://polka:${PGPW}@db:5432/polka_db"
chmod 600 .env

# ── 5. Firewall ──────────────────────────────────────────────────────────────
c_info "Настраиваю firewall (ufw)…"
ufw allow OpenSSH        >/dev/null 2>&1 || ufw allow 22/tcp >/dev/null 2>&1 || true
ufw allow 'Nginx Full'   >/dev/null 2>&1 || ufw allow 80,443/tcp >/dev/null 2>&1 || true
ufw --force enable       >/dev/null 2>&1 || true
c_ok "Открыты порты 22, 80, 443."

# ── 6. Сборка и запуск контейнеров ───────────────────────────────────────────
c_info "Собираю образ и поднимаю контейнеры (может занять несколько минут)…"
$COMPOSE up -d --build

c_info "Жду готовности приложения…"
for i in $(seq 1 40); do
  if curl -fsS http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
    c_ok "Приложение отвечает на /api/health."
    break
  fi
  [ "$i" = 40 ] && { $COMPOSE logs --tail=50 app; die "Приложение не поднялось за ~2 мин. Логи выше."; }
  sleep 3
done

# ── 7. Схема БД ──────────────────────────────────────────────────────────────
c_info "Применяю схему БД (prisma db push)…"
$COMPOSE run --rm migrate
c_ok "Схема применена."

# ── 8. Первый администратор (один раз) ───────────────────────────────────────
if [ ! -f .deploy-admin-created ]; then
  c_info "Создаю администратора ${ADMIN_EMAIL}…"
  ADMIN_PW="$(env_get ADMIN_PASSWORD)"
  if [ -n "$ADMIN_PW" ]; then
    $COMPOSE run --rm migrate npx tsx scripts/create-admin.ts --email "$ADMIN_EMAIL" --password "$ADMIN_PW"
  else
    $COMPOSE run --rm migrate npx tsx scripts/create-admin.ts --email "$ADMIN_EMAIL"
  fi
  touch .deploy-admin-created
  c_warn "Сохраните пароль администратора из строк выше — он показан один раз."
else
  c_ok "Администратор уже создавался ранее (пропускаю)."
fi

# ── 9. nginx + HTTPS ─────────────────────────────────────────────────────────
c_info "Настраиваю nginx для ${DOMAIN}…"
cat > /etc/nginx/sites-available/polka <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};
    client_max_body_size 50m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host              \$host;
        proxy_set_header X-Real-IP         \$remote_addr;
        proxy_set_header X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade           \$http_upgrade;
        proxy_set_header Connection        "upgrade";
        proxy_read_timeout 300s;
    }
}
EOF
ln -sf /etc/nginx/sites-available/polka /etc/nginx/sites-enabled/polka
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
c_ok "nginx проксирует ${DOMAIN} → 127.0.0.1:3000."

if [ -d "/etc/letsencrypt/live/${DOMAIN}" ]; then
  c_ok "TLS-сертификат для ${DOMAIN} уже есть (обновляется автоматически)."
else
  c_info "Выпускаю TLS-сертификат Let's Encrypt…"
  if certbot --nginx -d "${DOMAIN}" --non-interactive --agree-tos -m "${LETSENCRYPT_EMAIL}" --redirect; then
    c_ok "HTTPS включён."
  else
    c_warn "Не удалось выпустить сертификат. Проверьте, что A-запись ${DOMAIN} указывает на этот сервер,"
    c_warn "и повторите вручную:  certbot --nginx -d ${DOMAIN} --agree-tos -m ${LETSENCRYPT_EMAIL} --redirect"
  fi
fi

# ── 10. Итог ─────────────────────────────────────────────────────────────────
c_info "Готово."
echo "─────────────────────────────────────────────"
echo "  Сайт:        https://${DOMAIN}"
echo "  Админка:     https://${DOMAIN}/admin (войдите как ${ADMIN_EMAIL})"
echo "  Логи:        $COMPOSE logs -f app"
echo "  Перезапуск:  $COMPOSE up -d --build"
echo "  Статус:      $COMPOSE ps"
echo "─────────────────────────────────────────────"
c_warn "Если заполнили не все ключи (S3/ЮKassa/SMTP/Telegram) — допишите их в .env и выполните: $COMPOSE up -d --build"
