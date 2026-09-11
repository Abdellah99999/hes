# Feature : Agencies (Gestion Multi-Agences)

Ce module permet de gérer les agences du réseau HES (7 agences initiales) :

- Fiches agences (nom, code agence, adresse, coordonnées GPS, contact responsable, horaires).
- Rôles et affectation des agents et chauffeurs par agence.
- Statistiques de performance et flux entrants/sortants par agence.
- Isolation et sélection du contexte agence pour les opérations locales.

## Convention interne de dossier :

- `components/` : Composants UI (ex: `AgencyBadge`, `AgencySelector`, `AgencyStatsCard`).
- `hooks/` : Hooks TanStack Query pour les agences.
- `pages/` : Pages `AgencyListPage`, `AgencyDetailPage`.
