# Applications Mobiles HES Logistics

Ce répertoire regroupe les applications mobiles du système HES Logistics :

- `client/` : Application mobile pour les clients (suivi de colis en direct, demande d'enlèvement, historique des envois).
- `courier/` : Application mobile pour les livreurs / chauffeurs (tournées de livraison, scans de codes-barres, capture de signatures et preuves de livraison POD, gestion des refus et incidents).

## Architecture & Sécurité

- Les applications mobiles communiquent exclusivement via l'API REST sécurisée `/api/v1/`.
- Aucun accès direct aux bases de données ou aux secrets d'infrastructure.
- Authentification par jetons JWT avec rotation automatique des tokens de rafraîchissement.
