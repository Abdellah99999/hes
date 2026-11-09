# Rapport E2E reel HES

Date d'execution: 2026-11-09
Mode: QA independant, HTTP et PostgreSQL reels uniquement. Aucun code applicatif, mock ou navigateur ajoute.

## Limitation bloquante d'environnement

Docker reste indisponible sur ce poste: `docker compose ps` echoue avec `dockerDesktopLinuxEngine ... The system cannot find the file specified`. La partie A a toutefois ete executee avec PostgreSQL et Redis natifs locaux. MinIO reste indisponible.

La base `delivery` existante n'a pas ete touchee. Deux bases neuves `hes_e2e` et `hes_shadow` ont ete creees, puis migrations et seed ont ete appliques uniquement a `hes_e2e`.

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

## Suites existantes

| Suite                   | Resultat reel                                                                    | Nature                                                                                                                                               | Preuve                                                                           |
| ----------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Backend Jest            | FAIL: 35 suites passees, 1 echouee; 1 suite en echec (`session-and-2fa.spec.ts`) | Majoritairement mocks; `shipment-concurrency-postgres.spec.ts` utilise PostgreSQL reel; `session-and-2fa` utilise PostgreSQL/Redis reels mais echoue | `pnpm test:backend`; erreurs HTTP attendues 200/401 et `Connection is closed`    |
| Frontend Vitest         | PASS d'execution: 35 fichiers, 147 tests                                         | Tests unitaires/jsdom, pas E2E HTTP et pas navigateur reel                                                                                           | `pnpm test:frontend` -> `35 passed`, `147 passed`                                |
| Matrice role x endpoint | NON EXECUTE comme controle valide                                                | Le script a emis 384 requetes, mais chaque resultat est `0` (erreur reseau); son `0 divergence` est invalide                                         | `node docs/qa/audit-scripts/role-matrix.mjs`; fichier `role-matrix-results.json` |

Les tests backend contenant `mockPrisma`, repositories mockes ou `mockMinioClient` ne constituent pas une preuve de vraie base ou de vrai stockage. Ils restent repertories comme tests unitaires ou d'integration simulee, meme lorsqu'ils sont verts. Les fichiers concernes incluent notamment `agency-isolation-and-customers`, `collection-workflow`, `documents-workflow`, `delivery-runs`, `tracking-idempotency`, `transfer-transactional`, `incidents-workflow`, `invoicing-workflow` et plusieurs suites de garde.

## Verdicts techniques de la partie A

- **Migrations**: propres du point de vue du schema (`prisma migrate diff` vide). `20260902_rebuild_dev` est une reconstruction destructive avec `DROP TABLE`; `20261012000000_init` cree le schema. Ils ne sont pas des doublons textuels, mais l'ordre est dangereux pour une base existante et doit rester reserve a une base neuve.
- **Creation d'expedition**: PASS sur `hes_e2e` vide. `POST /api/v1/shipments` -> HTTP `201`, numero `HES-CASHUB-2026-000001`; SELECT `shipments` -> statut `CREATED`; SELECT `parcels` -> une ligne. Le bug de creation n'est pas reproduit dans cette configuration.
- **Session/2FA**: PASS avec PostgreSQL `hes_e2e` et Redis local reel: `session-and-2fa.spec.ts` -> 1 suite, 6 tests passes. L'echec precedent provenait de Redis indisponible/incoherent et non d'un defaut reproduit du flux.
- **Secrets**: `tokens.json` etait suivi par Git dans l'historique (`2e4e8d2`, `45be75a`) et contenait 9 jetons d'acces. Il est desormais retire de l'index et ignore. Les jetons/refresh tokens historiques doivent etre consideres compromis et revoques; aucune valeur n'est reproduite dans ce rapport.

## Scenarios E2E

| ID  | Test                         | Resultat                             | Preuve (requete -> code HTTP -> verification en base)                       | Ecart                         |
| --- | ---------------------------- | ------------------------------------ | --------------------------------------------------------------------------- | ----------------------------- |
| S1  | Cycle complet multi-agence   | NON EXECUTE                          | API indisponible -> aucun code HTTP -> aucune verification en base propre   | Services reels indisponibles  |
| S2  | Livraison partielle          | NON EXECUTE                          | API indisponible -> aucun code HTTP -> aucune verification en base propre   | Services reels indisponibles  |
| S3  | Refus et retour              | NON EXECUTE                          | API indisponible -> aucun code HTTP -> aucune verification en base propre   | Services reels indisponibles  |
| S4  | COD et finance               | NON EXECUTE                          | API indisponible -> aucun code HTTP -> aucune verification en base propre   | Services reels indisponibles  |
| S5  | Incident colis perdu         | NON EXECUTE                          | API indisponible -> aucun code HTTP -> aucune verification en base propre   | Services reels indisponibles  |
| S6  | Ecart de transfert           | NON EXECUTE                          | API indisponible -> aucun code HTTP -> aucune verification en base propre   | Services reels indisponibles  |
| S7  | Scans et idempotence         | NON EXECUTE                          | API indisponible -> aucun code HTTP -> aucune verification en base propre   | Services reels indisponibles  |
| S8  | Transitions invalides        | NON EXECUTE                          | API indisponible -> aucun code HTTP -> aucune verification en base propre   | Services reels indisponibles  |
| S9  | Documents MinIO reels        | NON EXECUTE                          | MinIO `9000` TCP false et API indisponible -> aucun PDF/objet/ligne verifie | MinIO indisponible            |
| S10 | Collecte                     | NON EXECUTE                          | API indisponible -> aucun code HTTP -> aucune verification en base propre   | Services reels indisponibles  |
| S11 | Concurrence 50/100           | NON EXECUTE pour le scenario demande | Le runner CI couvre 50 creations et 100 scans, mais n'a pas ete lance ici   | Docker/MinIO CI indisponibles |
| S12 | Suppression logique et audit | NON EXECUTE                          | API indisponible -> aucun code HTTP -> aucune verification en base propre   | Services reels indisponibles  |

