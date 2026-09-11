# Feature : Shipments (Gestion des Colis & Expéditions)

Ce module gère le cycle de vie complet de l'expédition :

- Création d'expédition (expéditeur, destinataire, agence départ/arrivée, poids/dimensions, valeur déclarée, options COD/fragile).
- Génération d'étiquettes avec Code-Barres / Code 128 / QR Code.
- Suivi et timeline d'états (`REGISTERED`, `IN_TRANSIT`, `AT_HUB`, `OUT_FOR_DELIVERY`, `DELIVERED`, `RETURNED`).
- Recherche rapide et filtres avancés par numéro de tracking, expéditeur, statut et agence.

## Convention interne de dossier :

- `components/` : Composants de présentation spécifiques (ex: `ShipmentCard`, `TrackingTimeline`, `BarcodeLabel`).
- `hooks/` : Hooks TanStack Query pour les requêtes/mutations d'expéditions.
- `types/` : Types spécifiques à l'UI ou réexportés depuis le client OpenAPI généré.
- `pages/` : Pages de routes (ex: `ShipmentListPage`, `ShipmentDetailPage`, `ShipmentCreatePage`).
