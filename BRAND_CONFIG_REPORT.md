# Rapport de configuration de marque

## Résultat

La marque par défaut est désormais `Car Rental Platform`.

- Backend : `APP_NAME` est lu par la configuration NestJS et utilisé par Swagger, les logs et les générateurs PDF.
- Frontend : `NEXT_PUBLIC_APP_NAME` est exposée à Vite et exportée par `frontend/src/lib/config.ts` sous le nom `APP_NAME`.
- Les textes de marque présents dans la navigation, la connexion, le statut, les agences et les collectes utilisent cette variable.
- Les préfixes de tracking, clés de stockage, cookies et identifiants techniques `hes`/`HES` n'ont pas été modifiés.

## Fichiers modifiés

- `.env.example`
- `backend/.env.example`
- `backend/src/config/configuration.ts`
- `backend/src/config/env.validation.ts`
- `backend/src/main.ts`
- `backend/src/modules/documents/generators/parcel-label.generator.ts`
- `backend/src/modules/reports/application/use-cases/export-report.use-case.ts`
- `backend/src/scripts/export-openapi.ts`
- `frontend/.env.example`
- `frontend/.env.local`
- `frontend/index.html`
- `frontend/vite.config.ts`
- `frontend/src/vite-env.d.ts`
- `frontend/src/lib/config.ts`
- `frontend/src/App.tsx`
- `frontend/src/features/auth/pages/LoginPage.tsx`
- `frontend/src/features/system-status/SystemStatusPage.tsx`
- `frontend/src/features/system-status/SystemStatusPage.spec.tsx`
- `frontend/src/features/agencies/pages/AgenciesPage.tsx`
- `frontend/src/features/collections/pages/CustomerRequestCollectionPage.tsx`
- `README.md`

## Vérifications

La recherche exhaustive hors `node_modules`, `.git` et `__pycache__` ne trouve aucune occurrence de `ABIT CAR` ou `AbitCar` dans le dépôt. Les occurrences techniques `HES-` des numéros de tracking et `hes_*` des ressources internes sont volontairement conservées.

Le build frontend avec `NEXT_PUBLIC_APP_NAME="Car Rental Platform"` a réussi. Le test de composant de la page de statut vérifie également la valeur exportée par la configuration frontend. Le backend lit `APP_NAME` via `ConfigService` dans les surfaces API/PDF.

Ce dépôt est NestJS + React/Vite : il ne contient pas les templates FastAPI, emails WhatsApp, pages Next.js, sitemap, robots ou pages légales cités dans la demande initiale. Aucun test visuel navigateur n'a été exécuté car ces pages n'existent pas dans cette version; les surfaces réellement présentes ont été couvertes par compilation et test ciblé.
