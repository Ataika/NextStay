# Merge: dev + integration/fullstack

This document describes the outcome of merging the **dev** branch into **integration/fullstack** (resulting branch: **merge-dev**).

---

## 1. What was added (from the dev branch)

### Infrastructure and orchestration

- **Airflow service** in `docker-compose.yml`  
  - Image: `apache/airflow:2.7.1-python3.10`  
  - Port: 8080  
  - Mounts: `analytics/dags`, `analytics/dbt`, `analytics/profiles.yml`, `scripts`  
  - Command: `standalone`

- **dbt service** in `docker-compose.yml` (extended)  
  - Build via `Dockerfile.dbt`  
  - Mode: `tty: true`, `stdin_open: true`, `entrypoint: /bin/bash`, `command: sleep infinity`  
  - Volumes: `./analytics/dbt:/usr/app`, `./analytics/profiles.yml:/root/.dbt/profiles.yml`

- **Superset volume**  
  - `./analytics/superset:/app/superset_home`

### Analytics (dbt)

- **dbt project structure** under `analytics/dbt/`:
  - `dbt_project.yml` — project configuration
  - `profiles.yml` — database connection profile
  - `models/example/` — example models (`my_first_dbt_model.sql`, `my_second_dbt_model.sql`, `schema.yml`)
  - `models/staging/` — sources and staging model (`sources.yml`, `stg_rooms.sql`)
  - `models/test_ci.sql`
  - Placeholder folders: `macros/`, `seeds/`, `snapshots/`, `tests/` (including `.gitkeep`)
  - `README.md`, `.gitignore`, `.user.yml`

- **Root `analytics/profiles.yml`** — used by both the dbt container and Airflow.

### Scripts and environment

- **Deploy and setup scripts** in `scripts/`:
  - `setup_all.sh` — master setup script
  - `setup.sh` — helper script
  - `init-analytics.sh` — analytics initialization

- **Root `.env.example`** — template for project environment variables.

- **`pyproject.toml`** in the project root — Python project configuration (tools, linters, etc.).

### Documentation

- **`docs/CONTRIBUTING.md`** — contribution guidelines for the project.

### Database (init-db.sql)

- **Developer roles** (from dev): creation of users `dair_dev`, `turat_dev` on DB initialization.
- **DWH layer in init-db.sql**:
  - ENUM types: `room_status_enum`, `room_type_enum`, `user_role_enum`, `booking_status_enum`, `task_status_enum`, `loyalty_tier_enum`
  - **STG (Staging):** tables `stg_rooms`, `stg_users`, `stg_clients`, `stg_bookings`, `stg_cleaning_tasks`
  - **CORE (DDS):** tables `core_rooms`, `core_clients`, `core_bookings`
  - **MART:** tables `mart_fact_occupancy`, `mart_customer_loyalty`, `mart_revpar_daily`

### Other

- **`scripts/db_backup.sql`** — database dump/backup (from dev).
- **`nextstayos/.idea/`** folder — IDE settings (can be excluded from commits if desired).

---

## 2. What was changed (merged during conflict resolution)

Several files had merge conflicts. The following decisions were applied in the final version (merge-dev).

### Docker and configuration

- **`docker-compose.yml`**  
  - Single consolidated config: db, backend (with `command: uvicorn ... --reload`), airflow, superset (with volume), dbt (with Dockerfile.dbt and `sleep infinity`).  
  - DB container name: `nextstay_db_clean` (no trailing spaces).

### Backend

- **`backend/app/main.py`**  
  - Kept: FastAPI and CORS imports, all routers (health, rooms, tasks, bookings, auth, guest, stripe), `register_exception_handlers(app)` call, commented-out `Base.metadata.create_all`.

- **`backend/app/core/config.py`**  
  - Kept integration/fullstack config: building `DATABASE_URL` from `DB_USER`/`DB_PASSWORD`/`DB_NAME` or from `DATABASE_URL`, plus Stripe, SMTP, `FRONTEND_URL`.

- **`backend/app/db/session.py`**  
  - Kept engine with `connect_args={"connect_timeout": 5}` (integration version).

- **`backend/app/exceptions.py`**  
  - Merged: `register_exception_handlers(app)` from dev and the full set of handlers from integration/fullstack (HTTP, validation, OperationalError, generic).

### Frontend

- **`frontend/src/index.css`**  
  - Kept the overlay/drawer comment (integration version).

- **`frontend/src/pages/LoginPage.tsx`**  
  - Kept the full login form from integration/fullstack (email/password, API, dev buttons Owner/Staff, test accounts).

- **`frontend/src/pages/admin/AdminPage.tsx`**  
  - Kept the full admin panel (rooms, stats, filters, modals, etc.).

- **`frontend/src/pages/guest/GuestPage.tsx`**  
  - Kept the full guest page (QR, details, checkout, modals, contact).

- **`frontend/src/pages/staff/StaffPage.tsx`**  
  - Kept the full tasks page (stats, filters, task cards, modals).

### Scripts and database

- **`scripts/init-db.sql`**  
  - Merged: `superset_ro` user and `GRANT CONNECT ON DATABASE nextstay` (as in integration/fullstack), plus `dair_dev`/`turat_dev` roles and the full DWH layer (ENUMS, STG, CORE, MART) from dev.

### Documentation

- **`README.md`**  
  - Merged: Quick Start, project structure, features, and doc links from integration/fullstack; added full-deploy section (`docker-compose up -d --build`, `scripts/setup_all.sh`) and Airflow mention from dev.

---

## 3. Resulting structure after the merge

- **Branch merge-dev** contains:
  - Full backend and frontend from **integration/fullstack** (API, bookings, guests, tasks, Stripe, SMTP, admin panel, guest and staff pages).
  - From **dev**: Airflow and updated dbt in docker-compose, dbt project (models, staging, example), scripts `setup_all.sh`/`setup.sh`, extended `init-db.sql` (DWH), `.env.example`, `pyproject.toml`, CONTRIBUTING, db_backup.sql.

To clarify or extend this, edit this file or add a separate CHANGELOG.