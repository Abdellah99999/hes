# 1. Architecture Monorepo, Observabilité Structurée et Contract Testing

Date : 2026-09-05  
Statut : **Accepté**  
Contexte : Phase 1 - Infrastructure et Fondations Techniques Transversales

---

## Contexte et Problématique

La plateforme de gestion de transport et logistique multi-agences HES nécessite une séparation stricte entre une API backend REST pure (NestJS) et des clients frontend (React Web SPA, Flutter Mobile). Dès la Phase 1, il est impératif de garantir :

1. L'indépendance de déploiement et de packaging de chaque composant tout en maintenant une source unique de vérité pour le versioning et l'outillage de développement.
2. L'absence totale d'import direct ou de fuite de logique/secrets entre le backend et le frontend.
3. Une observabilité standardisée (logs JSON structurés et correlation ID `X-Request-Id` propagé de bout en bout).
4. La prévention des ruptures de contrat d'API (drift DTO/OpenAPI) avant toute mise en production.
5. Une politique de configuration fail-fast interdisant le démarrage avec des variables d'environnement non conformes ou des secrets par défaut en production.

---

## Décision Retenue

### 1. Structure de Projet : Monorepo sous pnpm Workspaces

- **Choix** : Un monorepo unifié avec deux workspaces isolés (`backend/` et `frontend/`) orchestrés par `pnpm` et `Turborepo`.
- **Raisonnement** :
  - Centralise l'infrastructure Docker Compose, les scripts de CI GitHub Actions, et les politiques de formatage/sécurité globales.
  - Chaque workspace dispose de son propre `package.json`, `tsconfig.json`, `Dockerfile` et de ses propres dépendances.
  - Interdiction stricte de tout import direct (`import ... from '../backend'`) par règle de linter et tests automatisés.
  - Tout échange s'effectue exclusivement par protocole HTTP REST sur l'API `/api/v1/`.

### 2. Observabilité : Logs JSON Structurés & Correlation ID

- **Choix** :
  - Implémentation d'un logger structuré JSON standardisé (Pino format) avec masquage automatique des champs sensibles (`password`, `token`, `authorization`, `recipientCin`).
  - Déploiement d'un middleware NestJS global `CorrelationIdMiddleware` extrayant ou générant un UUID v4 (`X-Request-Id`) propagé dans chaque log et retourné dans les en-têtes HTTP de chaque réponse.
- **Raisonnement** : Permet la corrélation instantanée des incidents en production entre Nginx, l'API et les clients sans nécessiter de refonte ultérieure pour OpenTelemetry.

### 3. Contract Testing : OpenAPI 3.0 Source Unique & Orval en CI

- **Choix** :
  - Le backend expose et exporte son schéma OpenAPI (`backend/openapi.json`).
  - Le frontend génère son client HTTP typé et ses hooks TanStack Query via Orval (`orval.config.ts`).
  - La CI frontend exécute une vérification automatisée (`git diff --exit-code frontend/src/api/`) bloquant toute Pull Request dont les DTOs frontend dérivent du schéma réel backend.

### 4. Validation de Configuration au Bootstrap (Fail-Fast)

- **Choix** : Validation stricte via schémas Zod au démarrage du backend et au build du frontend. En environnement `production`, aucune clé par défaut n'est tolérée pour les secrets (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `DATABASE_URL`). L'application crashe immédiatement avec un rapport lisible en cas de non-conformité.

---

## Conséquences

### Positives

- Reproductibilité et isolation totale des environnements de build Docker.
- Aucune régression possible sur le contrat API sans échec préalable en CI.
- Traçabilité et auditabilité complètes des flux grâce au Correlation ID.
- Sécurité renforcée dès le démarrage (aucun secret par défaut toléré en production).

### Négatives / Contraintes

- Nécessite d'exécuter `pnpm openapi:export && pnpm --dir frontend gen:api` lors de toute modification de DTO backend avant de commiter.
- Les tests unitaires et d'intégration doivent inclure la vérification des en-têtes de corrélation.
