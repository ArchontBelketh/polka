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

# ── Scanner tools ─────────────────────────────────────────────────────────────
FROM python:3.12-slim AS scanner-tools
RUN pip install --no-cache-dir bandit semgrep olevba --break-system-packages || \
    pip install --no-cache-dir bandit semgrep olevba

# ── Builder ───────────────────────────────────────────────────────────────────
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# ── Runner ────────────────────────────────────────────────────────────────────
FROM node:22-slim AS runner
WORKDIR /app

# Python + scanner tools
RUN apt-get update && apt-get install -y python3 python3-pip git --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*
COPY --from=scanner-tools /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=scanner-tools /usr/local/bin/bandit /usr/local/bin/bandit
COPY --from=scanner-tools /usr/local/bin/semgrep /usr/local/bin/semgrep
COPY --from=scanner-tools /usr/local/bin/olevba  /usr/local/bin/olevba

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
