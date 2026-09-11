# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

RUN npm install -g pnpm@11.5.2

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile=false

COPY . .
RUN pnpm build

# Stage 2: Serve via Nginx
FROM nginx:1.27-alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
