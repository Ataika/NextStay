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

### Option C: Docker Compose

```bash
docker compose up -d db backend
```

### Help

- Full setup: `LOCAL_SETUP.md`
- Common issues: `TROUBLESHOOTING.md`
- Stripe setup: `STRIPE_SETUP.md`
