# Rapport E2E reel HES

Date d'execution: 2026-11-09
Mode: QA independant, HTTP et PostgreSQL reels uniquement. Aucun code applicatif, mock ou navigateur ajoute.

## Limitation bloquante d'environnement

La recreation propre demandee n'a pas pu etre executee: `docker compose ps` echoue avec `dockerDesktopLinuxEngine ... The system cannot find the file specified`. Les sondes locales donnent API `3000=false`, Redis `6379=false`, MinIO `9000=false`. `GET http://localhost:3000/api/v1/health` echoue par `Unable to connect to the remote server`.

Une PostgreSQL locale ecoute sur `5432`, mais la base `delivery` existait deja et n'est donc pas une base propre de cet audit. Elle n'a pas ete detruite ni modifiee. Les commandes de migration deploy, seed officiel et restauration n'ont pas ete lancees afin de respecter la contrainte d'environnement propre sans contournement.

## Preuves d'environnement et seed

| ID   | Test                                         | Resultat    | Preuve (requete -> code HTTP -> verification en base)                                                                                                                | Ecart                                                        |
| ---- | -------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| E0.1 | Services reels disponibles                   | NON EXECUTE | `Test-NetConnection localhost:3000/6379/9000` -> TCP `False/False/False`; health non joignable                                                                       | Docker Desktop indisponible                                  |
| E0.2 | Health complet                               | NON EXECUTE | `GET /api/v1/health` -> aucun code HTTP, connexion refusee                                                                                                           | API arretee                                                  |
| E0.3 | Migrations et schema identiques              | NON EXECUTE | `prisma migrate diff` -> Prisma exige une shadow database pour un dossier de migrations; aucune shadow DB n'a ete creee                                              | Verification definitive impossible sans environnement propre |
| E0.4 | Seed officiel sur base vide                  | NON EXECUTE | aucune execution de `migrate deploy`/`seed`; base existante conservee                                                                                                | Precondition non satisfaite                                  |
| E0.5 | Referentiels presents dans la base existante | NON EXECUTE | SQL read-only -> PostgreSQL -> `users=9, agencies=3, cities=2, zones=3, parcel_types=5, package_types=5, services=4, refusal_reasons=6, permissions=47, customers=1` | Ce n'est pas une preuve de seed frais                        |
| E0.6 | Migrations presentes                         | NON EXECUTE | SQL read-only -> PostgreSQL -> `20260902_rebuild_dev`, `20261012000000_init`, `20261013120000_add_user_two_factor`                                                   | Etat d'une base preexistante                                 |

## Suites existantes

| Suite                   | Resultat reel                                                                    | Nature                                                                                                                                               | Preuve                                                                           |
| ----------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Backend Jest            | FAIL: 35 suites passees, 1 echouee; 1 suite en echec (`session-and-2fa.spec.ts`) | Majoritairement mocks; `shipment-concurrency-postgres.spec.ts` utilise PostgreSQL reel; `session-and-2fa` utilise PostgreSQL/Redis reels mais echoue | `pnpm test:backend`; erreurs HTTP attendues 200/401 et `Connection is closed`    |
| Frontend Vitest         | PASS d'execution: 35 fichiers, 147 tests                                         | Tests unitaires/jsdom, pas E2E HTTP et pas navigateur reel                                                                                           | `pnpm test:frontend` -> `35 passed`, `147 passed`                                |
| Matrice role x endpoint | NON EXECUTE comme controle valide                                                | Le script a emis 384 requetes, mais chaque resultat est `0` (erreur reseau); son `0 divergence` est invalide                                         | `node docs/qa/audit-scripts/role-matrix.mjs`; fichier `role-matrix-results.json` |

Les tests backend contenant `mockPrisma`, repositories mockes ou `mockMinioClient` ne constituent pas une preuve de vraie base ou de vrai stockage. Ils restent repertories comme tests unitaires ou d'integration simulee, meme lorsqu'ils sont verts. Les fichiers concernes incluent notamment `agency-isolation-and-customers`, `collection-workflow`, `documents-workflow`, `delivery-runs`, `tracking-idempotency`, `transfer-transactional`, `incidents-workflow`, `invoicing-workflow` et plusieurs suites de garde.

## Scenarios E2E

