# Test Data Seed

This folder contains scripts to populate the OLTP schema (`oltp`) with predictable test data.

## Usage

```bash
bash scripts/seed/seed_db.sh
```

Notes:
- This will **clear** existing OLTP tables before inserting seed data.
- Target DB is read from the root `.env`.

## Alternative: Seed Through API

If you want to validate backend business logic (status transitions, validation rules),
use the API-based seed script instead:

```bash
bash scripts/seed/api/seed_api.sh
```

Notes:
- Requires backend to be running.
- Slower, but exercises real API flow.
