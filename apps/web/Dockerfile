# syntax=docker/dockerfile:1
#
# dev — ng serve inside a container; production — static files served by Caddy.
# Both stages use the same code and the same contracts from apps/api.

FROM node:26-slim AS base
WORKDIR /app/apps/web
ENV NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_AUDIT=false

# ── deps ─────────────────────────────────────────────────────────────────────
FROM base AS deps
COPY apps/web/package.json apps/web/package-lock.json* ./
RUN npm ci

# ── dev ──────────────────────────────────────────────────────────────────────
FROM base AS dev
ENV NODE_ENV=development
COPY --from=deps /app/apps/web/node_modules ./node_modules
COPY apps/web/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["npm", "start"]

# ── build ────────────────────────────────────────────────────────────────────
FROM deps AS build
# Contracts live in apps/api — the frontend takes types from them via the @contracts/* alias.
COPY apps/api/src/contracts /app/apps/api/src/contracts
COPY apps/web/ ./
RUN npm run build

# ── caddy: TLS, Angular static files and the /api proxy ──────────────────────
FROM caddy:2-alpine AS caddy
COPY infra/caddy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/apps/web/dist/web/browser /srv
