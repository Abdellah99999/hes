# Feature : Auth (Authentification, Sessions & Permissions)

Ce module assure la sécurité côté client en phase d'authentification :

- Formulaires de connexion sécurisés (Zod validation).
- Gestion des tokens d'accès JWT en mémoire et rafraîchissement silencieux.
- Détection du rôle et de l'agence de rattachement de l'utilisateur.
- Guard de routes protégées et masquage des éléments d'interface non autorisés (sans se substituer au RBAC backend).
