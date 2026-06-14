# NextStay local dev — one command to start DB + backend + frontend (Docker)
# Usage: .\scripts\dev.ps1
#        .\scripts\dev.ps1 -Detached

param(
    [switch]$Detached
)

$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

Write-Host "NextStay dev: starting db + backend + frontend..." -ForegroundColor Cyan

if ($Detached) {
    docker compose up -d db backend frontend
    Write-Host ""
    Write-Host "Services running in background:" -ForegroundColor Green
    Write-Host "  Frontend  http://localhost:5173"
    Write-Host "  Backend   http://localhost:8000/api/v1/health"
    Write-Host "  Postgres  localhost:5433"
    Write-Host ""
    Write-Host "Logs: docker compose logs -f backend frontend"
    exit 0
}

docker compose up db backend frontend
