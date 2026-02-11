# API Seed (Business-Logic Validation)

This seed path creates test data through the backend API to validate business rules.

## Requirements
- Backend running at `http://localhost:8000`
- `.env` configured with `VITE_API_BASE_URL` (optional, script uses direct backend URL)

## Run

```bash
bash scripts/seed/api/seed_api.sh
```

## What it does
- Creates rooms via `/api/v1/rooms`
- Creates bookings via `/api/v1/bookings`
- Produces guest tokens and tasks via API logic
