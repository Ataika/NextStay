## Quick Start (NextStay)

### Option A: Frontend only (Mock API)

1. Set in `frontend/.env`:

```env
VITE_USE_MOCK_API=true
```

2. Start frontend:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

### Option B: Backend + Frontend (recommended for real data)

1. Start backend:

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Check:

```bash
curl http://localhost:8000/api/v1/health
```

2. Set in `frontend/.env`:

```env
VITE_USE_MOCK_API=false
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

3. Start frontend:

```bash
cd frontend
npm run dev
```

### Option C: Docker Compose (Full Stack — recommended)

One command (DB + backend + frontend, no manual uvicorn):

```bash
docker compose up db backend frontend
```

Or from repo root:

```bash
npm run dev
```

Windows PowerShell:

```powershell
.\scripts\dev.ps1
```

Detached (background):

```bash
docker compose up -d db backend frontend
npm run dev:detached
```

Full stack including Airflow/Superset/dbt:

```bash
docker compose up -d
```

### Option D: Hybrid (DB in Docker, backend/frontend on host)

If you prefer local Python/Node but not manual two-terminal startup:

```powershell
.\scripts\dev-local.ps1
```

Requires `.venv` with `pip install -r backend/requirements.txt` and `frontend/npm install`.

### Help

- Full setup: `LOCAL_SETUP.md`
- Common issues: `TROUBLESHOOTING.md`
- Stripe setup: `STRIPE_SETUP.md`
