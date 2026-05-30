# PowerShell script to initialize DB, seed data, and create snapshot
$ErrorActionPreference = "Stop"

Write-Host "=== Creating temporary snapshot ===" -ForegroundColor Cyan
Write-Host ""

# Load .env file
$envFile = Join-Path $PSScriptRoot "..\..\.env"
if (-not (Test-Path $envFile)) {
    Write-Error ".env file not found"
    exit 1
}

# Read .env variables
Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*([^#][^=]*)=(.*)$') {
        $key = $matches[1].Trim()
        $value = $matches[2].Trim()
        [Environment]::SetEnvironmentVariable($key, $value, "Process")
    }
}

$DB_NAME = if ($env:DB_NAME) { $env:DB_NAME } else { "nextstay" }
$DB_USER = if ($env:DB_USER) { $env:DB_USER } else { "nextstay" }

Write-Host "Step 1/3: Initializing database schema..." -ForegroundColor Yellow
$initDbScript = Join-Path $PSScriptRoot "..\..\scripts\init-db.sql"
if (-not (Test-Path $initDbScript)) {
    Write-Error "init-db.sql not found"
    exit 1
}

Get-Content $initDbScript | docker exec -i nextstay_db_clean psql -U $DB_USER -d $DB_NAME
if ($LASTEXITCODE -ne 0) {
    Write-Error "Database initialization failed"
    exit $LASTEXITCODE
}
Write-Host "Database schema created" -ForegroundColor Green
Write-Host ""

Write-Host "Step 2/3: Seeding test data..." -ForegroundColor Yellow
$seedScript = Join-Path $PSScriptRoot "..\..\scripts\seed\seed.sql"
if (-not (Test-Path $seedScript)) {
    Write-Error "seed.sql not found"
    exit 1
}

Get-Content $seedScript | docker exec -i nextstay_db_clean psql -U $DB_USER -d $DB_NAME
if ($LASTEXITCODE -ne 0) {
    Write-Error "Data seeding failed"
    exit $LASTEXITCODE
}
Write-Host "Test data seeded" -ForegroundColor Green
Write-Host ""

Write-Host "Step 3/3: Creating snapshot..." -ForegroundColor Yellow
$SNAPSHOT_DIR = Join-Path $PSScriptRoot "out"
$STAMP = Get-Date -Format "yyyyMMdd_HHmmss"
$SNAPSHOT_FILE = Join-Path $SNAPSHOT_DIR "nextstay_snapshot_${STAMP}.dump"

New-Item -ItemType Directory -Force -Path $SNAPSHOT_DIR | Out-Null

$schemaFlags = @("-n", "oltp", "-n", "stg", "-n", "core", "-n", "mart", "-n", "simulator")

docker exec nextstay_db_clean pg_dump -U $DB_USER -d $DB_NAME -Fc --no-owner --no-privileges $schemaFlags -f /tmp/snapshot.dump
docker cp nextstay_db_clean:/tmp/snapshot.dump $SNAPSHOT_FILE
docker exec nextstay_db_clean rm /tmp/snapshot.dump

if ($LASTEXITCODE -eq 0) {
    Write-Host "Snapshot created successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Snapshot file: $SNAPSHOT_FILE" -ForegroundColor Cyan
} else {
    Write-Error "Snapshot creation failed"
    exit $LASTEXITCODE
}
