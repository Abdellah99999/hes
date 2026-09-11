<#
.SYNOPSIS
    PostgreSQL Restore Script for HES Production / Staging
.DESCRIPTION
    Restores a database from a compressed custom-format (-F c) dump with verification.
.PARAMETER DumpFile
    Path to the .dump file to restore
.PARAMETER TargetDb
    Target database name
.PARAMETER DbHost
    PostgreSQL Host (default: localhost)
.PARAMETER DbPort
    PostgreSQL Port (default: 5432)
.PARAMETER DbUser
    PostgreSQL User (default: postgres)
.PARAMETER PgBinPath
    Path to PostgreSQL bin directory containing pg_restore.exe and psql.exe
#>
param(
    [Parameter(Mandatory=$true)]
    [string]$DumpFile,
    [string]$TargetDb = "delivery",
    [string]$DbHost = "localhost",
    [string]$DbPort = "5432",
    [string]$DbUser = "postgres",
    [string]$PgBinPath = "C:\Program Files\PostgreSQL\18\bin"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $DumpFile)) {
    throw "Dump file not found: $DumpFile"
}

$PgRestore = Join-Path $PgBinPath "pg_restore.exe"
if (-not (Test-Path $PgRestore)) {
    $PgRestoreCmd = Get-Command "pg_restore.exe" -ErrorAction SilentlyContinue
    if ($PgRestoreCmd) { $PgRestore = $PgRestoreCmd.Source } else { throw "pg_restore.exe not found." }
}

$Psql = Join-Path $PgBinPath "psql.exe"
if (-not (Test-Path $Psql)) {
    $PsqlCmd = Get-Command "psql.exe" -ErrorAction SilentlyContinue
    if ($PsqlCmd) { $Psql = $PsqlCmd.Source } else { throw "psql.exe not found." }
}

$LogFile = "$DumpFile.restore_$((Get-Date).ToString('yyyyMMdd_HHmmss')).log"

Write-Host "[$((Get-Date).ToString('s'))] [WARNING] Restoring into database '$TargetDb' on ${DbHost}:${DbPort}..." -ForegroundColor Yellow
Write-Host "[$((Get-Date).ToString('s'))] [INFO] Source dump: $DumpFile"

$RestoreArgs = @(
    "-h", $DbHost,
    "-p", $DbPort,
    "-U", $DbUser,
    "-d", $TargetDb,
    "--clean",
    "--if-exists",
    "--no-owner",
    "--no-acl",
    "-v",
    $DumpFile
)

$prevEAP = $ErrorActionPreference
$ErrorActionPreference = "Continue"

try {
    & $PgRestore @RestoreArgs 2>&1 | Tee-Object -FilePath $LogFile
    $restoreExit = $LASTEXITCODE
} finally {
    $ErrorActionPreference = $prevEAP
}

if ($restoreExit -eq 0 -or $restoreExit -eq 1) {
    Write-Host "[$((Get-Date).ToString('s'))] [SUCCESS] pg_restore completed with code $restoreExit" -ForegroundColor Green
} else {
    Write-Host "[$((Get-Date).ToString('s'))] [FATAL] pg_restore failed with exit code $restoreExit. Check $LogFile" -ForegroundColor Red
    exit $restoreExit
}

# Sanity check: count public tables
Write-Host "[$((Get-Date).ToString('s'))] [INFO] Verifying restored schema in '$TargetDb'..."
$VerifyQuery = "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';"
$TableCount = (& $Psql -h $DbHost -p $DbPort -U $DbUser -d $TargetDb -t -A -c $VerifyQuery).Trim()

Write-Host "[$((Get-Date).ToString('s'))] [SUCCESS] Restored table count in public schema: $TableCount" -ForegroundColor Green
return $TableCount
