# Frontend ↔ Backend integration

## Current stack

- Frontend: React + TypeScript + Vite, Axios
- Backend: FastAPI + SQLAlchemy, API prefix `/api/v1`

## Configure frontend API URL

Create/edit `frontend/.env`:

```env
VITE_USE_MOCK_API=false
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

Restart Vite after changes.

## Run backend

Docker:

```bash
docker compose up -d
```

Local:

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Health check:

```bash
curl http://localhost:8000/api/v1/health
```

## CORS

Backend CORS is configured in `backend/app/main.py`.

Note: `allow_credentials` is set to `false` (required when using `*` fallback origin).

## Mock vs real API

- Mock mode: `VITE_USE_MOCK_API=true`
- Real mode: `VITE_USE_MOCK_API=false` and backend must be running

## API coverage

The backend implements Rooms/Bookings/Tasks/Guest/Stripe endpoints. See:
- `backend/app/api/v1/README.md`
- `PROJECT_FEATURES.md`

## Troubleshooting

See `TROUBLESHOOTING.md`.
