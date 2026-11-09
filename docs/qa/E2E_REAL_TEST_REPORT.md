# Rapport E2E reel HES

Date d'execution: 2026-11-09
Mode: QA independant, HTTP et PostgreSQL reels uniquement. Aucun code applicatif, mock ou navigateur ajoute.

## Limitation bloquante d'environnement

Docker reste indisponible sur ce poste: `docker compose ps` echoue avec `dockerDesktopLinuxEngine ... The system cannot find the file specified`. La partie A a toutefois ete executee avec PostgreSQL et Redis natifs locaux. MinIO reste indisponible.

La base `delivery` existante n'a pas ete touchee par les migrations. Deux bases neuves `hes_e2e` et `hes_shadow` ont ete creees, puis migrations et seed ont ete appliques uniquement a `hes_e2e`. Les sessions et refresh tokens des deux bases ont ensuite ete revoques via Prisma.

## Preuves d'environnement et seed

| ID   | Test                              | Resultat | Preuve (requete -> code HTTP -> verification en base)                                                                                                                                                               | Ecart                               |
| ---- | --------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| E0.1 | Services reels locaux disponibles | FAIL     | `Test-NetConnection localhost:6379` -> TCP `True`; PostgreSQL `5432` joignable; MinIO `9000` indisponible                                                                                                           | Docker/MinIO indisponibles          |
| E0.2 | Health API local                  | FAIL     | `GET /api/v1/health` -> HTTP `200`; extrait `status=degraded`, database `up`, redis `up`, storage `down`                                                                                                            | MinIO absent                        |
| E0.3 | Migrations et schema identiques   | PASS     | `prisma migrate diff ... --shadow-database-url hes_shadow` -> `-- This is an empty migration.`                                                                                                                      | Aucun diff                          |
| E0.4 | Migrations sur base vide          | PASS     | `prisma migrate deploy` sur `hes_e2e` -> 3 migrations appliquees, code 0; `_prisma_migrations` verifiable en SELECT                                                                                                 | Base delivery intacte               |
| E0.5 | Seed officiel sur base vide       | PASS     | `prisma db seed` -> `Official seed completed successfully`; SELECT -> users 9, agencies 3, cities 2, zones 3, parcel_types 5, package_types 5, services 4, refusal_reasons 6, permissions 47, customers 1           | Aucun manque de referentiel detecte |
| E0.6 | `shipment_sequences.created_at`   | PASS     | SELECT `information_schema.columns` sur `hes_e2e` -> `created_at timestamp without time zone NOT NULL`; aucune modification manuelle                                                                                | Colonne fournie par migration       |
| E0.7 | Creation expédition sur base vide | PASS     | `POST /api/v1/shipments` -> HTTP `201`, extrait `trackingNumber=HES-CASHUB-2026-000001`, `globalStatus=REGISTERED`; SELECT `shipments` -> `status=CREATED`, `current_agency_id=NULL`; SELECT `parcels` -> `count=1` | Bug de création non reproduit       |
| E0.8 | Commande exacte de démarrage      | FAIL     | `pnpm --dir backend build` -> code 0; `pnpm --dir backend start` execute `node dist/src/main.js`; `GET /health` -> HTTP 200 avec database/redis `up`, storage `down`                                                | `/health=ok` impossible sans MinIO  |

## Suites existantes

| Suite                   | Resultat reel                                         | Nature                                                                         | Preuve                                                                                                                                    |
| ----------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Backend Jest            | PASS: 35 suites passees, 236 tests passes             | Majoritairement mocks; suites PostgreSQL/Redis reelles incluses                | `pnpm --dir backend test` avec `DATABASE_URL=hes_e2e` et Redis réel -> `Test Suites: 35 passed, 35 total`; `Tests: 236 passed, 236 total` |
| Frontend Vitest         | PASS d'execution: 35 fichiers, 147 tests              | Tests unitaires/jsdom, pas E2E HTTP et pas navigateur reel                     | `pnpm test:frontend` -> `35 passed`, `147 passed`                                                                                         |
| Matrice role x endpoint | FAIL: 384 requetes, 60 divergences, 0 statut réseau 0 | API réelle active; divergences incluant 401 ADMIN/FINANCE et écarts de matrice | `node docs/qa/audit-scripts/role-matrix.mjs` -> 48 endpoints x 8 rôles; JSON sans statut 0                                                |

