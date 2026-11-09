param(
  [string]$Psql = "C:\Program Files\PostgreSQL\18\bin\psql.exe",
  [string]$HostName = "localhost",
  [int]$Port = 5432,
  [string]$User = "postgres",
  [string]$Database = "delivery"
)

$ErrorActionPreference = "Stop"
if (-not (Test-Path $Psql)) { throw "psql not found: $Psql" }

if ([string]::IsNullOrWhiteSpace($env:PGPASSWORD)) {
  $env:PGPASSWORD = "0000"
}
$queries = @{
  database = "select current_database(), version();"
  migrations = "select migration_name, finished_at from _prisma_migrations order by started_at;"
  seed_counts = "select 'users',count(*) from users union all select 'agencies',count(*) from agencies union all select 'cities',count(*) from cities union all select 'zones',count(*) from zones union all select 'parcel_types',count(*) from parcel_types union all select 'package_types',count(*) from package_types union all select 'services',count(*) from services union all select 'refusal_reasons',count(*) from refusal_reasons union all select 'permissions',count(*) from permissions union all select 'customers',count(*) from customers;"
}

foreach ($name in $queries.Keys) {
  Write-Output "=== $name ==="
  & $Psql -X -P pager=off -h $HostName -p $Port -U $User -d $Database -Atc $queries[$name]
  if ($LASTEXITCODE -ne 0) { throw "psql failed for $name with exit code $LASTEXITCODE" }
}
