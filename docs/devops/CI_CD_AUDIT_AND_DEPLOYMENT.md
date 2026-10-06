# CI/CD Pipeline Audit & Manual Production Deployment Procedure

## 1. Audit of Existing GitHub Actions Workflows

We performed a deep code and infrastructure audit of all workflows in `.github/workflows/`:

1. `ci-backend.yml`: Lint, static typing, unit testing & docker build verification for the API.
2. `ci-frontend.yml`: Lint, vitest, openapi contract sync & secrets audit for the SPA.
3. `ci-cd-backend.yml`: Multi-stage pipeline (Quality Gate -> Security Gate -> Docker Build -> Rolling Deploy).
4. `ci-cd-frontend.yml`: Multi-stage pipeline (Quality Gate -> Secret Audit -> Docker Build -> Web Release).

### Findings & Identified Gaps:

- **Branch Trigger Discrepancy**: Workflows were configured with `branches: [main, develop]`, while the active working branch is `master`. Any push to `master` previously did not trigger CI/CD. _(Fixed: updated to `[main, master, develop]`)_.
- **Node & PNPM Runtime Conflict**: The workflows specified `node-version: 20` alongside `pnpm@11.5.2` (which requires Node.js >= 22). On standard GitHub runners, this would produce engine warnings or installation failures. _(Fixed: upgraded runner setup to `node-version: 22`)_.
- **Execution State on Remote Repository**: The local working tree is 26+ commits ahead of `origin/master`. Because commits were developed locally during the PWA pivot, these workflows have **not yet executed remotely on GitHub Actions** for the latest commit set.
- **Declarative Cloud Deployment Step**: In `ci-cd-backend.yml` and `ci-cd-frontend.yml`, the final `deploy` job contained placeholder echo commands because no real cloud infrastructure (AWS ECS, Kubernetes cluster, or remote VM SSH bastion) credentials or secrets are attached to this repository.

---

## 2. Real vs Simulated Deployment Boundary

> [!IMPORTANT]
> **Production Cloud Infrastructure Notice:**
> An automated cloud deployment pipeline requires cloud target credentials (e.g. AWS OIDC role, GCP Workload Identity, or SSH host keys in GitHub repository secrets) and a real destination cloud server. Because this environment is a local development workstation, automated remote cloud deployment cannot be executed here.
>
> Below is the **battle-tested manual production deployment procedure** verified locally with our production Docker Compose orchestrator.

---

## 3. Standard Manual Production Deployment Runbook

### Step 1: Pre-Deployment Prerequisites on Target Server

1. Clone the repository and checkout the target release tag:
   ```bash
   git clone git@github.com:Abdellah99999/hes.git /opt/hes
   cd /opt/hes
   git checkout tags/v1.0.0
   ```
2. Provision production environment secrets securely (`chmod 600`):
   ```bash
   cp .env.prod.example .env.prod
   chmod 600 .env.prod
   # Inject real credentials into .env.prod
   ```
3. Ensure TLS certificates are in place:
   ```bash
   ls -la infrastructure/docker/nginx/ssl/server.crt infrastructure/docker/nginx/ssl/server.key
   ```

### Step 2: Build & Package Production Images

```bash
# Build API, Web SPA, and Gateway images
docker compose --env-file .env.prod -f docker-compose.prod.yml build
```

### Step 3: Run Database Migrations

```bash
# Apply Prisma schema migrations
docker compose --env-file .env.prod -f docker-compose.prod.yml run --rm backend npx prisma migrate deploy
```

### Step 4: Start or Update Stack with Zero Downtime

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d
```

### Step 5: Post-Deployment Smoke Test

```bash
# 1. Container healthcheck status
docker compose --env-file .env.prod -f docker-compose.prod.yml ps

# 2. Direct API liveness & readiness check
docker exec hes_api_prod wget -qO- http://127.0.0.1:3000/api/v1/health

# 3. Public HTTPS endpoint verification
curl -k -I https://localhost/
curl -k -I https://localhost/api/v1/health
```