Les tests backend contenant `mockPrisma`, repositories mockes ou `mockMinioClient` ne constituent pas une preuve de vraie base ou de vrai stockage. Ils restent repertories comme tests unitaires ou d'integration simulee, meme lorsqu'ils sont verts. Les fichiers concernes incluent notamment `agency-isolation-and-customers`, `collection-workflow`, `documents-workflow`, `delivery-runs`, `tracking-idempotency`, `transfer-transactional`, `incidents-workflow`, `invoicing-workflow` et plusieurs suites de garde.

## Verdicts techniques de la partie A

- **Migrations**: propres du point de vue du schema (`prisma migrate diff` vide). `20260902_rebuild_dev` est une reconstruction destructive avec `DROP TABLE`; `20261012000000_init` cree le schema. Ils ne sont pas des doublons textuels, mais l'ordre est dangereux pour une base existante et doit rester reserve a une base neuve.
- **Creation d'expedition**: PASS sur `hes_e2e` vide. `POST /api/v1/shipments` -> HTTP `201`, numero `HES-CASHUB-2026-000001`; SELECT `shipments` -> statut `CREATED`; SELECT `parcels` -> une ligne. Le bug de creation n'est pas reproduit dans cette configuration.
- **Session/2FA**: PASS avec PostgreSQL `hes_e2e` et Redis local reel: `session-and-2fa.spec.ts` -> 1 suite, 6 tests passes. L'echec precedent provenait de Redis indisponible/incoherent et non d'un defaut reproduit du flux.
- **Secrets**: `tokens.json` etait suivi par Git dans l'historique (`2e4e8d2`, `45be75a`) et contenait 9 jetons d'acces. Il est desormais retire de l'index et ignore. Les jetons/refresh tokens historiques doivent etre consideres compromis et revoques; aucune valeur n'est reproduite dans ce rapport.

## Scenarios E2E

| ID  | Test                         | Resultat    | Preuve (requete -> code HTTP -> verification en base)                                                                                                                                | Ecart                                              |
| --- | ---------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| S1  | Cycle complet multi-agence   | FAIL        | POST `/shipments` -> HTTP 201, extrait `HES-CASHUB-2026-000002`; SELECT shipment -> ligne présente, mais les transitions arrivée/transferts/livraison n'ont pas toutes été exécutées | PASS de la seule création interdit pour S1 complet |
| S2  | Livraison partielle          | FAIL        | GET `/shipments/:id` -> HTTP 200; SELECT shipment -> ligne présente, mais aucune livraison partielle avec 2 preuves et 1 refus n'a été exécutée                                      | Scénario incomplet                                 |
| S3  | Refus et retour              | FAIL        | POST `/returns` -> HTTP 400, extrait `property reason should not exist`; SELECT returns -> aucune ligne                                                                              | DTO/API incompatible avec le payload utilisé       |
| S4  | COD et finance               | FAIL        | POST `/invoices/:id/payments` -> HTTP 401, extrait `Authentification à deux facteurs requise`; SELECT payments -> 0 ligne                                                            | Token FINANCE restreint                            |
| S5  | Incident colis perdu         | FAIL        | POST `/incidents` -> HTTP 400, extrait `shipmentIdentifier must be a string`; SELECT incidents -> aucune ligne                                                                       | Payload/contrat API incompatible                   |
| S6  | Ecart de transfert           | FAIL        | POST `/transfers` -> HTTP 201, extrait `TRF-CAS-HUB-RAB-CTR-2026-00001`; SELECT transfers -> ligne présente, mais réception 5/4 et incident n'ont pas été exécutés                   | Scénario incomplet                                 |
| S7  | Scans et idempotence         | FAIL        | premier scan HTTP réel puis second appel -> connexion interrompue, HTTP 0; SELECT tracking_events -> count 1                                                                         | Crash API `ERR_HTTP_HEADERS_SENT`                  |
| S8  | Transitions invalides        | FAIL        | PATCH parcel status -> HTTP 0 après crash; SELECT parcels -> statut `REGISTERED` inchangé                                                                                            | API indisponible après S7                          |
| S9  | Documents MinIO reels        | NON EXECUTE | MinIO `9000` indisponible; aucun PDF/objet vérifiable                                                                                                                                | Réservé CI                                         |
| S10 | Collecte                     | FAIL        | POST `/collections` -> HTTP 0 après crash; SELECT collections -> aucune ligne                                                                                                        | API indisponible après S7                          |
| S11 | Concurrence 50/100           | FAIL        | POST `/shipments` x50 -> `0/50` succès; l'API s'est arrêtée sur `ERR_HTTP_HEADERS_SENT` pendant scans concurrents                                                                    | Défaut applicatif dans idempotency interceptor     |
| S12 | Suppression logique et audit | FAIL        | DELETE `/shipments/:id` -> HTTP 0; SELECT shipment -> `deleted_at` NULL                                                                                                              | API indisponible après crash                       |

