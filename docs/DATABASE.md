# Base de données

## Technologies

- PostgreSQL
- Prisma ORM

## Règle métier

La donnée métier importante ne doit pas être supprimée physiquement.

Les données doivent utiliser des mécanismes de soft delete et d’audit selon le besoin.

## Liste de domaines métiers principaux

- agencies
- customers
- shipments
- parcels
- tracking_events
- collections
- transfers
- deliveries
- returns
- incidents
- invoices
- notifications
- reports
- audit_logs

## Conformité

- aucune dépendance frontend vers Prisma
- aucune logique métier dans le frontend
- les changements de statut et de transitions doivent être validés backend
