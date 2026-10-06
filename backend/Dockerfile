# =============================================================================
# Multi-Stage Production Dockerfile for HES Logistics Platform API
# Compliant with Security Hardening & Zero-Vulnerability Standards
# Standalone Enterprise Bundle Architecture
# =============================================================================

# Stage 1: Native Addon Builder & Schema Generator
FROM node:20-alpine AS builder

WORKDIR /app

# Cached compilation toolchain
RUN apk add --no-cache python3 make g++ && \
    npm install -g node-gyp node-addon-api

# Copy pre-bundled standalone bundle and native dependency sources
COPY bundled ./bundled
COPY vendor/argon2 ./node_modules/argon2
COPY prisma ./prisma
COPY package.json ./

# Compile native argon2 addon and generate Prisma client for linux-musl
RUN cd node_modules/argon2 && node-gyp rebuild && \
    cd /app && npx -y prisma@6.4.1 generate

# Stage 2: Hardened Minimal Production Runtime (Zero Attack Surface)
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NODE_OPTIONS="--dns-result-order=ipv4first"

# Copy compiled native modules and generated Prisma client
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/bundled/index.js ./dist/main.js
COPY package.json ./

# Non-root secure execution
USER node

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/v1/health || exit 1

CMD ["node", "dist/main.js"]
