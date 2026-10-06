# Secrets Management Policy & Production Provisioning Architecture

## 1. Zero Secrets in Repository (Audit & Verification)

A strict repository hygiene policy is enforced:

- `.env` and all `.env.*` files (except explicit `.example` templates) are ignored in `.gitignore`.
- TLS private keys (`*.key`) and certificates (`*.crt`) are blocked in `.gitignore`.
- All committed configuration templates (`.env.example`, `.env.prod.example`) strictly contain non-sensitive dummy placeholders (`change_me_*`, `GENERATE_SECURE_*`).

### Audit Verification Command:

```bash
git grep -i "HesProd"
# Exit code 1: 0 matches found in tracked git files.
```

---

## 2. Production Secrets Injection Mechanisms

In production, plain `.env` files are never manually stored on production hosts. Secrets are injected dynamically using one of the following enterprise architectures:

### Option A: AWS Secrets Manager / Parameter Store (Recommended for AWS ECS/EKS)

1. Secrets are stored in AWS Secrets Manager:
   - `/hes/prod/database/password`
   - `/hes/prod/redis/password`
   - `/hes/prod/minio/secret_key`
   - `/hes/prod/jwt/access_secret`
   - `/hes/prod/jwt/refresh_secret`

2. For ECS Task Definitions, secrets are resolved at container start using the IAM Execution Role:

```json
{
  "name": "DB_PASSWORD",
  "valueFrom": "arn:aws:secretsmanager:eu-west-3:123456789012:secret:/hes/prod/database/password"
}
```

3. For Kubernetes, using the **External Secrets Operator (ESO)**:

```yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: hes-api-secrets
spec:
  refreshInterval: "1h"
  secretStoreRef:
    name: aws-parameter-store
    kind: SecretStore
  target:
    name: hes-api-env
  data:
    - secretKey: DB_PASSWORD
      remoteRef:
        key: /hes/prod/database/password
```

### Option B: HashiCorp Vault / Doppler

- Dynamic secret leasing for PostgreSQL (Vault Database Secrets Engine generates short-lived credentials per container instance).
- JWT secrets stored in Vault KV v2 engine with versioning and access control policies (AppRole authentication).

### Option C: Standalone Docker Production Host (Manual Injection / CI Deployment)

On a dedicated Linux server running Docker Compose:

1. CI/CD pipeline connects via SSH/Bastion using an ephemeral runner.
2. Secrets are injected directly from GitHub Actions Protected Environment Secrets:

```bash
echo "DB_PASSWORD=${{ secrets.PROD_DB_PASSWORD }}" > /opt/hes/.env.prod
echo "REDIS_PASSWORD=${{ secrets.PROD_REDIS_PASSWORD }}" >> /opt/hes/.env.prod
chmod 600 /opt/hes/.env.prod
```

3. Docker Compose reads `/opt/hes/.env.prod` with root-only access (`chmod 600`).

---

## 3. Secret Rotation Procedures

### JWT Access & Refresh Secret Rotation:

1. Support dual-key verification during grace periods (verify against both active key and previous key).
2. Issue new tokens signed with active key.
3. Once refresh TTL (7 days) elapses, deprecate the old key completely.

### Database Password Rotation:

1. Add new secondary password for user `hes_prod_admin` or create new rotation user.
2. Update application secret in Secrets Manager and trigger rolling update.
3. Revoke legacy password after application health check reports 100% green.
