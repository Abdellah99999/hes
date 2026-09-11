# HES Platform Operational Runbook

## 1. Scope & Purpose

This operational runbook provides sysadmins, DevOps engineers, and on-call SREs with clear, actionable procedures for monitoring, maintaining, and troubleshooting the HES Delivery platform in production.

---

## 2. Service Topology & Ports

All internal microservices communicate exclusively within the Docker bridge network `hes_internal_network`. Only ports `80` and `443` are exposed to the external world via the Nginx Reverse Proxy Gateway.

| Service Name        | Internal Container Port | Exposed Host Port    | Health Check Mechanism                        |
| :------------------ | :---------------------- | :------------------- | :-------------------------------------------- |
| `hes-nginx`         | 80, 443                 | 80, 443              | `nginx -t`, HTTP 200 on root                  |
| `hes_frontend_prod` | 80                      | None (Internal only) | `wget --spider http://127.0.0.1:80/`          |
| `hes_backend_prod`  | 3000                    | None (Internal only) | `GET /api/health`                             |
| `hes_postgres_prod` | 5432                    | None (Internal only) | `pg_isready -U postgres -d delivery`          |
| `hes_redis_prod`    | 6379                    | None (Internal only) | `redis-cli ping`                              |
| `hes_minio_prod`    | 9000, 9001              | None (Internal only) | `GET http://127.0.0.1:9000/minio/health/live` |

---

## 3. Routine Lifecycle Operations

### 3.1 Starting the Entire Production Stack

```bash
docker compose -f docker-compose.prod.yml up -d
```

### 3.2 Checking Stack Status

```bash
docker compose -f docker-compose.prod.yml ps
```

_Expected: All services status should show `running (healthy)`._

### 3.3 Viewing Logs

```bash
# All services with timestamp
docker compose -f docker-compose.prod.yml logs -f --tail=100

# Backend only with correlation ID tracking
docker compose -f docker-compose.prod.yml logs -f backend

# Nginx error log (for 499, 502, 504 diagnosis)
docker compose -f docker-compose.prod.yml logs -f nginx
```

### 3.4 Graceful Stack Shutdown

```bash
docker compose -f docker-compose.prod.yml stop
```

---

## 4. Health Probes & Monitoring

### 4.1 Automated Health Checks

#### Backend API Health Check

```bash
# Internal container check
curl -f http://localhost:3000/api/health

# External HTTPS check
curl -k -f https://hes.company.com/api/health
```

**Sample Healthy Response**:

```json
{
  "status": "ok",
  "info": {
    "database": { "status": "up" },
    "redis": { "status": "up" },
    "storage": { "status": "up" }
  },
  "timestamp": "2026-09-06T18:15:00.000Z"
}
```

#### PostgreSQL Connection Check

```bash
docker exec hes_postgres_prod pg_isready -U postgres -d delivery
# Output: localhost:5432 - accepting connections
```

#### Redis Cache Check

```bash
docker exec hes_redis_prod redis-cli ping
# Output: PONG
```

#### MinIO Storage Check

```bash
docker exec hes_minio_prod curl -f http://localhost:9000/minio/health/live
# HTTP 200 OK
```

---

## 5. Subsystem Maintenance Procedures

### 5.1 Redis Memory & Eviction Policy Management

Production Redis is configured with:

- `maxmemory 512mb`
- `maxmemory-policy allkeys-lru`

To verify memory usage:

```bash
docker exec hes_redis_prod redis-cli info memory | grep -E "used_memory_human|maxmemory_human"
```

To flush temporary rate-limit keys during incident resolution:

```bash
# Flush only DB 1 if namespaces are used, or flush keys with pattern
docker exec hes_redis_prod redis-cli --scan --pattern "rate-limit:*" | xargs -r docker exec -i hes_redis_prod redis-cli del
```

### 5.2 MinIO Storage & Retention Management

MinIO stores delivery proof photos, signatures, and exported PDF manifests.

- Temporary PDF reports expire after 7 days via S3 lifecycle rule:

```bash
# Check bucket disk usage
docker exec hes_minio_prod du -sh /data
```

### 5.3 PostgreSQL Vacuuming & Statistics

The platform relies on PostgreSQL autovacuum. For high-volume peak periods:

```bash
# Analyze tables to optimize query planner
docker exec hes_postgres_prod psql -U postgres -d delivery -c "VACUUM ANALYZE orders, order_events, delivery_notes;"
```

---

## 6. Incident Diagnosis & Triage Runbook

### Incident 1: HTTP 502 Bad Gateway

**Symptoms**: Users see Nginx 502 Bad Gateway page.

1. Check if backend container is running:
   ```bash
   docker ps -f name=hes_backend_prod
   ```
2. If restarting repeatedly, check logs for OOM (Out Of Memory) or unhandled crashes:
   ```bash
   docker logs --tail 200 hes_backend_prod
   ```
3. Verify backend container can reach PostgreSQL and Redis:
   ```bash
   docker exec -it hes_backend_prod nc -zv postgres 5432
   docker exec -it hes_backend_prod nc -zv redis 6379
   ```

### Incident 2: Database Connection Pool Exhaustion

**Symptoms**: API responses slow down (> 5s) or fail with Prisma `Timed out fetching a new connection from the pool`.

1. Inspect active connections:
   ```bash
   docker exec hes_postgres_prod psql -U postgres -d delivery -c "SELECT count(*), state FROM pg_stat_activity GROUP BY state;"
   ```
2. Identify long-running queries (> 10 seconds):
   ```bash
   docker exec hes_postgres_prod psql -U postgres -d delivery -c "SELECT pid, now() - query_start AS duration, query FROM pg_stat_activity WHERE state != 'idle' AND (now() - query_start) > interval '10 seconds';"
   ```
3. Terminate a blocking query:
   ```bash
   docker exec hes_postgres_prod psql -U postgres -d delivery -c "SELECT pg_terminate_backend(<PID>);"
   ```

### Incident 3: Rate Limiting Triggers False Positives

**Symptoms**: Legit client receives HTTP 429 Too Many Requests.

1. Check Nginx rate limit logs:
   ```bash
   docker exec hes-nginx grep "limiting requests" /var/log/nginx/error.log
   ```
2. Adjust `rate_limit_zone` in `/etc/nginx/conf.d/default.conf`:
   - Increase `rate=30r/s` to `50r/s`
   - Increase `burst=50` to `80`
3. Reload Nginx configuration without dropping connections:
   ```bash
   docker exec hes-nginx nginx -s reload
   ```

---

## 7. Emergency Contacts & Escalation Escalator

| Escalation Level | Role                          | Responsibilities                                      | Target SLA |
| :--------------- | :---------------------------- | :---------------------------------------------------- | :--------- |
| **Tier 1**       | On-Call SRE                   | Triage, container restarts, rollback execution        | 15 mins    |
| **Tier 2**       | Tech Lead / Backend Engineer  | Database locks, migration rollbacks, code regressions | 30 mins    |
| **Tier 3**       | Head of Infrastructure / CISO | Security incidents, credential rotation, offsite DR   | Immediate  |
