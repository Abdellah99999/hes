# Feature : Deliveries (Livraisons & Tournées du Dernier Kilomètre)

Ce module gère le processus de livraison finale et les tournées des livreurs :

- Création et assignation des tournées de livraison (`DeliveryRun`).
- Feuille de route du livreur avec ordonnancement des points d'arrêt.
- Validation de livraison avec Preuve de Livraison (POD / signature tactile / photo / coordonnées GPS stockées sur MinIO).
- Encaissement du Cash-on-Delivery (COD) et réconciliation des montants perçus.
- Gestion des échecs de livraison (motif d'absence, reprogrammation, retour en agence).
