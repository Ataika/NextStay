# Troubleshooting (NextStay)

This file consolidates common setup and runtime issues for NextStay (Windows + Docker Desktop + local dev).

## Backend not reachable / “Server is not responding”

### Quick checks

1. **Backend health**

```bash
curl http://localhost:8000/api/v1/health
```

Expected:

```json
{"status":"ok"}
```

2. **Frontend API URL**

`frontend/.env` should contain:

```env
VITE_USE_MOCK_API=false
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

After editing `.env`, **restart Vite** (`npm run dev`).

3. **Mock mode (temporary)**

If you want the UI without backend:

```env
VITE_USE_MOCK_API=true
```

## Docker: “cannot connect to the docker API … dockerDesktopLinuxEngine”

This means **Docker Desktop is not running** (or the daemon is unavailable).

- Start **Docker Desktop**
- Wait until it is fully started
- Re-try:

```bash
docker ps
docker compose up -d
```

## Docker volume mount error on Windows

Typical error:

```
error while creating mount source path '/run/desktop/mnt/host/...': mkdir ...: file exists
```

Fixes (try in this order):

1. **Restart Docker Desktop**
2. Docker Desktop → **Settings → Resources → File Sharing** → ensure `C:` is enabled → **Apply & Restart**
3. As a workaround, run only the DB in Docker and run backend locally (see below)

## Run backend locally (without Docker)

1. Install dependencies:

```bash
cd backend
pip install -r requirements.txt
```

2. Ensure you have DB env vars (root `.env` for Docker, or your shell env). If your DB runs in Docker Compose, port is usually **5433** on host.

3. Start backend:

```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Fresh DB: backend crashes on startup (`UndefinedColumn`, `preferred_language`, `failed_login_attempts`)

**Cause:** Older `scripts/init-db.sql` created a legacy `users` table; backend migrations then INSERT rows with columns that did not exist yet.

**Fix in repo (already applied):** auth tables were removed from `init-db.sql`; backend owns schema via `create_all()` + `backend/migrations/`. Migration `00_sync_user_columns.sql` aligns legacy DBs.

**If you still have a broken volume from an old init:**

```bash
docker compose down
docker volume rm nextstay_nextstay_data_v2
docker compose up -d db backend frontend
```

Or keep data and restart backend only — migrations should add missing columns on startup.

**Recommended dev start (no manual uvicorn):**

```bash
docker compose up db backend frontend
# or: npm run dev
# Windows: .\scripts\dev.ps1
```

## Database migration: missing columns (e.g. `bookings.guest_email does not exist`)

Run the SQL migration:

```bash
docker exec -i nextstay_db_clean psql -U nextstay -d nextstay < backend/migrations/add_stripe_fields.sql
```

Verify:

```bash
curl http://localhost:8000/api/v1/bookings
```

## Stripe issues

### “Stripe is not configured. Please set STRIPE_SECRET_KEY.”

Add the key to **`backend/.env`** (not frontend), then restart backend.

### Webhook doesn’t work locally

Local Stripe webhooks do not reach `localhost` by default. Use Stripe CLI:

```bash
stripe listen --forward-to localhost:8000/api/v1/stripe/webhook
```

Note: NextStay also confirms the booking on the success page via
`GET /api/v1/stripe/confirm-and-get-booking?session_id=...`, so the booking can still become **Confirmed** when the guest lands on `/booking/success`.

## Ports are busy

### Port 8000 busy (backend)

Windows:

```bash
netstat -ano | findstr :8000
```

Change backend port, then update `VITE_API_BASE_URL` accordingly.

## Where to look for errors

- **Backend logs**: the terminal where `uvicorn` is running
- **Frontend logs**: the terminal where `npm run dev` is running
- **Browser**: DevTools → Network tab (check request URL/status/response)
