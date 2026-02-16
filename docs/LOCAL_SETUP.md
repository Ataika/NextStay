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

### 2) Create `backend/.env`

Use `backend/.env.example` as template and create `backend/.env`.

Minimum required for OTP login:

```env
BREVO_API_KEY=your_brevo_api_key
BREVO_SENDER_EMAIL=verified_sender@example.com
BREVO_SENDER_NAME=NextStay
OTP_SECRET=change-me
AUTH_JWT_SECRET=change-me
DEV_BYPASS_EMAILS=nextstay@yandex.com,staff.uborka@yandex.com
DEV_BYPASS_PASSWORD=AtaiDairTurat
```

### 3) Start all services

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

## Test credentials (OTP auth)

- Admin: `admin@nextstay.com` (OTP by email)
- Staff: `staff@nextstay.com` (OTP by email)
- Dev bypass (password, no OTP): `nextstay@yandex.com`, `staff.uborka@yandex.com`

Users are seeded by `scripts/init-db.sql` into `oltp.users`.
Detailed matrix (roles, companies, OTP vs password): `docs/DEV_AUTH_ACCOUNTS.md`.
Team synchronization (DB snapshot + DAG/Superset): `docs/TEAM_SYNC.md`.

## Useful commands

```bash
docker compose logs -f backend
docker compose ps
docker compose build backend
```
