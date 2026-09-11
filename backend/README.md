# Backend

Application NestJS du système de transport logistique.

## Stack

- NestJS
- TypeScript
- Prisma
- PostgreSQL
- Redis
- MinIO
- JWT / Passport
- Swagger OpenAPI

## Démarrage

```bash
pnpm install
pnpm dev
```

## Build

```bash
pnpm build
```

## Tests

```bash
pnpm test
```

## Swagger

```text
http://localhost:3000/api/v1/docs
```

## Variables d’environnement

Conserver dans `.env` côté backend :

- `DATABASE_URL`
- `REDIS_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `MINIO_SECRET_KEY`
