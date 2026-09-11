# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

RUN npm install -g pnpm@11.5.2

COPY package.json pnpm-lock.yaml* ./

RUN pnpm install --frozen-lockfile=false

COPY . .

RUN pnpm prisma:generate && pnpm build

# Stage 2: Production Runner
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

RUN npm install -g pnpm@11.5.2

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --prod --frozen-lockfile=false

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.pnpm/@prisma+client* ./node_modules/.pnpm/

USER node

EXPOSE 3000

CMD ["node", "dist/main.js"]