| ID  | Test                         | Resultat                             | Preuve (requete -> code HTTP -> verification en base)                                                                                                               | Ecart                          |
| --- | ---------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| S1  | Cycle complet multi-agence   | NON EXECUTE                          | API indisponible -> aucun code HTTP -> aucune verification en base propre                                                                                           | Services reels indisponibles   |
| S2  | Livraison partielle          | NON EXECUTE                          | API indisponible -> aucun code HTTP -> aucune verification en base propre                                                                                           | Services reels indisponibles   |
| S3  | Refus et retour              | NON EXECUTE                          | API indisponible -> aucun code HTTP -> aucune verification en base propre                                                                                           | Services reels indisponibles   |
| S4  | COD et finance               | NON EXECUTE                          | API indisponible -> aucun code HTTP -> aucune verification en base propre                                                                                           | Services reels indisponibles   |
| S5  | Incident colis perdu         | NON EXECUTE                          | API indisponible -> aucun code HTTP -> aucune verification en base propre                                                                                           | Services reels indisponibles   |
| S6  | Ecart de transfert           | NON EXECUTE                          | API indisponible -> aucun code HTTP -> aucune verification en base propre                                                                                           | Services reels indisponibles   |
| S7  | Scans et idempotence         | NON EXECUTE                          | API indisponible -> aucun code HTTP -> aucune verification en base propre                                                                                           | Services reels indisponibles   |
| S8  | Transitions invalides        | NON EXECUTE                          | API indisponible -> aucun code HTTP -> aucune verification en base propre                                                                                           | Services reels indisponibles   |
| S9  | Documents MinIO reels        | NON EXECUTE                          | MinIO `9000` TCP false et API indisponible -> aucun PDF/objet/ligne verifie                                                                                         | MinIO indisponible             |
| S10 | Collecte                     | NON EXECUTE                          | API indisponible -> aucun code HTTP -> aucune verification en base propre                                                                                           | Services reels indisponibles   |
| S11 | Concurrence 50/100           | NON EXECUTE pour le scenario demande | Le test existant a cree 50 shipments sur PostgreSQL preexistante en `1717ms` (`34.3ms` moyen), mais n'est pas l'environnement propre et ne couvre pas les 100 scans | Precondition E0 non satisfaite |
| S12 | Suppression logique et audit | NON EXECUTE                          | API indisponible -> aucun code HTTP -> aucune verification en base propre                                                                                           | Services reels indisponibles   |

## Securite et controle d'acces

| ID  | Test                                 | Resultat           | Preuve (requete -> code HTTP -> verification en base)                                                                                                                                 | Ecart                                                         |
| --- | ------------------------------------ | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| T1  | Matrice role x endpoint              | NON EXECUTE        | 384 appels -> statut `0` pour les 8 roles; aucun HTTP exploitable                                                                                                                     | Script ne traite pas l'erreur reseau comme echec              |
| T2  | Cloisonnement agence                 | NON EXECUTE        | API indisponible -> aucun HTTP ni effet DB                                                                                                                                            | Environnement                                                 |
| T3  | Cloisonnement utilisateur            | NON EXECUTE        | API indisponible -> aucun HTTP ni effet DB                                                                                                                                            | Environnement                                                 |
| T4  | Confidentialite GPS                  | NON EXECUTE        | API indisponible -> aucun HTTP ni reponse inspectable                                                                                                                                 | Environnement                                                 |
| T5  | Auth, expiration, logout, revocation | FAIL               | La suite reelle `session-and-2fa.spec.ts` recoit `401` avant les assertions attendues `200`; erreurs observees: `Token invalide ou expire`, puis `Connection is closed` au teardown   | Regression/configuration probable des tokens ou session Redis |
| T6  | 2FA ADMIN/FINANCE                    | FAIL               | La suite reelle attend `200`, recoit `401`; message attendu `Authentification a deux facteurs requise`, recu `Token invalide ou expire`; `twoFactorEnrolled` attendu true, recu false | Flux 2FA reel non conforme aux assertions                     |
| T7  | Entrees et injection                 | NON EXECUTE        | API indisponible -> aucun HTTP -> aucune verification de 4xx/500                                                                                                                      | Environnement                                                 |
| T8  | Donnees sensibles                    | NON EXECUTE        | API et logs de serveur indisponibles pour cet audit                                                                                                                                   | Environnement                                                 |
| T9  | Limitation de debit                  | NON EXECUTE        | API indisponible -> aucun HTTP 429 mesurable                                                                                                                                          | Environnement                                                 |
| T10 | Idempotence                          | NON EXECUTE en E2E | Test Jest de paiement vert mais avec controles/mocks; aucune preuve API + DB propre                                                                                                   | Non substituable a un E2E                                     |
| T11 | En-tetes, CORS, correlation          | NON EXECUTE        | API indisponible -> aucun header HTTP inspectable                                                                                                                                     | Environnement                                                 |
| T12 | Routes sans jeton                    | NON EXECUTE        | API indisponible -> aucun balayage HTTP valide                                                                                                                                        | Environnement                                                 |

