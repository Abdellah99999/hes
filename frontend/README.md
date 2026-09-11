# Frontend

Application React + Vite du système de transport logistique.

## Stack

- React
- TypeScript
- Vite
- TanStack Query
- React Hook Form
- Zod

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

## Configuration

Le frontend n’accède au backend qu’à travers `VITE_API_URL` :

```env
VITE_API_URL=http://localhost:3000/api/v1
```

## Règle de séparation

- pas d’accès direct à PostgreSQL
- pas de Prisma
- pas de secrets backend
- pas de logique métier backend dans le frontend
