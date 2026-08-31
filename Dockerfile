# Billator — multi-stage, ARM64-friendly build.
# The image is built on the Raspberry Pi itself (native arm64) via deploy.sh.
# better-sqlite3 is a native module, so the deps stage includes build tools.

FROM node:22-alpine AS deps
WORKDIR /app
# Copy manifests first to leverage Docker layer caching.
COPY package.json package-lock.json ./
# point at the public registry (lock no longer references internal artifactory).
ENV NODE_OPTIONS=--max-old-space-size=1536
RUN apk add --no-cache python3 make g++ \
    && npm config set registry "https://registry.npmjs.org/" \
    && npm config set replace-registry-host always \
    && npm ci --no-audit --no-fund --maxsockets 2

FROM node:22-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN apk add --no-cache make g++ python3 \
    && npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs \
    && mkdir -p /app/data \
    && chown -R nextjs:nodejs /app

# standalone server + static assets (see next.config.ts `output: standalone`).
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000
VOLUME ["/app/data"]

CMD ["node", "server.js"]
