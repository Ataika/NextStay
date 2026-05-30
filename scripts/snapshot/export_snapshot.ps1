# PowerShell script to export DB snapshot
# Usage: .\scripts\snapshot\export_snapshot.ps1

$ErrorActionPreference = "Stop"

# Load .env file
$envFile = Join-Path $PSScriptRoot "..\..\.env"
if (-not (Test-Path $envFile)) {
    Write-Error ".env file not found at $envFile"
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

$SNAPSHOT_DIR = if ($env:SNAPSHOT_DIR) { $env:SNAPSHOT_DIR } else { Join-Path $PSScriptRoot "..\..\scripts\snapshot\out" }
$STAMP = Get-Date -Format "yyyyMMdd_HHmmss"
$SNAPSHOT_FILE = if ($env:SNAPSHOT_FILE) { $env:SNAPSHOT_FILE } else { Join-Path $SNAPSHOT_DIR "nextstay_snapshot_${STAMP}.dump" }

# Schemas to export
$SNAPSHOT_SCHEMAS = if ($env:SNAPSHOT_SCHEMAS) { $env:SNAPSHOT_SCHEMAS } else { "oltp stg core mart simulator" }

New-Item -ItemType Directory -Force -Path $SNAPSHOT_DIR | Out-Null

Write-Host "Exporting snapshot from DB '$DB_NAME' as user '$DB_USER'"
Write-Host "Target: $SNAPSHOT_FILE"

# Build schema flags
$schemaFlags = @()
foreach ($schema in $SNAPSHOT_SCHEMAS.Split(' ')) {
    $schemaFlags += "-n"
    $schemaFlags += $schema
}

docker exec -i nextstay_db_clean pg_dump `
    -U $DB_USER `
    -d $DB_NAME `
    -Fc `
    --no-owner `
    --no-privileges `
    $schemaFlags | Set-Content -Path $SNAPSHOT_FILE -Encoding Byte -NoNewline

if ($LASTEXITCODE -eq 0) {
    Write-Host "DONE"
    Write-Host "Snapshot created: $SNAPSHOT_FILE"
} else {
    Write-Error "Export failed with exit code $LASTEXITCODE"
    exit $LASTEXITCODE
}
