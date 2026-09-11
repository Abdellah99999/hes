<#
.SYNOPSIS
    PostgreSQL Backup Script for HES Production / Staging
.DESCRIPTION
    Creates a compressed custom-format (-F c) dump with logging and retention checks.
.PARAMETER DbHost
    PostgreSQL Host (default: localhost)
.PARAMETER DbPort
    PostgreSQL Port (default: 5432)
.PARAMETER DbName
    Database Name (default: delivery)
.PARAMETER DbUser
    PostgreSQL User (default: postgres)
.PARAMETER BackupDir
    Target directory for dumps
.PARAMETER PgBinPath
    Path to PostgreSQL bin directory containing pg_dump.exe
#>
param(
    [string]$DbHost = "localhost",
    [string]$DbPort = "5432",
    [string]$DbName = "delivery",
    [string]$DbUser = "postgres",
    [string]$BackupDir = "$PSScriptRoot\..\..\backups",
    [string]$PgBinPath = "C:\Program Files\PostgreSQL\18\bin",
    [int]$RetentionDays = 14
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
}

$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$BackupFile = Join-Path $BackupDir "${DbName}_backup_${Timestamp}.dump"
$LogFile = Join-Path $BackupDir "${DbName}_backup_${Timestamp}.log"

$PgDump = Join-Path $PgBinPath "pg_dump.exe"
if (-not (Test-Path $PgDump)) {
    # Check if pg_dump is in PATH
    $PgDumpCmd = Get-Command "pg_dump.exe" -ErrorAction SilentlyContinue
    if ($PgDumpCmd) {
        $PgDump = $PgDumpCmd.Source
    } else {
        throw "pg_dump.exe not found at $PgDump and not in PATH."
    }
}

Write-Host "[$((Get-Date).ToString('s'))] [INFO] Starting PostgreSQL backup for $DbName on ${DbHost}:${DbPort}..."
Write-Host "[$((Get-Date).ToString('s'))] [INFO] Output file: $BackupFile"

$DumpArgs = @(
    "-h", $DbHost,
    "-p", $DbPort,
    "-U", $DbUser,
    "-F", "c",
    "-b",
    "-v",
    "-f", $BackupFile,
    $DbName
)

$prevEAP = $ErrorActionPreference
$ErrorActionPreference = "Continue"

try {
    & $PgDump @DumpArgs 2>&1 | Tee-Object -FilePath $LogFile
    $dumpExit = $LASTEXITCODE
} finally {
    $ErrorActionPreference = $prevEAP
}

if ($dumpExit -eq 0 -and (Test-Path $BackupFile)) {
    $FileSize = (Get-Item $BackupFile).Length
    Write-Host "[$((Get-Date).ToString('s'))] [SUCCESS] Backup completed successfully. Size: $FileSize bytes" -ForegroundColor Green
} else {
    Write-Host "[$((Get-Date).ToString('s'))] [FATAL] pg_dump failed with exit code $dumpExit" -ForegroundColor Red
    exit 1
}

# Retention cleanup
if ($RetentionDays -gt 0) {
    $Cutoff = (Get-Date).AddDays(-$RetentionDays)
    Get-ChildItem -Path $BackupDir -Filter "${DbName}_backup_*.dump" | Where-Object { $_.LastWriteTime -lt $Cutoff } | ForEach-Object {
        Write-Host "[$((Get-Date).ToString('s'))] [INFO] Pruning old backup: $($_.FullName)"
        Remove-Item $_.FullName -Force
    }
}
