# NextStay hybrid dev — DB in Docker, backend + frontend on host (no manual uvicorn/npm in separate terminals)
# Prerequisites: Python venv with backend deps, frontend npm install, backend/.env + frontend/.env
# Usage: .\scripts\dev-local.ps1

$ErrorActionPreference = "Stop"
$Root = Join-Path $PSScriptRoot ".."
Set-Location $Root

Write-Host "Starting Postgres (Docker)..." -ForegroundColor Cyan
docker compose up -d db

Write-Host "Waiting for Postgres on localhost:5433..." -ForegroundColor Cyan
$ready = $false
for ($i = 0; $i -lt 30; $i++) {
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $tcp.Connect("127.0.0.1", 5433)
        $tcp.Close()
        $ready = $true
        break
    } catch {
        Start-Sleep -Seconds 1
    }
}
if (-not $ready) {
    Write-Error "Postgres did not become ready on port 5433. Check: docker compose logs db"
}

$venvPython = Join-Path $Root ".venv\Scripts\python.exe"
if (-not (Test-Path $venvPython)) {
    Write-Error "Missing .venv. Create it: python -m venv .venv && .\.venv\Scripts\pip install -r backend\requirements.txt"
}

Write-Host "Starting backend (uvicorn) and frontend (vite)..." -ForegroundColor Cyan
Write-Host "  Frontend  http://localhost:5173"
Write-Host "  Backend   http://localhost:8000/api/v1/health"
Write-Host "  Ctrl+C stops both processes" -ForegroundColor DarkGray

$backend = Start-Process -PassThru -WorkingDirectory (Join-Path $Root "backend") -FilePath $venvPython `
    -ArgumentList "-m", "uvicorn", "app.main:app", "--reload", "--host", "0.0.0.0", "--port", "8000"
$frontend = Start-Process -PassThru -WorkingDirectory (Join-Path $Root "frontend") -FilePath "npm.cmd" `
    -ArgumentList "run", "dev"

try {
    Wait-Process -Id $backend.Id, $frontend.Id
} finally {
    if (-not $backend.HasExited) { Stop-Process -Id $backend.Id -Force -ErrorAction SilentlyContinue }
    if (-not $frontend.HasExited) { Stop-Process -Id $frontend.Id -Force -ErrorAction SilentlyContinue }
}
