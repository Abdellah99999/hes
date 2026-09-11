# HES Production Rollback Plan

## 1. Overview & Objectives

This document defines the emergency rollback procedures for the HES Delivery platform across all three tiers:

1. **Frontend (SPA/Static Assets)**
2. **Backend (NestJS API Service)**
3. **Database (PostgreSQL & Prisma Migrations)**

The primary objective is **zero-data-loss** and **sub-5-minute Mean Time to Recover (MTTR)** in the event of an undetected regression, critical vulnerability, or runtime failure.

---

## 2. Frontend Rollback Procedure

Because the frontend is an immutable single-page application built with Vite and served through Nginx, rollback can be achieved either atomically via container image reversion or via directory symlink.

### 2.1 Docker Container Image Rollback (Recommended)

When frontend releases are tagged with git commit SHAs (e.g., `hes-frontend:v1.4.1` or `hes-frontend:sha-abc1234`):

```bash
# Step 1: Update the image reference in the deployment environment
export FRONTEND_TAG=sha-previous-known-good

# Step 2: Pull and recreate the frontend container with zero impact on backend
docker compose -f frontend/docker-compose.prod.yml up -d --no-deps frontend

# Step 3: Verify Nginx gateway serves the previous release
curl -I https://hes.company.com/
```

### 2.2 Atomic Filesystem Symlink Rollback (Self-Hosted / Volume Mount)

If using a volume-mounted release directory structure:

```
/var/www/hes-frontend/
├── releases/
│   ├── 20260906_170000/  (old stable)
│   └── 20260906_180000/  (faulty release)
└── current -> releases/20260906_170000/
```

**Rollback Command**:

```bash
ln -sfn /var/www/hes-frontend/releases/20260906_170000 /var/www/hes-frontend/current
docker exec hes-nginx nginx -s reload
```

- **Duration**: < 1 second.
- **Client Impact**: Zero dropped connections. Existing browser sessions continue using cached chunk hashes; new requests load the stable index and assets immediately.

---

## 3. Backend Rollback Procedure

The backend is stateless and communicates with Redis, MinIO, and PostgreSQL.

### 3.1 Container Rolling Reversion

```bash
# Step 1: Export the previous stable image tag
export BACKEND_TAG=sha-previous-known-good

# Step 2: Gracefully restart backend with the previous image
docker compose -f backend/docker-compose.prod.yml up -d --no-deps backend

# Step 3: Monitor container health status
docker inspect --format='{{json .State.Health.Status}}' hes_backend_prod

# Step 4: Validate API health endpoint
curl -f https://hes.company.com/api/health
```

### 3.2 In-Flight Request Graceful Shutdown

The backend NestJS application implements `enableShutdownHooks()`:

- SIGTERM is received.
- HTTP listener stops accepting new connections.
- In-flight HTTP requests have a 10-second grace period to complete.
- Database connection pools (Prisma) and Redis clients are cleanly terminated.

---

## 4. Database Migration Rollback Strategy

Prisma ORM does not support automated down migrations (`prisma migrate down`) because non-deterministic down-migrations risk catastrophic data loss. HES strictly follows the **Expand and Contract** pattern for all database evolutions.

### 4.1 The Expand & Contract Rule

No schema migration is allowed to delete or alter a column in a way that breaks the running backend code:

| Phase                    | Action                                                                             | Compatibility                                   |
| :----------------------- | :--------------------------------------------------------------------------------- | :---------------------------------------------- |
| **Phase 1 (Expand)**     | Add new nullable column or new table. Deploy DB migration first.                   | Compatible with both Version N and Version N+1. |
| **Phase 2 (Dual Write)** | Deploy Backend Version N+1 that writes to both old and new columns.                | Compatible with both schema states.             |
| **Phase 3 (Backfill)**   | Run asynchronous data backfill script from old column to new column.               | No lock, batch processing.                      |
| **Phase 4 (Contract)**   | Backend Version N+2 reads only from new column. Drop old column in next migration. | Safe to decommission old field.                 |

### 4.2 Handling a Faulty Migration Rollback

If a migration was applied and a rollback is urgently required:

#### Scenario A: The migration only added tables, columns, or indexes (Non-Destructive)

1. **Do NOT drop columns immediately** if data was inserted.
2. Roll back the backend code to the previous version. Because the previous version ignores newly added columns/tables, the application functions normally.
3. Once stable, apply a new forward migration (`prisma migrate dev --create-only`) that safely deprecates or cleans up the unused elements.

#### Scenario B: The migration corrupted constraints or introduced an invalid index

1. Mark the migration as resolved:
   ```bash
   npx prisma migrate resolve --rolled-back "20260906_problematic_migration_name"
   ```
2. Apply a compensating SQL script directly:
   ```sql
   -- Example: Drop the faulty index concurrently without table locks
   DROP INDEX CONCURRENTLY IF EXISTS idx_faulty_index_name;
   ```
3. Update `schema.prisma` and commit a new forward migration.

#### Scenario C: Worst-Case Data Corruption Recovery

If data corruption occurred due to a destructive operation:

1. Place the API in maintenance mode (via Nginx 503 maintenance page):
   ```bash
   docker exec hes-nginx touch /var/www/maintenance.flag
   ```
2. Execute the verified point-in-time restoration drill:
   ```bash
   bash infrastructure/scripts/restore-postgres.sh /var/backups/postgres/delivery_backup_latest.dump delivery
   ```
3. Verify data integrity and disable maintenance mode:
   ```bash
   docker exec hes-nginx rm -f /var/www/maintenance.flag
   ```

---

## 5. Decision Matrix & Escalation Flow

```
           +---------------------------------------+
           |     Anomaly Detected Post-Deploy      |
           +---------------------------------------+
                              |
              Is it Frontend-only or Backend-only?
             /                                    \
    [Frontend Only]                          [Backend Only]
           |                                        |
Revert Frontend Image / Symlink           Revert Backend Image Tag
           |                                        |
Validate CDN/Browser Assets               Check Health & Error Logs
           |                                        |
         Done                               Did DB Migration Run?
                                           /                     \
                                       [No]                     [Yes]
                                         |                        |
                                       Done             Expand & Contract?
                                                       /                  \
                                                   [Yes]                 [No]
                                                     |                     |
                                            Backend Rollback     Compensating Migration
                                             (DB is backward        or Restore Dump
                                               compatible)
```

---

## 6. Verification Checklist Post-Rollback

- [ ] `curl -f https://hes.company.com/api/health` returns `{"status":"ok"}`.
- [ ] Frontend loads without JS console errors (`Failed to fetch chunk`).
- [ ] WebSocket / Notification connections re-established.
- [ ] Redis cache consistency verified (`redis-cli ping`).
- [ ] Log aggregator (Datadog/ELK) confirms error rate dropped to baseline (< 0.05%).
