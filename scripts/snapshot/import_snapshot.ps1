# PowerShell script to import DB snapshot
# Usage: .\scripts\snapshot\import_snapshot.ps1 "C:\path\to\snapshot.dump"

param(
    [Parameter(Mandatory=$true)]
    [string]$SnapshotFile
)

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

if (-not (Test-Path $SnapshotFile)) {
    Write-Error "Snapshot file not found: $SnapshotFile"
    exit 1
}

Write-Host "Importing snapshot into DB '$DB_NAME' as user '$DB_USER'"
Write-Host "Source: $SnapshotFile"

# Convert to absolute path if relative
if (-not [System.IO.Path]::IsPathRooted($SnapshotFile)) {
    $SnapshotFile = Join-Path $PSScriptRoot "..\..\$SnapshotFile"
    $SnapshotFile = [System.IO.Path]::GetFullPath($SnapshotFile)
}

# Copy dump file into container
$tempDumpPath = "/tmp/snapshot_import.dump"
docker cp "$SnapshotFile" "nextstay_db_clean:$tempDumpPath"

if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to copy dump file into container"
    exit $LASTEXITCODE
}

# Restore from file inside container
docker exec nextstay_db_clean pg_restore `
    -U $DB_USER `
    -d $DB_NAME `
    --clean `
    --if-exists `
    --no-owner `
    --no-privileges `
    $tempDumpPath

$restoreExitCode = $LASTEXITCODE

# Clean up temp file
docker exec nextstay_db_clean rm -f $tempDumpPath | Out-Null

if ($restoreExitCode -eq 0) {
    Write-Host "DONE"
} else {
    Write-Error "Import failed with exit code $restoreExitCode"
    exit $restoreExitCode
}
