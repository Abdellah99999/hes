# 6. Stratégie PWA, Architecture du Service Worker et Politique de Cache Offline

Date : 2026-09-17  
Statut : **Accepté**  
Contexte : Phase 16 - PWA, Expérience Mobile Responsive & Résilience Réseau

---

## Contexte et Problématique

Dans le cadre du pivot mobile unifié (application Web responsive et Progressive Web App unique), les chauffeurs-livreurs et les clients finaux utilisent l'interface sur smartphones et tablettes dans des conditions réseau variables (zones blanches, parkings souterrains, entrepôts métalliques, traversées routières interurbaines).

Pour assurer une expérience fluide et professionnelle, le système doit satisfaire trois exigences fondamentales :

1. **Chargement instantané de l'App Shell** : L'application doit s'ouvrir immédiatement sans écran blanc, même en cas de connectivité lente ou inexistante.
2. **Cybersécurité stricte et protection des données personnelles (CNDP / RGPD)** : Aucune donnée personnelle (CIN, adresses de clients, numéros de téléphone, montants d'encaissement COD, jetons d'authentification JWT) ne doit être mise en cache de façon non contrôlée dans le stockage local du navigateur (`CacheStorage`).
3. **Maîtrise du cycle de déploiement** : Les mises à jour de l'application déployées en production sur Nginx doivent être propagées de façon prévisible sans bloquer l'utilisateur sur une version obsolète (_cache poisoning_).

---

## Choix Technologique : Option B (Service Worker Natif) vs Option A (vite-plugin-pwa / Workbox)

Deux options d'implémentation ont été comparées :

| Critère                    | Option A : `vite-plugin-pwa` + Workbox          | Option B : Service Worker Natif Standard (Option Retenue)            |
| :------------------------- | :---------------------------------------------- | :------------------------------------------------------------------- |
| **Poids du bundle**        | +30 à 60 KB de runtime Workbox                  | **0 KB supplémentaire** (script JS pur sous `frontend/public/sw.js`) |
| **Dépendances npm**        | 2 plugins et dépendances de build               | **0 dépendance** (utilise les standards W3C Service Worker natifs)   |
| **Contrôle cybersécurité** | Règles générées par configuration DSL           | **Contrôle impératif ligne à ligne** des exclusions d'URL et headers |
| **Résilience CI/CD**       | Risque de rupture lors des upgrades Vite/Rollup | **Indépendance totale** vis-à-vis du bundler et du framework         |
| **Debugging terrain**      | Abstractions complexes Workbox Strategies       | **Logs clairs et prévisibles** dans la console DevTools              |

### Décision Retenue :

La plateforme retient formellement l'**Option B : Service Worker Natif Vanilla JS**, implémenté dans [frontend/public/sw.js](file:///c:/Users/abdou/OneDrive/Desktop/HES/frontend/public/sw.js).

---

## Politique de Cache Multi-Niveaux Validée

Le Service Worker implémente une stratégie de routage à trois niveaux étanches :

### 1. Niveau 1 : Cybersécurité & Données Dynamiques — Network-Only Strict sur `/api/*` et Requêtes Mutatives

- **Règle absolue** : Toute requête ciblant `/api/` (ou `/api/v1/`) ou exécutant une mutation HTTP (`POST`, `PUT`, `PATCH`, `DELETE`) est **systématiquement exclue du CacheStorage**.
- **Justification de sécurité** : Stocker des réponses d'API contenant des CIN destinataires, des sommes d'argent liquide collectées ou des tokens d'autorisation dans `CacheStorage` exposerait les données en clair à des attaques locales en cas de perte, vol ou partage de terminal mobile.
- **Gestion de la perte réseau** : En cas d'échec réseau sur un appel API, le Service Worker intercepte l'erreur et renvoie une réponse JSON normalisée HTTP 503 explicite :
  ```json
  {
    "statusCode": 503,
    "error": "Service Unavailable",
    "message": "Connexion réseau indisponible. Cette action en ligne ne peut pas être exécutée hors-ligne."
  }
  ```

### 2. Niveau 2 : Navigation SPA & App Shell — Network-First avec Repli sur `/index.html`

- **Stratégie** : Pour toute requête de navigation HTML (`request.mode === 'navigate'` ou header `Accept: text/html`), le Service Worker tente d'abord de récupérer le fichier HTML distant via le réseau pour garantir l'obtention de la dernière version applicative.
- **Repli Hors-Ligne** : Si le réseau est déconnecté, il renvoie immédiatement le fichier `/index.html` pré-mis en cache lors de l'installation du SW (`APP_SHELL_PRECACHE`), permettant à l'application React de s'exécuter localement et d'afficher les écrans avec les indicateurs d'état réseau appropriés.

### 3. Niveau 3 : Assets Statiques Immuables — Cache-First avec Complétion Dynamique

- **Périmètre** : Fichiers statiques sous `/assets/`, `/icons/`, scripts `.js` et styles `.css` avec hash de contenu Vite, polices `.woff2`, images vectorielles `.svg`.
- **Stratégie** : Cache-First. Si la ressource est présente dans le cache local, elle est servie en 0 ms. Si elle est absente, elle est récupérée sur le réseau, injectée dans le cache pour les prochains démarrages, puis renvoyée au navigateur.

---

## Cycle de Vie et Invalidation du Cache

1. **Pré-mise en cache à l'installation (`install`)** :
   ```javascript
   const APP_SHELL_PRECACHE = [
     "/",
     "/index.html",
     "/manifest.webmanifest",
     "/favicon.svg",
     "/icons/icon-192x192.png",
     "/icons/icon-512x512.png",
   ];
   ```
2. **Nettoyage automatique à l'activation (`activate`)** :  
   À chaque incrément de version (`CACHE_NAME = 'hes-app-shell-v2'`), toutes les clés de cache qui ne correspondent plus au nouveau nom sont purgées immédiatement avant la prise de contrôle (`clients.claim()`), éliminant tout risque d'accumulation de fichiers fantômes sur l'espace de stockage du mobile.
3. **Signalisation client (`message`)** :  
   Support de l'action `SKIP_WAITING` permettant à l'interface utilisateur de déclencher un rechargement propre lors de la détection d'une nouvelle version sans interruption brutale d'une saisie en cours.

---

## Conséquences

### Positives

- **Démarrage instantané sur mobile** : L'App Shell est disponible en continu, offrant un ressenti d'application native mobile.
- **Sécurité et conformité totale** : Zéro risque de persistance non autorisée de données personnelles ou financières en local.
- **Stabilité de maintenance** : Aucune dépendance externe ni friction lors des montées de version du monorepo.

### Contraintes et Limites Assumées

- **Actions transactionnelles strictement en ligne** : Les opérations sensibles (validation d'encaissement d'argent, clôture de tournée, signature POD) nécessitent une connectivité active et ne sont pas exécutées en cache spéculatif hors-ligne, protégeant ainsi l'intégrité comptable du système.
