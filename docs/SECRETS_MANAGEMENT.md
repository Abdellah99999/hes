# Stratégie de Gestion et de Rotation des Secrets en Production

## 1. Principes Fondamentaux de Sécurité (Standard 12-Factor App & CIS)

1. **Zéro Secret dans le Code Source** :
   - Aucun mot de passe, clé privée, token ou chaîne de connexion n'est committé dans le dépôt Git.
   - Les fichiers `.env`, `.env.local` et `.env.production` sont inscrits dans le `.gitignore` et scannés lors des pipelines CI/CD.
2. **Injection Dynamique en Production** :
   - Les secrets sont injectés au démarrage des conteneurs via un gestionnaire de secrets centralisé (ex: HashiCorp Vault, AWS Secrets Manager, Doppler, ou Docker Swarm/Kubernetes Secrets).
   - Les conteneurs ne disposent que des droits minimaux nécessaires à leur fonctionnement (principe du moindre privilège).
3. **Partitionnement Réseau Strict** :
   - Aucun port de stockage de données (PostgreSQL 5432, Redis 6379, MinIO 9000/9001) n'est exposé sur `0.0.0.0`.
   - Seuls les conteneurs du réseau interne Docker peuvent communiquer avec les bases de données.

---

## 2. Inventaire des Secrets & Matrice de Sensibilité

| Secret               | Rôle & Usage                                             | Format & Entropie Minimale                                               | Fréquence de Rotation Recommandée |
| :------------------- | :------------------------------------------------------- | :----------------------------------------------------------------------- | :-------------------------------- |
| `JWT_ACCESS_SECRET`  | Signature cryptographique HMAC-SHA256 des tokens d'accès | Chaine aléatoire 256 bits (min 32 caractères alphanumériques + symboles) | Tous les 90 jours                 |
| `JWT_REFRESH_SECRET` | Validation des sessions de rafraîchissement              | Chaine aléatoire 256 bits (min 32 caractères)                            | Tous les 90 jours                 |
| `DATABASE_URL`       | Identifiants de connexion PostgreSQL applicative         | URI avec mot de passe généré aléatoirement (min 24 caractères)           | Tous les 180 jours                |
| `REDIS_PASSWORD`     | Authentification des commandes Redis (AUTH)              | Chaine aléatoire haute entropie (min 32 caractères)                      | Tous les 180 jours                |
| `MINIO_SECRET_KEY`   | Clé secrète d'accès au stockage objet S3                 | Chaine aléatoire (min 32 caractères)                                     | Tous les 180 jours                |

---

## 3. Protocoles de Rotation des Secrets sans Coupure de Service (Zero-Downtime)

### Protocole 1 : Rotation des Clés JWT (`JWT_ACCESS_SECRET`)

Pour éviter de déconnecter brutalement les livreurs et opérateurs en cours de tournée, la rotation s'opère selon le principe de **double validation (Active Key + Verification Key)** :

1. **Étape 1 (Déclaration de la nouvelle clé)** :
   - Configurer `JWT_ACCESS_SECRET_NEW` dans le coffre-fort de secrets.
   - Conserver l'ancienne clé en tant que `JWT_ACCESS_SECRET_OLD`.
2. **Étape 2 (Déploiement progressif)** :
   - Le service d'authentification valide les tokens entrants avec l'une ou l'autre des deux clés :
     - Si la signature correspond à `NEW` ou `OLD`, la requête est acceptée.
   - Les nouveaux tokens émis sont désormais signés exclusivement avec `NEW`.
3. **Étape 3 (Expiration de la période de grâce)** :
   - Comme la durée de vie de l'Access Token est de **15 minutes**, tous les anciens tokens actifs expirent naturellement sous 15 minutes.
   - Après 24 heures de précaution, `JWT_ACCESS_SECRET_OLD` est définitivement supprimée.
   - **Résultat : Zéro interruption de session, zéro rejet intempestif.**

---

### Protocole 2 : Rotation du Mot de Passe PostgreSQL

1. **Création d'un rôle temporaire secondaire** dans PostgreSQL :
   ```sql
   CREATE USER hes_db_admin_v2 WITH PASSWORD 'nouveau_mot_de_passe_robuste_2026';
   GRANT ALL PRIVILEGES ON DATABASE delivery TO hes_db_admin_v2;
   GRANT ALL ON ALL TABLES IN SCHEMA public TO hes_db_admin_v2;
   GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO hes_db_admin_v2;
   ```
2. **Mise à jour de `DATABASE_URL`** dans la configuration de déploiement et rolling-update du conteneur `hes_api_prod`.
3. **Validation de santé** : Attente de la sonde `/api/v1/health/readiness` (retour 200 OK).
4. **Révocation de l'ancien utilisateur** après basculement complet :
   ```sql
   DROP USER hes_db_admin;
   ```

---

### Protocole 3 : Rotation du Mot de Passe Redis

1. Exécution à chaud via `redis-cli` sans redémarrage :
   ```bash
   redis-cli -a "$ANCIEN_MOT_DE_PASSE" CONFIG SET requirepass "$NOUVEAU_MOT_DE_PASSE"
   ```
2. Mise à jour de la variable `REDIS_PASSWORD` dans le coffre-fort de production.
3. Redémarrage rolling-update de l'API backend pour rafraîchir son pool de connexions `ioredis`.

---

## 4. Vérification Anti-Fuite dans le Bundle Client Frontend

Une étape bloquante est intégrée au pipeline CI/CD (`check-frontend-secrets.mjs`) pour inspecter chaque chunk JavaScript généré par Vite :

- Si une variable d'environnement sans préfixe `VITE_` se retrouve dans `dist/assets/*.js`, le déploiement est immédiatement annulé avec code de sortie 1.
- Les clés publiques Google Maps sont restreintes par domaine HTTP Referrer (`*.hes.ma/*`) et n'autorisent que l'API JavaScript Map, sans accès aux APIs payantes de backend.
