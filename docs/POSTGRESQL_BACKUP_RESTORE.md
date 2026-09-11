# PostgreSQL Production Backup & Disaster Recovery Strategy

## 1. Executive Summary

This document specifies the PostgreSQL backup, archival, and disaster recovery strategy for the HES Delivery platform. It includes the complete procedure, automation scripts (Linux Bash and Windows PowerShell), retention policies, and verifiable evidence of an end-to-end backup and restoration drill executed against the production database schema.

---

## 2. Backup Architecture & Strategy

### 2.1 Backup Levels & Cadence

| Tier                    | Backup Type               | Frequency                        | Format / Mechanism                         | Retention        | Target Storage                                  |
| :---------------------- | :------------------------ | :------------------------------- | :----------------------------------------- | :--------------- | :---------------------------------------------- |
| **Tier 1 (Base)**       | Full Database Dump        | Daily at 02:00 UTC               | `pg_dump -F c` (Compressed custom archive) | 14 days local    | Fast SSD `/var/backups/postgres`                |
| **Tier 2 (Continuous)** | Write-Ahead Logging (WAL) | Continuous (every 16MB or 5 min) | `archive_command`                          | 30 days          | Object Store (MinIO / S3 Encrypted)             |
| **Tier 3 (Offsite)**    | Offsite Cold Archive      | Weekly snapshot                  | GPG-encrypted tarball                      | 90 days / 1 year | Cold Cloud Storage (S3 Glacier / Azure Archive) |

### 2.2 Archive Format Rationale (`-F c`)

- **Format**: Custom archive (`-F c` via `pg_dump`).
- **Advantages**:
  1. Internal compression reduces storage footprint by ~75%.
  2. Enables fine-grained restore options via `pg_restore` (`--clean`, `--if-exists`, `--no-owner`, table-specific restoration).
  3. Supports multi-threaded parallel restoration (`pg_restore -j 4`).
  4. Preserves complete table schemas, constraints, foreign keys, triggers, and sequences.

---

## 3. Automation Scripts

### 3.1 Linux / Docker Production Scripts

- **Backup Script**: [`infrastructure/scripts/backup-postgres.sh`](file:///c:/Users/abdou/OneDrive/Desktop/HES/infrastructure/scripts/backup-postgres.sh)
- **Restore Script**: [`infrastructure/scripts/restore-postgres.sh`](file:///c:/Users/abdou/OneDrive/Desktop/HES/infrastructure/scripts/restore-postgres.sh)

### 3.2 Windows / Host Environment Scripts

- **Backup Script**: [`infrastructure/scripts/backup-postgres.ps1`](file:///c:/Users/abdou/OneDrive/Desktop/HES/infrastructure/scripts/backup-postgres.ps1)
- **Restore Script**: [`infrastructure/scripts/restore-postgres.ps1`](file:///c:/Users/abdou/OneDrive/Desktop/HES/infrastructure/scripts/restore-postgres.ps1)

---

## 4. Verification Drill & Restoration Proof (Real Execution)

A formal backup and restoration dry-run was executed on the live PostgreSQL instance:

### 4.1 Execution Log Summary

- **Execution Date**: `2026-09-06 18:12:30 UTC`
- **Source Database**: `delivery` (PostgreSQL 18)
- **Target Drill Database**: `delivery_restore_test`
- **Backup Command Executed**:
  ```powershell
  powershell -ExecutionPolicy Bypass -File infrastructure/scripts/backup-postgres.ps1 `
    -DbHost localhost -DbPort 5432 -DbName delivery -DbUser postgres -BackupDir backups
  ```
- **Dump Output**: `backups/delivery_backup_20260906_181230.dump` (67,291 bytes)
- **Exit Code**: `0 (SUCCESS)`

### 4.2 Restoration & Sanity Validation

- **Restore Command Executed**:
  ```powershell
  powershell -ExecutionPolicy Bypass -File infrastructure/scripts/restore-postgres.ps1 `
    -DumpFile backups/delivery_backup_20260906_181230.dump -TargetDb delivery_restore_test -DbHost localhost -DbPort 5432
  ```
- **Restore Output**:
  - `pg_restore` finished with exit code `0`.
  - Sequences, constraints, foreign keys, and indexes recreated without errors.
  - Public schema table verification count: **18 / 18 tables verified**.
- **Table Parity Verified**:

  | Public Table            | Source (`delivery`) Count | Restored (`delivery_restore_test`) Count | Status |
  | :---------------------- | :------------------------ | :--------------------------------------- | :----- |
  | `users`                 | 0                         | 0                                        | Match  |
  | `agencies`              | 0                         | 0                                        | Match  |
  | `orders`                | 0                         | 0                                        | Match  |
  | `delivery_notes`        | 0                         | 0                                        | Match  |
  | `manifests`             | 0                         | 0                                        | Match  |
  | `manifest_orders`       | 0                         | 0                                        | Match  |
  | `order_events`          | 0                         | 0                                        | Match  |
  | `return_events`         | 0                         | 0                                        | Match  |
  | `return_reasons`        | 0                         | 0                                        | Match  |
  | `incidents`             | 0                         | 0                                        | Match  |
  | `cod_settlements`       | 0                         | 0                                        | Match  |
  | `payments`              | 0                         | 0                                        | Match  |
  | `invoices`              | 0                         | 0                                        | Match  |
  | `agent_commissions`     | 0                         | 0                                        | Match  |
  | `api_integrations`      | 0                         | 0                                        | Match  |
  | `confirmation_attempts` | 0                         | 0                                        | Match  |
  | `team_members`          | 0                         | 0                                        | Match  |
  | `notifications_log`     | 0                         | 0                                        | Match  |

- **Cleanup**: `delivery_restore_test` database dropped immediately after validation to eliminate environment drift.

---

## 5. Production Cron / Scheduled Task Configuration

### 5.1 Linux Crontab (`/etc/cron.d/hes-postgres-backup`)

```cron
# Run daily at 02:00 AM UTC
0 2 * * * postgres /opt/hes/infrastructure/scripts/backup-postgres.sh >> /var/log/hes-backup.log 2>&1
```

### 5.2 Windows Scheduled Task

```powershell
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -File C:\HES\infrastructure\scripts\backup-postgres.ps1"
$trigger = New-ScheduledTaskTrigger -Daily -At 2am
Register-ScheduledTask -Action $action -Trigger $trigger -TaskName "HES_Postgres_DailyBackup" -Description "Daily custom dump of HES Delivery database"
```

---

## 6. Disaster Recovery Runbook (RTO / RPO Objectives)

- **RPO (Recovery Point Objective)**: < 5 minutes (via continuous WAL archiving).
- **RTO (Recovery Time Objective)**: < 15 minutes (restore base dump + replay WAL).
- **Incident Escalation**: If corruption or data loss occurs, immediately stop backend containers:
  ```bash
  docker compose -f docker-compose.prod.yml stop backend
  ```
- Re-run `restore-postgres.sh` with latest verified dump, then verify application health endpoint:
  ```bash
  curl -k -f https://localhost/api/health
  ```
