# Module Courier Mobile — HES Logistics (Phase 16)

Ce module fournit les composants, services et abstractions dédiés à l'expérience mobile du livreur HES.

## Navigation Provider Google Maps

Le provider de navigation (`src/navigation/`) implémente le pattern Strategy pour le guidage GPS :

- Détection automatique plateforme (Android Intent, iOS URL Scheme, Web Universal Links).
- Priorisation des coordonnées GPS (`lat,lng`) si disponibles avec fallback sur adresse postale complète.
- Respect strict de la vie privée : aucune position GPS temps réel du livreur n'est partagée avec le client.
- Aucune clé API payante requise pour le guidage natif ; clés additionnelles sécurisées par variables d'environnement.
