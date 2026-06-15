#!/usr/bin/env bash
# NextStay local dev — DB + backend + frontend via Docker Compose
set -euo pipefail
cd "$(dirname "$0")/.."

echo "NextStay dev: starting db + backend + frontend..."
if [[ "${1:-}" == "-d" || "${1:-}" == "--detach" ]]; then
  docker compose up -d db backend frontend
  echo ""
  echo "Services running:"
  echo "  Frontend  http://localhost:5173"
  echo "  Backend   http://localhost:8000/api/v1/health"
  echo "  Postgres  localhost:5433"
  exit 0
fi

docker compose up db backend frontend
