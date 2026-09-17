# 4. Numérotation Transactionnelle Séquentielle par Agence et par Année

Date : 2026-09-17  
Statut : **Accepté**  
Contexte : Phase 4 & Phase 5 - Expéditions, Traçabilité Colis et Intégrité Multi-Agences

---

## Contexte et Problématique

Dans la plateforme de logistique et messagerie express HES (mono-entreprise, multi-agences), des milliers de colis et expéditions sont enregistrés quotidiennement à travers l'ensemble des agences opérationnelles du réseau (ex. Casablanca Hub, Rabat Agence, Tanger Port, Agadir Hub).

Chaque expédition (`Shipment`) et chaque colis (`Parcel`) nécessite un numéro de suivi (`trackingNumber`) et un code-barres unique, lisible par les opérateurs de quai, les chauffeurs-livreurs et les clients finaux.

Deux contraintes critiques s'imposent à l'architecture de persistance :

1. **Garantie absolue d'unicité et de non-collision** : Aucun doublon de numéro de suivi ne peut être toléré, y compris sous forte charge concurrente (ex. plusieurs opérateurs scannant et créant simultanément des dizaines de bordereaux dans la même agence ou dans des agences différentes à la même milliseconde).
2. **Cloisonnement et lisibilité opérationnelle** : Le numéro doit immédiatement indiquer l'agence d'origine et l'année d'émission pour faciliter le tri physique sur quai et l'archivage comptable, tout en évitant toute contention d'écriture inter-agences.

---

## Options Envisagées

### Option A : Séquence globale unique ou UUID v4

- **UUID v4 pur** (`d8b2f901-4471-4828-9844-3d078c5ce9d7`) : garantit l'unicité probabiliste sans verrouillage, mais est inexploitable sur étiquette thermique 1D (densité Code 128 excessive, illisible pour les opérateurs, non mémorisable au téléphone par le service client).
- **Séquence PostgreSQL globale** (`HES-2026-00045231`) : crée un goulot d'étranglement centralisé (contention sur une ressource unique partagée entre toutes les agences du pays) et ne permet pas d'identifier visuellement l'agence émettrice sans interroger la base de données.

### Option B : Séquence transactionnelle partitionnée par couple `(agency_id, year)` avec atomicité PostgreSQL (Option Retenue)

- La séquence est gérée dans une table dédiée `shipment_sequences` avec une clé unique composite `(agency_id, year)`.
- L'incrémentation utilise une clause atomique native PostgreSQL `INSERT ... ON CONFLICT ... DO UPDATE ... RETURNING` au sein de la transaction de création du bordereau.
- Le format d'expédition produit est :  
  `HES-{AGENCY_CODE}-{YEAR}-{PADDED_SEQUENCE_6_DIGITS}`  
  _(Exemple : `HES-CAS-2026-000042`)_
- Le format unitaire de colis (`Parcel`) hérite de ce numéro avec index séquentiel :  
  `HES-{AGENCY_CODE}-{YEAR}-{PADDED_SEQUENCE_6_DIGITS}-{PARCEL_INDEX_2_DIGITS}`  
  _(Exemple : `HES-CAS-2026-000042-01`, `HES-CAS-2026-000042-02`)_

---

## Décision Retenue

La plateforme adopte formellement l'**Option B : Numérotation séquentielle partitionnée par agence et par année**.

### 1. Modélisation Relationnelle

La table `shipment_sequences` est définie dans le schéma Prisma avec une contrainte d'unicité stricte :

```prisma
model ShipmentSequence {
  id           String   @id @default(uuid())
  agencyId     String   @map("agency_id")
  year         Int
  currentValue Int      @default(0) @map("current_value")
  prefix       String   @default("HES")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  agency Agency @relation(fields: [agencyId], references: [id], onDelete: Cascade)

  @@unique([agencyId, year])
  @@map("shipment_sequences")
}
```

### 2. Implémentation Transactionnelle Atomique

Au sein de `PrismaShipmentRepository.create()`, l'obtention de la valeur suivante s'exécute dans une transaction isolée via une requête SQL native garantissant le verrouillage exclusif de la ligne (_row-level lock_) :

```sql
INSERT INTO shipment_sequences (id, agency_id, year, current_value, prefix, created_at, updated_at)
VALUES (gen_random_uuid(), :agencyId, :currentYear, 1, 'HES', NOW(), NOW())
ON CONFLICT (agency_id, year)
DO UPDATE SET current_value = shipment_sequences.current_value + 1, updated_at = NOW()
RETURNING current_value, prefix;
```

---

## Garanties Formelles de Non-Collision

1. **Verrouillage au niveau du tuple (_Row-Level Lock_)** :  
   Dans le moteur de stockage MVCC de PostgreSQL, la clause `ON CONFLICT DO UPDATE` acquiert un verrou exclusif sur la ligne cible `(agency_id, year)`. Deux transactions concurrentes essayant d'incrémenter la séquence pour la même agence sont automatiquement sérialisées par le moteur de base de données. L'une attend la validation de l'autre, éliminant tout risque de lecture sale (_dirty read_) ou de doublon de compteur.

2. **Isolation totale inter-agences (Zéro contention croisée)** :  
   Les transactions d'Agadir Hub n'accèdent jamais à la ligne de Casablanca Hub. La création de bordereaux à Casa peut atteindre 1 000 req/s sans créer la moindre latence ni le moindre verrouillage pour les agences de Tanger, Rabat ou Marrakech.

3. **Partitionnement temporel annuel** :  
   Le compteur repart à 1 au 1er janvier de chaque nouvelle année civile de manière totalement autonome (par insertion d'un nouveau tuple `(agencyId, 2027)`), sans script de migration ni maintenance manuelle.

4. **Résilience multi-instances sans lock distribué** :  
   Même avec 5 répliques d'API NestJS conteneurisées derrière un répartiteur Nginx, l'intégrité de la séquence est garantie par PostgreSQL sans avoir à introduire de verrou distribué complexe (ex. Redlock Redis) susceptible de faillir en cas de split-brain réseau.

---

## Conséquences

### Positives

- **Unicité absolue prouvée** : Risque mathématique de collision strictement nul sur les numéros d'expédition et de colis.
- **Lisibilité opérationnelle optimale** : En un coup d'œil sur le colis (`HES-TNG-2026-001205-01`), les trieurs et chauffeurs identifient immédiatement l'origine Tanger, l'année 2026, le numéro de dossier 1205 et le colis 1/N.
- **Code-barres 1D standard Code 128 compact** : La chaîne de 21 caractères s'imprime avec un contraste optimal sur les étiquettes thermiques 100x150 mm sans dégradation de lecture optique.
- **Performance élevée** : Verrou ultra-court limité à une simple mise à jour d'entier sur un tuple indexé par B-Tree unique.

### Contraintes et Mesures Associées

- **Exigence d'agence d'origine valide** : Toute création d'expédition doit obligatoirement avoir une `originAgencyId` valide et persistée avant l'attribution du numéro.
- **Non-réutilisabilité des numéros en cas de rollback** : En cas d'annulation de transaction ultérieure (ex. validation métier échouée après l'incrément), la valeur de séquence consommée n'est pas restituée, créant un "trou" inoffensif dans la numérotation séquentielle, ce qui est la règle standard en transport et comptabilité pour garantir l'irréversibilité temporelle de l'audit.
