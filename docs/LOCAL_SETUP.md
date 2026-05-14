# Local Setup (NextStay)

## Requirements

- Docker Desktop + Docker Compose
- Node.js 18+ (npm)
- Python 3.11+ (optional, for running backend without Docker)

## Quick start (Full Docker)

### 1) Create root `.env`

Create a `.env` file in the repository root:

```env
DB_NAME=nextstay
DB_USER=nextstay
DB_PASSWORD=nextstay
SUPERSET_SECRET_KEY=dev
```

### 2) Start all services

```bash
docker compose up -d
```

Check:
- Backend health: `http://localhost:8000/api/v1/health`
- API docs: `http://localhost:8000/docs`
- Postgres on host: `localhost:5433`

Frontend: `http://localhost:5173`

### 4) Frontend env

`frontend/.env`:

```env
VITE_USE_MOCK_API=false
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

## Optional: run backend locally (no Docker)

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Stop

```bash
docker compose down
```

## Test credentials (auth stub)

- Admin: `admin@nextstay.com` / `admin`
- Staff: `staff@nextstay.com` / `staff`

## Useful commands

```bash
docker compose logs -f backend
docker compose ps
docker compose build backend
```
