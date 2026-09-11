# Plan de reconstruction de la base de données delivery

## Objectif

Recréer proprement la base PostgreSQL locale pour le projet HES, en gardant le métier existant et la règle d’architecture :

- une seule entreprise
- non multitenant
- plusieurs agences dans la même ville
- chaque agence possède son propre stock opérationnel
- mêmes opérations pour toutes les agences

Aucune colonne `tenant_id`, `organization_id` ou `company_id` ne doit être ajoutée pour du multitenancy.

## Pré-requis

- PostgreSQL 18 local
- base cible : `delivery`
- utilisateur : `postgres`
- mot de passe local : `0000`
- URL locale attendue : `postgresql://postgres:0000@localhost:5432/delivery`

## Sécurité

- Le vrai mot de passe ne doit pas être committé.
- Le fichier réel de configuration local reste dans `backend/.env`.
- Les fichiers du repo restent des templates fictifs, pas des secrets réels.

## Étape 1 : arrêt de la base courante

Avant toute reconstruction, il faut arrêter ou isoler les connexions actives à la base `delivery`.

Commande de référence :

```sql
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = 'delivery' AND pid <> pg_backend_pid();
```

## Étape 2 : suppression de la base courante

Commande de référence :

```sql
DROP DATABASE IF EXISTS delivery;
```

## Étape 3 : recréation de la base

```sql
CREATE DATABASE delivery
  WITH OWNER = postgres
  ENCODING = 'UTF8'
  LC_COLLATE = 'en_US.utf8'
  LC_CTYPE = 'en_US.utf8'
  TABLESPACE = pg_default
  CONNECTION LIMIT = -1;
```

## Étape 4 : génération du schéma Prisma

Le schéma source de vérité est dans :

- `backend/prisma/schema.prisma`

Commande de référence :

```bash
cd backend
npx prisma generate
npx prisma migrate reset --force
```

## Étape 5 : validation fonctionnelle

Après la recréation, valider impérativement :

- connexion Prisma ok
- modules d’auth ok
- agences / zones ok
- customers ok
- shipments / parcels ok
- tracking events ok
- transfers ok
- collections ok
- deliveries ok
- returns ok
- incidents ok
- invoices ok
- documents ok
- notifications ok

## Étape 6 : vérification de la structure modélisée

Vérifier que les règles métier suivantes sont respectées :

- `Agency` est l’unité d’organisation opérationnelle
- plusieurs `Agency` peuvent cohabiter dans une même ville
- les stocks opérationnels sont spécifiques à chaque agence
- il n’existe pas de notion de tenant / organization / company pour le multitenancy

## Blocage actuel de l’environnement

L’exécution de ces commandes n’a pas pu être faite dans cet environnement car :

- Docker Desktop n’est pas démarré / inaccessible
- le client PostgreSQL `psql` n’est pas installé

La destruction de la base et la reconstruction doivent donc être lancées sur un environnement local avec PostgreSQL actif.

## Fichiers concernés

- `backend/prisma/schema.prisma`
- `backend/.env`
- `backend/.env.example`
- `docker-compose.yml`
- `backend/src/config/env.validation.ts`
- `backend/src/config/configuration.ts`

## Validation de fin

Une fois la base recréée, valider :

```bash
cd backend
npx prisma validate
npx prisma migrate status
pnpm test
pnpm build
```