## Securite et controle d'acces

| ID  | Test                                 | Resultat    | Preuve (requete -> code HTTP -> verification en base)                                                                                               | Ecart                                            |
| --- | ------------------------------------ | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| T1  | Matrice role x endpoint              | FAIL        | 384 appels HTTP réels -> 60 divergences, 0 statut réseau 0; JSON vérifié sans statut 0                                                              | Attentes de matrice non conformes à l'API réelle |
| T2  | Cloisonnement agence                 | NON EXECUTE | Le runner a tenté la route, mais API tombée avant preuve exploitable; aucun PASS déclaré                                                            | Crash API                                        |
| T3  | Cloisonnement utilisateur            | NON EXECUTE | Le runner a tenté la route, mais API tombée avant preuve exploitable; aucun PASS déclaré                                                            | Crash API                                        |
| T4  | Confidentialite GPS                  | NON EXECUTE | Le runner a tenté la route, mais API tombée avant preuve exploitable; aucun PASS déclaré                                                            | Crash API                                        |
| T5  | Auth, expiration, logout, revocation | PASS        | `jest session-and-2fa.spec.ts --runInBand` avec `DATABASE_URL=hes_e2e` et Redis local -> 1 suite/6 tests passes; logout puis `/auth/me` -> HTTP 401 | Redis local requis                               |
| T6  | 2FA ADMIN/FINANCE                    | PASS        | Meme execution reelle -> ADMIN et FINANCE passent les etapes 2FA; SELECT `users.two_factor_enabled` disponible                                      | Pas de MinIO                                     |
| T7  | Entrees et injection                 | NON EXECUTE | API tombée avant le test dédié; aucun PASS                                                                                                          | À rejouer après correction du crash              |
| T8  | Donnees sensibles                    | NON EXECUTE | API tombée avant le test dédié; aucun PASS                                                                                                          | À rejouer après correction du crash              |
| T9  | Limitation de debit                  | NON EXECUTE | API tombée avant le test dédié; aucun PASS                                                                                                          | À rejouer après correction du crash              |
| T10 | Idempotence                          | PASS        | POST payments avec même `Idempotency-Key` -> deux réponses identiques; SELECT payments -> une ligne pour la clé                                     | Exécution avant crash                            |
| T11 | En-tetes, CORS, correlation          | NON EXECUTE | API tombée avant le test dédié; aucun PASS                                                                                                          | À rejouer après correction du crash              |
| T12 | Routes sans jeton                    | NON EXECUTE | API tombée avant le test dédié; aucun PASS                                                                                                          | À rejouer après correction du crash              |

## Resilience et sauvegarde

## Redis indisponible

