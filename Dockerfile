FROM node:22-slim AS base
WORKDIR /app
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# ── Deps ──────────────────────────────────────────────────────────────────────
FROM base AS deps
COPY package.json pnpm-lock.yaml* package-lock.json* ./
RUN if [ -f pnpm-lock.yaml ]; then pnpm install --frozen-lockfile; \
    else npm ci; fi

# ── Builder ───────────────────────────────────────────────────────────────────
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate

# NEXT_PUBLIC_* are inlined into the client bundle at build time, so they must be
# present here (not only at runtime). Passed via compose build args from .env.
ARG NEXT_PUBLIC_APP_URL=""
ARG NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=""
ARG NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS=""
ARG NEXT_PUBLIC_SENTRY_DSN=""
ARG NEXT_PUBLIC_SMARTCAPTCHA_SITE_KEY=""
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=$NEXT_PUBLIC_TELEGRAM_BOT_USERNAME \
    NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS=$NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS \
    NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN \
    NEXT_PUBLIC_SMARTCAPTCHA_SITE_KEY=$NEXT_PUBLIC_SMARTCAPTCHA_SITE_KEY

RUN npm run build

# ── Migrator ──────────────────────────────────────────────────────────────────
# Лёгкий образ ТОЛЬКО для одноразовых задач схемы (`prisma db push`). Содержит
# лишь prisma CLI + dotenv + схему — на порядок меньше стадии builder, чтобы
# сборка второго образа не упиралась в диск. Стоит ПЕРЕД runner, чтобы последней
# стадией (сборка без target) оставался runner.
FROM node:22-slim AS migrator
WORKDIR /app
RUN apt-get update && apt-get install -y openssl --no-install-recommends && rm -rf /var/lib/apt/lists/* && \
    npm init -y >/dev/null 2>&1 && npm install --no-audit --no-fund prisma@7 dotenv@17
COPY prisma.config.ts ./prisma.config.ts
COPY prisma ./prisma
CMD ["npx", "prisma", "db", "push"]

# ── Runner ────────────────────────────────────────────────────────────────────
FROM node:22-slim AS runner
WORKDIR /app

# Python + сканеры (bandit / semgrep / olevba). Ставим ЗДЕСЬ, в runner, тем же
# python3, который их и запускает — иначе шебанг и site-packages из отдельной
# стадии не совпадают, и bandit/semgrep не стартуют (отсюда «сканеры не установлены»
# при физически присутствующих файлах). oletools даёт CLI `olevba`.
RUN apt-get update && apt-get install -y python3 python3-pip git --no-install-recommends && \
    pip3 install --no-cache-dir --break-system-packages bandit semgrep oletools && \
    rm -rf /var/lib/apt/lists/*

# v8unpack (1С .epf unpacker) — compiled from source if available
# RUN git clone --depth=1 https://github.com/e8tools/v8unpack /tmp/v8unpack && \
#     cd /tmp/v8unpack && cmake . && make && cp v8unpack /usr/local/bin/ && rm -rf /tmp/v8unpack

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/src/generated ./src/generated
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