## Securite et controle d'acces

| ID  | Test                                 | Resultat           | Preuve (requete -> code HTTP -> verification en base)                                                                                               | Ecart                     |
| --- | ------------------------------------ | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| T1  | Matrice role x endpoint              | NON EXECUTE        | Apres correction, `node role-matrix.mjs` sur API absente -> exit `1`, message `Matrice interrompue sans ecraser...`, hash JSON inchange             | API absente ici           |
| T2  | Cloisonnement agence                 | NON EXECUTE        | API indisponible -> aucun HTTP ni effet DB                                                                                                          | Environnement             |
| T3  | Cloisonnement utilisateur            | NON EXECUTE        | API indisponible -> aucun HTTP ni effet DB                                                                                                          | Environnement             |
| T4  | Confidentialite GPS                  | NON EXECUTE        | API indisponible -> aucun HTTP ni reponse inspectable                                                                                               | Environnement             |
| T5  | Auth, expiration, logout, revocation | PASS               | `jest session-and-2fa.spec.ts --runInBand` avec `DATABASE_URL=hes_e2e` et Redis local -> 1 suite/6 tests passes; logout puis `/auth/me` -> HTTP 401 | Redis local requis        |
| T6  | 2FA ADMIN/FINANCE                    | PASS               | Meme execution reelle -> ADMIN et FINANCE passent les etapes 2FA; SELECT `users.two_factor_enabled` disponible                                      | Pas de MinIO              |
| T7  | Entrees et injection                 | NON EXECUTE        | API indisponible -> aucun HTTP -> aucune verification de 4xx/500                                                                                    | Environnement             |
| T8  | Donnees sensibles                    | NON EXECUTE        | API et logs de serveur indisponibles pour cet audit                                                                                                 | Environnement             |
| T9  | Limitation de debit                  | NON EXECUTE        | API indisponible -> aucun HTTP 429 mesurable                                                                                                        | Environnement             |
| T10 | Idempotence                          | NON EXECUTE en E2E | Test Jest de paiement vert mais avec controles/mocks; aucune preuve API + DB propre                                                                 | Non substituable a un E2E |
| T11 | En-tetes, CORS, correlation          | NON EXECUTE        | API indisponible -> aucun header HTTP inspectable                                                                                                   | Environnement             |
| T12 | Routes sans jeton                    | NON EXECUTE        | API indisponible -> aucun balayage HTTP valide                                                                                                      | Environnement             |

## Resilience et sauvegarde

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
| Environnement/seed |                                                   5 |    2 |           0 |
| Suites existantes  | 1 execution frontend verte; backend non PASS global |    1 |           1 |
| E2E S1-S12         |                                                   0 |    0 |          12 |
| Securite T1-T12    |                                                   2 |    0 |          10 |
| Resilience R1-R4   |                                                   0 |    0 |           4 |
| Sauvegarde         |                                                   0 |    0 |           1 |

Le PASS frontend est uniquement le resultat de la commande Vitest. Il ne valide aucun scenario E2E reel.

## FAIL classes

- **BLOQUANT**: environnement de test reel non demarrable (Docker Desktop indisponible), donc aucune conclusion de mise en production sur les workflows; effort: retablir Docker et rejouer l'audit complet.
- **IMPORTANT**: MinIO absent, donc health reste `degraded` et documents non verifies; effort: demarrer MinIO puis rejouer S9/R2.
- **MINEUR**: le script de matrice avait transforme une erreur reseau en statut `0`; corrige dans le commit d'hygiene, effort faible.

## Bugs ou risques observes hors scenarios

- Le script de demarrage `pnpm --dir backend start` vise `dist/main.js`, alors que `nest build` produit `dist/src/main.js`; le workflow CI lance explicitement l'artefact produit.
- `20260902_rebuild_dev` contient des `DROP TABLE` de reconstruction, tandis que `20261012000000_init` cree le schema; ce n'est pas un doublon, mais une migration destructive de reconstruction suivie d'une migration d'initialisation.
- La configuration Prisma `package.json#prisma` est signalee depreciee pour Prisma 7 pendant les commandes executees.

## Non teste

Aucun navigateur n'a ete utilise. Le rendu visuel, appareil reel, camera, GPS reel, MinIO, Redis arrete/redemarre, coupure DB, redemarrage API, restauration pg_dump et charge de 100 scans n'ont pas pu etre testes localement. Le workflow GitHub Actions les automatise, mais n'a pas ete pousse ni execute depuis cet environnement.

## Verdict

**Non, le systeme ne peut pas etre declare pret pour la production en l'etat de cet audit.** Les migrations, le seed, la creation d'expedition sur base vide et session/2FA passent localement avec PostgreSQL/Redis reels, mais MinIO est indisponible et S1-S12/T1-T12 complets, resilience et restauration restent a executer dans GitHub Actions. Aucun PASS fonctionnel n'est declare sans requete HTTP, code HTTP et verification en base.
