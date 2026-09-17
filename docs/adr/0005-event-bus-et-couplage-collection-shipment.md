# 5. Architecture Événementielle (Event Bus) et Exception Assumée de Couplage Synchrone Collecte-Expédition

Date : 2026-09-17  
Statut : **Accepté**  
Contexte : Phase 4 & Phase 7 - Architecture Événementielle & Clôture de Collecte Terrain

---

## Contexte et Problématique

La plateforme HES repose sur les principes de la Clean Architecture et du Domain-Driven Design (DDD). Pour découpler les mutations d'état métier de leurs effets de bord non critiques (notifications push/SMS, génération de documents PDF, logs d'audit), un bus d'événements de domaine (`IEventBus`) a été mis en place dès les premières phases du projet.

Cependant, lors de la clôture opérationnelle d'une mission de collecte chez un client expéditeur (`CompleteCollectionUseCase`), une interrogation architecturale récurrente se pose pour les développeurs et auditeurs de code :

> **Pourquoi `CompleteCollectionUseCase` invoque-t-il directement et de façon synchrone `CreateShipmentUseCase.execute()`, au lieu de publier un événement asynchrone `CollectionCompletedEvent` dont un abonné (_subscriber_) se chargerait de créer l'expédition en tâche de fond ?**

Ce document consigne le principe général du bus d'événements et formalise la justification métier et technique absolue de cette exception synchrone.

---

## 1. Principe Général de l'Event Bus (Résumé de `EVENT_BUS_SCALABILITY.md`)

L'application adhère au **Principe d'Inversion de Dépendance (DIP)** via le contrat `IEventBus` :

```typescript
export interface DomainEvent {
  eventName: string;
  occurredOn: Date;
  aggregateId: string;
  payload: Record<string, any>;
}

export interface IEventBus {
  publish(event: DomainEvent): Promise<void>;
  publishAll(events: DomainEvent[]): Promise<void>;
}
```

### Stratégie d'Évolution d'Infrastructure :

- **Phase Actuelle (Nominale)** : Implémentation in-process basée sur `EventEmitter2` (`EventBusService`), capable d'absorber jusqu'à 15 000 événements/seconde avec une surcharge inférieure à 0,5 ms.
- **Phase Scalabilité Horizontale (Multi-Conteneurs)** : Remplacement transparent au niveau de la couche infrastructure par un adaptateur distribué `BullMQEventBus` adossé à Redis Streams / Redis Pub-Sub (détaillé dans `EVENT_BUS_SCALABILITY.md`).
- **Cas d'Usage du Bus** : Tous les effets secondaires n'exigeant pas de cohérence transactionnelle immédiate :
  - `ShipmentRegisteredEvent` -> Envoi de notifications push et génération d'étiquettes thermiques.
  - `InvoiceCreatedEvent` -> Génération asynchrone du document PDF dans MinIO/S3.
  - `DeliveryCompletedEvent` -> Notification au destinataire et déclenchement des statistiques journalières.

---

## 2. L'Exception Formelle Assumée : Appel Synchrone `CompleteCollectionUseCase` $\rightarrow$ `CreateShipmentUseCase`

Dans `CompleteCollectionUseCase` (`backend/src/modules/collections/application/use-cases/complete-collection.use-case.ts`), l'appel à `CreateShipmentUseCase` est **strictement direct et synchrone** :

```typescript
// Extrait de CompleteCollectionUseCase :
// 6. Execute Phase 4 CreateShipmentUseCase directly (Zero code duplication)
const shipment = await this.createShipmentUseCase.execute(
  createShipmentDto,
  user,
);

// 7. Update collection and link collection items to created parcels in transaction
...
// 8. Publish CollectionCompletedEvent via EventBus for downstream side-effects
await this.eventBus.publish(new CollectionCompletedEvent(...));
```

### Justification Technique et Métier :

1. **Besoin Métier Impératif : Remise Immédiate du Bordereau au Client sur Place** :
   - Le chauffeur-livreur se trouve physiquement chez le client expéditeur au moment de valider la collecte sur son smartphone/terminal PWA.
   - Le client remet physiquement ses colis et exige en échange un reçu de prise en charge officiel comportant le **numéro d'expédition officiel (`trackingNumber`)** et les **numéros de code-barres unitaires de chaque colis**.
   - Si la création était confiée à un bus d'événements asynchrone, l'API devrait répondre au livreur avec un code `202 Accepted` sans numéro de suivi final. Le livreur serait bloqué devant le client, contraint d'attendre un rafraîchissement incertain sur un réseau mobile 3G/4G instable.

2. **Atomicité et Règle d'Intégrité Métier** :
   - Une collecte ne peut pas être déclarée `COMPLETED` si la création des colis ou l'attribution des séquences d'agence échoue (ex. contrainte de validation de poids, indisponibilité de données client).
   - L'appel direct garantit que l'échec de la création d'expédition interrompt immédiatement la clôture de la collecte sans laisser le système dans un état orphelin ou incohérent.

3. **Réutilisation Maximale sans Duplication (DRY)** :
   - Plutôt que de réécrire la logique complexe de calcul des séquences, de validation des agences et d'instanciation des colis, `CompleteCollectionUseCase` réutilise directement le cas d'usage certifié `CreateShipmentUseCase`.

---

## 3. Directive Impérative de Maintenance

> [!WARNING]
> **RÈGLE CRITIQUE POUR LES FUTURS DÉVELOPPEURS ET AUDITEURS ARCHITECTURE** :  
> L'appel direct et synchrone de `CreateShipmentUseCase` par `CompleteCollectionUseCase` est une **décision d'ingénierie délibérée, documentée et validée par le Tech Lead**.  
> Ce couplage **n'est en aucun cas une dette technique**, un « oubli » d'utilisation de l'Event Bus, ou un anti-pattern à corriger.  
> **Il est formellement interdit de transformer cet appel synchrone en événement asynchrone (Pub/Sub)**, sous peine de briser la confirmation terrain immédiate requise par les livreurs et les clients finaux.

---

## Conséquences

### Positives

- **Expérience terrain sans friction** : Le livreur reçoit instantanément dans la réponse JSON HTTP le bordereau généré avec l'ensemble des numéros de tracking imprimables ou communicables au client.
- **Fiabilité transactionnelle** : Zéro risque de collecte clôturée sans colis créés en cas de crash du worker événementiel.
- **Pérennité du modèle** : L'Event Bus continue d'être utilisé pour les tâches réellement asynchrones consécutives à la collecte (envoi d'email de confirmation de ramassage, audit trail global).

### Contraintes

- Le temps de réponse de l'endpoint de clôture de collecte inclut le temps d'exécution de création du bordereau (environ 15 à 30 ms), ce qui reste largement sous les seuils de performance admissibles (< 100 ms).
