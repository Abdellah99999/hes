# 2. Gestion de la Localisation des Colis (`current_agency_id`) Pendant le Transit Inter-Agences

Date : 2026-09-06  
Statut : **Accepté**  
Contexte : Phase 6 - Routage Multi-Hub, Transferts Inter-Agences & Stock Quai

---

## Contexte et Problématique

Dans la plateforme logistique HES, un colis (`Parcel`) est physiquement transporté entre agences via des liaisons routières ou des lignes régulières (`Transfer`).
Lorsqu'un camion quitte le quai d'une agence d'origine (ex: Agadir Hub) à destination d'un hub intermédiaire ou final (ex: Casablanca Hub), une question architecturale et opérationnelle critique se pose :

> **Quelle doit être la valeur de `parcel.current_agency_id` pendant toute la durée du trajet sur route ?**

Deux options ont été mises en concurrence :

- **Option A** : `current_agency_id` est positionné à `NULL` dès le départ du camion. Le suivi du colis est assuré par `status = 'IN_TRANSIT'` et la clé étrangère `current_transfer_id = transfer.id`.
- **Option B** : `current_agency_id` conserve l'identifiant de l'agence d'origine jusqu'au déchargement et à la validation de réception à destination.

---

## Décision Retenue

La plateforme retient formellement l'**Option A : `current_agency_id = NULL` pendant le transit**.

### Justification Technique et Opérationnelle :

1. **Exactitude Physique et Intégrité du Stock Quai** :
   - L'inventaire d'une agence (`SELECT * FROM parcels WHERE current_agency_id = :agencyId`) doit refléter avec exactitude les colis physiquement présents sous son toit ou sur ses quais.
   - Maintenir `current_agency_id = Agadir` alors que le camion est sur l'autoroute à 300 km fausserait l'inventaire physique et comptable de l'agence d'origine.

2. **Prévention des Défaillances et Fraudes Opérationnelles** :
   - En mettant `current_agency_id` à `NULL`, il devient mathématiquement impossible pour un chef de quai ou un dispatcher d'Agadir d'affecter par inadvertance ou malveillance un colis en route à une tournée de distribution locale (`DeliveryRun`).

3. **Traçabilité Juridique et Cybersécurité en Cas de Sinistre** :
   - Dès la validation du départ (`dispatchedAt`), la garde physique du colis est transférée de l'agence au chauffeur/transporteur.
   - En cas d'accident, de vol ou de dégradation routière, le colis est rattaché univoquement au manifeste de transport `Transfer` (`vehiclePlate`, `driverName`, `sealNumber`). L'agence d'origine n'est plus considérée à tort comme le lieu du sinistre.

4. **Performance des Requêtes d'Inventaire** :
   - La requête de stock quai s'appuie directement sur l'index composite B-Tree PostgreSQL `(current_agency_id, status)` sans devoir injecter une clause d'exclusion complexe `AND status NOT IN ('IN_TRANSIT', 'DELIVERED', ...)`.

---

## Conséquences

### Positives

- Cohérence parfaite entre la réalité physique des quais et l'état de la base de données.
- Simplification radicale des requêtes d'inventaire, de volumétrie et de valorisation du stock agence.
- Détection immédiate des colis manquants ou dévoyés lors de la réconciliation à l'arrivée.

### Contraintes et Mesures Associées

- Le champ `currentAgencyId` de la table `parcels` doit rester nullable (`String?` dans le schéma Prisma).
- Toute recherche d'un colis en transit doit consulter `currentTransferId` pour identifier le véhicule et la route associés.
- Les écrans de tracking public ou interne doivent expliciter le statut « En cours d'acheminement vers [Agence Destination] » dès lors que `currentAgencyId IS NULL` et `status = IN_TRANSIT`.
