# syntax=docker/dockerfile:1
#
# One image, two roles (api / worker), as ARCHITECTURE.md requires.
# There is no build step: Node 26 strips types and runs .ts directly, so the production
# stage copies sources rather than a dist/ directory.

FROM node:26-slim AS base
# argon2 installs from a prebuilt binary (prebuilds/linux-{arm64,x64}), so the image needs
# no compiler. node_modules still never arrive from the host, though: built on macOS they
# would not run inside a Linux container — which is exactly why they live in a named volume.
WORKDIR /app/apps/api
ENV NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_AUDIT=false

# ── deps ─────────────────────────────────────────────────────────────────────
FROM base AS deps
COPY apps/api/package.json apps/api/package-lock.json* ./
RUN npm ci

# ── dev ──────────────────────────────────────────────────────────────────────
# Code arrives through a bind mount, node_modules through a named volume. The entrypoint
# installs dependencies when the volume is empty or package.json is newer.
FROM base AS dev
ENV NODE_ENV=development
COPY --from=deps /app/apps/api/node_modules ./node_modules
COPY apps/api/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["npm", "run", "dev"]

# ── production ───────────────────────────────────────────────────────────────
FROM base AS production
ENV NODE_ENV=production
COPY apps/api/package.json apps/api/package-lock.json* ./
RUN npm ci --omit=dev
COPY apps/api/tsconfig.json ./tsconfig.json
COPY apps/api/src ./src
COPY apps/api/db ./db
USER node
EXPOSE 3000
CMD ["node", "src/api.ts"]