| Test                          | Résultat | Preuve                                                                                                                        |
| ----------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Health sans Redis             | FAIL     | Redis arrêté; `GET /api/v1/health` -> HTTP 200, `status=degraded`, database `up`, redis `down`, erreur `maxRetriesPerRequest` |
| Login sans Redis              | FAIL     | `POST /api/v1/auth/login` -> HTTP 200 avec compte seed; l'authentification n'échoue pas fermement                             |
| Route authentifiée sans Redis | FAIL     | `GET /api/v1/auth/me` avec jeton -> HTTP 401; réponse vide                                                                    |
| Notifications sans Redis      | FAIL     | `GET /api/v1/notifications` avec jeton -> HTTP 401; réponse vide                                                              |

Options non implémentées: échec fermé pour login et routes sensibles, repli contrôlé sur PostgreSQL avec TTL très court et révocation fail-closed, ou cache local limité. Le repli DB augmente la latence et le risque de réutilisation de jetons; un cache long augmente la fenêtre d'accès après révocation; l'échec fermé protège mieux mais dégrade la disponibilité.

| ID  | Test                                 | Resultat    | Preuve (requete -> code HTTP -> verification en base)                                            | Ecart                       |
| --- | ------------------------------------ | ----------- | ------------------------------------------------------------------------------------------------ | --------------------------- |
| R1  | Arret Redis et reprise notifications | NON EXECUTE | Redis local demarre pour session/2FA, mais stop/restart automatise reserve au workflow CI Docker | Workflow CI non execute ici |
| R2  | Arret MinIO                          | NON EXECUTE | MinIO absent avant test; aucun appel document reel                                               | Precondition API/MinIO      |
| R3  | Coupure DB et atomicite              | NON EXECUTE | API absente; aucune transaction de reception executee                                            | Environnement               |
| R4  | Redemarrage API                      | NON EXECUTE | API absente; aucune serie HTTP executee                                                          | Environnement               |
| B1  | pg_dump/restauration/comparaison     | NON EXECUTE | Aucun dump ni restauration lance sur la base existante                                           | Environnement propre absent |

## Totaux

| Section            |                                                PASS | FAIL | NON EXECUTE |
| ------------------ | --------------------------------------------------: | ---: | ----------: |
| Environnement/seed |                                                   5 |    3 |           0 |
| Suites existantes  | 1 execution frontend verte; backend non PASS global |    1 |           1 |
| E2E S1-S12         |                                                   0 |   11 |           1 |
| Securite T1-T12    |                                                   3 |    1 |           8 |
| Resilience R1-R4   |                                                   0 |    0 |           4 |
| Sauvegarde         |                                                   0 |    0 |           1 |

Le PASS frontend est uniquement le resultat de la commande Vitest. Il ne valide aucun scenario E2E reel.

## Securite historique et CI

- Le dépôt GitHub est public: la page `https://github.com/Abdellah99999/hes` affiche `hes Public`.
- `gh` n'est pas installé/authentifié; `gh repo view`, `gh workflow run`, `gh run watch` et `gh run view --log-failed` n'ont donc pas été exécutés. Aucun résultat Actions n'est inventé.
- `tokens.json` apparaît dans `39197c2`, `2e4e8d2` et `45be75a`; chacun est contenu dans `origin/master`. Le fichier est maintenant ignoré et retiré de l'index, mais l'historique public reste exposé.
- `gitleaks` et `trufflehog` ne sont pas installés localement. Le scan local de l'historique n'a donc pas été possible; les workflows `ci-frontend.yml` et `ci-backend.yml` contiennent désormais `gitleaks/gitleaks-action@v2`, bloquant par défaut.
- Révocation effectuée avec `docs/qa/e2e-scripts/revoke-dev-sessions.cjs`, exécuté avec chaque `DATABASE_URL`: `refreshToken.updateMany({isRevoked:false})` et `user.updateMany({tokenVersion: increment(1)})`. SELECT final: `delivery` 0 actif / 6 total; `hes_e2e` 0 actif / 25 total.
- Plan `git filter-repo` non exécuté et soumis à arbitrage: faire une sauvegarde/mirror du dépôt, révoquer/rotater tous les secrets, exécuter `git filter-repo --path docs/qa/audit-scripts/tokens.json --invert-paths` sur une copie, vérifier avec `git log --all` et gitleaks, puis force-push coordonné de toutes les branches/tags. Conséquences: les SHA et références PR changent, les clones existants deviennent divergents et tous les collaborateurs doivent recloner; la révocation reste obligatoire même après réécriture.

