#!/usr/bin/env bash
# ==============================================================================
# HES Production PostgreSQL Backup Script
# Strategy: Full custom-format compressed dump with metadata and retention policy
# ==============================================================================
set -euo pipefail

DB_HOST="${DB_HOST:-postgres}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-delivery}"
DB_USER="${DB_USER:-postgres}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/postgres}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_backup_${TIMESTAMP}.dump"
LOG_FILE="${BACKUP_DIR}/${DB_NAME}_backup_${TIMESTAMP}.log"

mkdir -p "${BACKUP_DIR}"

echo "[$(date -Iseconds)] [INFO] Starting PostgreSQL backup for database: ${DB_NAME} on ${DB_HOST}:${DB_PORT}..." | tee -a "${LOG_FILE}"

# Execute pg_dump with custom compressed archive format (-F c)
# -F c enables pg_restore options like clean, selective table restore, and multithreaded loading
if pg_dump \
    -h "${DB_HOST}" \
    -p "${DB_PORT}" \
    -U "${DB_USER}" \
    -F c \
    -b \
    -v \
    -f "${BACKUP_FILE}" \
    "${DB_NAME}" >> "${LOG_FILE}" 2>&1; then
    
    FILESIZE=$(stat -c%s "${BACKUP_FILE}" 2>/dev/null || stat -f%z "${BACKUP_FILE}" 2>/dev/null || echo "0")
    chmod 600 "${BACKUP_FILE}"
    echo "[$(date -Iseconds)] [SUCCESS] Backup completed successfully: ${BACKUP_FILE} (Size: ${FILESIZE} bytes)" | tee -a "${LOG_FILE}"
else
    echo "[$(date -Iseconds)] [FATAL] PostgreSQL backup FAILED! Check ${LOG_FILE} for details." | tee -a "${LOG_FILE}"
    rm -f "${BACKUP_FILE}"
    exit 1
fi

# Optional automated retention pruning
if [ "${RETENTION_DAYS}" -gt 0 ]; then
    echo "[$(date -Iseconds)] [INFO] Pruning backups older than ${RETENTION_DAYS} days in ${BACKUP_DIR}..." | tee -a "${LOG_FILE}"
    find "${BACKUP_DIR}" -type f -name "${DB_NAME}_backup_*.dump" -mtime +"${RETENTION_DAYS}" -exec rm -f {} \;
fi

echo "[$(date -Iseconds)] [INFO] Backup process finished." | tee -a "${LOG_FILE}"