## Resilience et sauvegarde

| ID  | Test                                 | Resultat    | Preuve (requete -> code HTTP -> verification en base)                             | Ecart                       |
| --- | ------------------------------------ | ----------- | --------------------------------------------------------------------------------- | --------------------------- |
| R1  | Arret Redis et reprise notifications | NON EXECUTE | Redis absent avant test; API absente, aucun health degraded ni reprise observable | Precondition API/Redis      |
| R2  | Arret MinIO                          | NON EXECUTE | MinIO absent avant test; aucun appel document reel                                | Precondition API/MinIO      |
| R3  | Coupure DB et atomicite              | NON EXECUTE | API absente; aucune transaction de reception executee                             | Environnement               |
| R4  | Redemarrage API                      | NON EXECUTE | API absente; aucune serie HTTP executee                                           | Environnement               |
| B1  | pg_dump/restauration/comparaison     | NON EXECUTE | Aucun dump ni restauration lance sur la base existante                            | Environnement propre absent |

## Totaux

| Section            |                                                PASS | FAIL | NON EXECUTE |
| ------------------ | --------------------------------------------------: | ---: | ----------: |
| Environnement/seed |                                                   0 |    0 |           6 |
| Suites existantes  | 1 execution frontend verte; backend non PASS global |    1 |           1 |
| E2E S1-S12         |                                                   0 |    0 |          12 |
| Securite T1-T12    |                                                   0 |    2 |          10 |
| Resilience R1-R4   |                                                   0 |    0 |           4 |
| Sauvegarde         |                                                   0 |    0 |           1 |

Le PASS frontend est uniquement le resultat de la commande Vitest. Il ne valide aucun scenario E2E reel.

## FAIL classes

- **BLOQUANT**: environnement de test reel non demarrable (Docker Desktop indisponible), donc aucune conclusion de mise en production sur les workflows; effort: retablir Docker et rejouer l'audit complet.
- **IMPORTANT**: `session-and-2fa.spec.ts` echoue sur les acces attendus 200, les messages 2FA et le teardown Redis; cause probable: configuration/validation de token ou session Redis incoherente avec l'API; effort: investigation ciblee puis nouvelle execution reelle.
- **IMPORTANT**: `role-matrix.mjs` transforme une erreur reseau en statut `0` puis conclut `0 divergence`; cause: gestion d'erreur du script; effort: faible, mais correction interdite dans cet audit.

## Bugs ou risques observes hors scenarios

- Le script de matrice genere et laisse un fichier de resultats modifie alors que toutes les requetes ont echoue au niveau reseau.
- La commande Prisma `migrate diff` sur un dossier de migrations exige une shadow database; aucune comparaison definitive n'a donc ete obtenue.
- La configuration Prisma `package.json#prisma` est signalee depreciee pour Prisma 7 pendant les commandes executees.

## Non teste

Aucun navigateur n'a ete utilise. Le rendu visuel, appareil reel, camera, GPS reel, MinIO, Redis arrete/redemarre, coupure DB, redemarrage API, restauration pg_dump et charge de 100 scans n'ont pas pu etre testes. La charge de 50 creations n'est qu'une preuve de test existant sur une base preexistante, pas un PASS de S11.

## Verdict

**Non, le systeme ne peut pas etre declare pret pour la production en l'etat de cet audit.** L'environnement reel n'a pas pu etre demarre, les scenarios principaux restent sans preuve, la matrice d'acces est invalide par erreur reseau, et la suite reelle sessions/2FA echoue avec des 401 inattendus et une fermeture Redis en erreur. Aucun PASS fonctionnel E2E n'est declare sans requete HTTP, code HTTP et verification en base.
