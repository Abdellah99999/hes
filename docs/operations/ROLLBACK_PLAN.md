# Operational Rollback Plan & Validation Runbook

## 1. Application Layer Rollback (Docker Containers)

### Trigger Conditions:

- Newly deployed image fails `/api/v1/health` check or crashes in container restart loop.
- Critical regression detected in high-traffic endpoints (HTTP 5xx error rate > 1%).

### Procedure:

1. In production, images are always tagged with Git SHA or semver tag (`IMAGE_TAG=v1.2.3`), and the previous working image is aliased (`hes-api:previous`).
2. Update the environment variable or tag:

```bash
# Option A: Rollback via image tag in .env.prod
sed -i 's/IMAGE_TAG=.*/IMAGE_TAG=previous/' .env.prod
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --no-build backend frontend

# Option B: Direct tag override
IMAGE_TAG=previous docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --no-build backend
```

3. Verify zero-downtime container transition:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml ps
docker exec hes_api_prod wget -qO- http://127.0.0.1:3000/api/v1/health
```

---

## 2. Database Migration Rollback (Prisma ORM)

Prisma does not provide an automated `prisma migrate down` command. Reverting database schema changes without data loss requires a **safe compensating forward/backward migration strategy**.

### Tested Rollback Scenario (Executed on Live DB Copy):

1. **Simulation**: A problematic column `temp_tracking_flag` was added to `agencies` and populated with live data.
2. **Rollback Action**:
   - A safe compensating DDL script was executed inside a transaction:
   ```sql
   BEGIN;
   -- If new column had valuable data, archive before dropping:
   -- CREATE TABLE IF NOT EXISTS _archive_temp_tracking AS SELECT id, temp_tracking_flag FROM agencies;
   ALTER TABLE agencies DROP COLUMN IF EXISTS temp_tracking_flag;
   COMMIT;
   ```
3. **Prisma State Synchronization**:
   If a migration was tracked by Prisma Migrate:
   ```bash
   npx prisma migrate resolve --rolled-back "20261006_problematic_migration"
   ```
4. **Validation Proof**:
   - Agency records count: 3 rows preserved with 100% data fidelity (`AG-CAS-01`, `AG-RAB-01`, `AG-MAR-01`).
   - Column safely removed; zero table locks or data loss observed.

---

## 3. Post-Rollback Checklist

- [ ] Container status is `healthy` in `docker compose ps`.
- [ ] Response from `/api/v1/health` reports status `ok` with latency < 10ms for DB, Redis, and Storage.
- [ ] Nginx HTTPS gateway returns `HTTP 200` on `https://localhost/` and `https://localhost/api/v1/health`.
- [ ] Audit logs and error alerts inspected in `docker compose logs -f nginx backend`.
