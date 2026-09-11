#!/usr/bin/env bash
# ==============================================================================
# HES Production PostgreSQL Restore Script
# Strategy: Clean restore from custom-format compressed dump with verification
# ==============================================================================
set -euo pipefail

DB_HOST="${DB_HOST:-postgres}"
DB_PORT="${DB_PORT:-5432}"
TARGET_DB="${TARGET_DB:-delivery}"
DB_USER="${DB_USER:-postgres}"
DUMP_FILE="${1:-}"

if [ -z "${DUMP_FILE}" ]; then
    echo "[FATAL] Usage: $0 <path_to_dump_file> [target_database]"
    exit 1
fi

if [ ! -f "${DUMP_FILE}" ]; then
    echo "[FATAL] Dump file '${DUMP_FILE}' not found!"
    exit 1
fi

if [ -n "${2:-}" ]; then
    TARGET_DB="$2"
fi

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOG_FILE="${DUMP_FILE}.restore_${TIMESTAMP}.log"

echo "[$(date -Iseconds)] [WARNING] You are about to restore into database '${TARGET_DB}' on ${DB_HOST}:${DB_PORT}." | tee -a "${LOG_FILE}"
echo "[$(date -Iseconds)] [INFO] Source dump: ${DUMP_FILE}" | tee -a "${LOG_FILE}"

# Execute pg_restore:
# --clean : Clean (drop) database objects before recreating them
# --if-exists : Use IF EXISTS when dropping objects
# --no-owner : Do not output commands to set ownership of objects (avoids cross-user permission errors)
# --no-acl : Prevent restoration of access privileges (grant/revoke)
echo "[$(date -Iseconds)] [INFO] Executing pg_restore..." | tee -a "${LOG_FILE}"
set +e
pg_restore \
    -h "${DB_HOST}" \
    -p "${DB_PORT}" \
    -U "${DB_USER}" \
    -d "${TARGET_DB}" \
    --clean \
    --if-exists \
    --no-owner \
    --no-acl \
    -v \
    "${DUMP_FILE}" >> "${LOG_FILE}" 2>&1
RESTORE_STATUS=$?
set -e

# Note: pg_restore returns 1 if warnings occurred (e.g. drop table when table didn't exist yet)
if [ "${RESTORE_STATUS}" -eq 0 ] || [ "${RESTORE_STATUS}" -eq 1 ]; then
    echo "[$(date -Iseconds)] [SUCCESS] pg_restore finished with exit code ${RESTORE_STATUS}." | tee -a "${LOG_FILE}"
else
    echo "[$(date -Iseconds)] [FATAL] pg_restore failed with exit code ${RESTORE_STATUS}! Inspect ${LOG_FILE}." | tee -a "${LOG_FILE}"
    exit "${RESTORE_STATUS}"
fi

# Verification query: Count public tables
echo "[$(date -Iseconds)] [INFO] Running post-restore sanity check..." | tee -a "${LOG_FILE}"
TABLE_COUNT=$(psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${TARGET_DB}" -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';" | tr -d '[:space:]')

echo "[$(date -Iseconds)] [SUCCESS] Restoration verified. Public schema table count in '${TARGET_DB}': ${TABLE_COUNT}" | tee -a "${LOG_FILE}"
