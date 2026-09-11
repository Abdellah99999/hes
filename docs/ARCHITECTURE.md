# Architecture du projet

## Vue d'ensemble

Ce projet est une plateforme de transport et logistique multi-agences, mono-entreprise.

- Backend NestJS : logique métier, autorisations, Prisma, Redis, MinIO, API REST
- Frontend React/Vite : interface utilisateur et consommation de l’API
- Mobile : client et livreur
- Infrastructure : Docker, NGINX, scripts, monitoring

## Règles de séparation

- Le frontend ne doit jamais accéder directement à PostgreSQL, Redis, Prisma, MinIO ou aux secrets backend.
- Le backend est le seul service applicatif avec accès aux ressources de données.
- Le frontend communique uniquement via HTTP vers l’API REST du backend.

## Flux

Frontend -> HTTP/HTTPS -> Backend REST API -> Business Logic -> Prisma -> PostgreSQL

## Modules métier

Le backend contient les modules de transport/logistique, notamment :

- auth
- users
- agencies
- zones
- customers
- addresses
- shipments
- parcels
- tracking
- scans
- collections
- routes
- deliveries
- returns
- incidents
- invoices
- payments
- documents
- notifications
- reports
- audit

## Permissions

Les permissions restent gérées par le backend et vérifiées à chaque appel sensible.

Le frontend ne fait que masquer ou afficher les actions selon les permissions obtenues via l’API.

## Données

- Les données métier importantes utilisent soft delete et audit logs.
- Les statuts sont gérés côté backend.
- Les flux de transfert, livraison et retour doivent conserver l’historique et le contexte d’agence.
