# Transport Logistique

## Architecture

Ce dépôt est désormais structuré selon une séparation claire entre backend et frontend :

- `backend/` : application NestJS dédiée à l’API backend
- `frontend/` : application React/Vite dédiée à l’interface utilisateur
- `mobile/` : clients mobiles pour les utilisateurs et les livreurs
- `infrastructure/` : scripts, Docker, NGINX et utilitaires infra
- `docker-compose.yml` : orchestration locale des services applicatifs et infrastructure

## Principe de séparation

- Le frontend ne communique qu’avec l’API REST du backend.
- Le backend est l’unique point d’accès à PostgreSQL, Redis et MinIO.
- Les variables sensibles restent côté backend.
- Le frontend ne reçoit que des variables exposables au navigateur, notamment `VITE_API_URL`.

## Accès API

Le backend expose l’API sous la forme :

- `/api/v1/...`
- Swagger/OpenAPI : `/api/v1/docs`

## Prérequis

- Node.js 20+
- pnpm 11+
- Docker / Docker Compose
- PostgreSQL, Redis, MinIO via Docker Compose

## Installation

```bash
pnpm install
```

## Lancer le backend

```bash
pnpm --dir backend install
pnpm --dir backend dev
```

## Lancer le frontend

```bash
pnpm --dir frontend install
pnpm --dir frontend dev
```

## Lancer via Docker Compose

```bash
docker compose up -d --build
```

## Variables d’environnement

### Backend

Le nom de marque affiché par l'API et les documents se change en une seule étape :

- modifier `APP_NAME` dans `backend/.env` ;
- aucune autre modification de code backend n'est nécessaire.

Les variables sensibles restent dans le backend, par exemple :

- `DATABASE_URL`
- `REDIS_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `MINIO_SECRET_KEY`

### Frontend

Le nom de marque affiché par l'interface se change en une seule étape :

- modifier `NEXT_PUBLIC_APP_NAME` dans `frontend/.env.local` ;
- aucune autre modification de code frontend n'est nécessaire.

Le frontend ne reçoit que :

- `VITE_API_URL`
- `NEXT_PUBLIC_APP_NAME`

## Tests

```bash
pnpm --dir backend test
pnpm --dir frontend test
```

## Build

```bash
pnpm --dir backend build
pnpm --dir frontend build
```

## Swagger

Le backend expose la documentation Swagger sur :

- `http://localhost:3000/api/v1/docs`

## Sécurité

- Le frontend ne doit jamais contenir de secrets backend.
- Les secrets ne doivent pas être commités.
- Les scans de sécurité du bundle frontend restent nécessaires avant livraison.