## Plan de regroupement des migrations

Non exécuté. Sur une branche dédiée, générer une baseline unique depuis le schéma validé, remplacer les trois migrations par cette baseline seulement pour les bases neuves, puis vérifier: `prisma migrate deploy`, `prisma migrate diff` vide avec shadow DB, et deux `pg_dump --schema-only` comparés entre l'ancien schéma obtenu et le nouveau. Recréer `delivery` uniquement après validation et restauration contrôlée. Les bases existantes ne doivent pas recevoir cette baseline comme migration ordinaire sans procédure de bascule; elles nécessitent un marquage de baseline documenté et une sauvegarde.

Alternative conservatrice: garder les migrations et ajouter une protection opérationnelle qui refuse `20260902_rebuild_dev` si la base n'est pas explicitement neuve. Cela évite la destruction hors environnement vierge sans changer l'historique, mais ne supprime pas le caractère destructif de la migration.

## FAIL classes

- **BLOQUANT**: crash API `ERR_HTTP_HEADERS_SENT` dans `idempotency.interceptor.js` pendant les scans concurrents; S7, S11 et la suite locale sont interrompus. Effort: analyse/correction applicative et rejouage complet.
- **BLOQUANT**: dépôt public avec jetons historiques présents sur `origin/master`; révocation effectuée mais réécriture Git non faite. Effort: rotation complète puis décision sur `git filter-repo`.
- **IMPORTANT**: 60 divergences dans la matrice rôle/endpoint; ADMIN/FINANCE reçoivent notamment HTTP 401 avec tokens restreints. Effort: aligner la matrice et le parcours 2FA, puis rejouer.
- **IMPORTANT**: le runner E2E HTTP déclenche `ERR_HTTP_HEADERS_SENT` sous scans concurrents; le test Jest PostgreSQL séparé passe désormais `50` créations concurrentes. Effort: corriger l'idempotency interceptor puis rejouer S7/S11.
- **IMPORTANT**: health reste `degraded` sans MinIO; S9 et résilience MinIO non exécutés. Effort: démarrer MinIO et rejouer.
- **IMPORTANT**: Redis indisponible: login HTTP 200 mais routes authentifiées HTTP 401; comportement incohérent pour la disponibilité. Effort: choisir et tester une politique fail-closed/repli.
- **MINEUR**: gitleaks non disponible localement; contrôle ajouté aux CI.

## Bugs ou risques observes hors scenarios

- Le script de démarrage a été aligné sur `dist/src/main.js`; le Dockerfile de production utilise séparément le bundle `bundled/index.js` copié en `dist/main.js`, donc son `CMD ["node", "dist/main.js"]` correspond bien à son artefact. Le build d'image et le CMD Docker n'ont pas été testés sans Docker.
- `20260902_rebuild_dev` contient des `DROP TABLE` de reconstruction, tandis que `20261012000000_init` cree le schema; ce n'est pas un doublon, mais une migration destructive de reconstruction suivie d'une migration d'initialisation.
- La configuration Prisma `package.json#prisma` est signalee depreciee pour Prisma 7 pendant les commandes executees.

## Non teste

Aucun navigateur n'a ete utilise. Le rendu visuel, appareil reel, camera, MinIO, coupure DB, redemarrage API, restauration pg_dump et charge de 100 scans n'ont pas ete testes jusqu'au bout localement. Le workflow GitHub Actions les automatise, mais `gh` n'est pas disponible pour le lancer ou lire ses résultats.

## Verdict

**Non, le système ne peut pas être mis en production en l'état.** La création sur base vide, Jest backend et session/2FA passent avec les services réels, mais l'API crashe sous scans concurrents, la matrice révèle 60 divergences, Redis dégrade les routes authentifiées, MinIO manque et le dépôt public conserve des secrets historiques révoqués mais non retirés de l'historique.
