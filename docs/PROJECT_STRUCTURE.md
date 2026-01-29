# NextStay Project Structure

Short description of folders and files in this repository.

## Root

### Key files
- **`.env`**: Docker Compose environment variables (DB credentials, secrets)
- **`.gitignore`**: Git ignore rules
- **`docker-compose.yml`**: Docker services (DB, backend, optional analytics)
- **`README.md`**: Main project README
- **`LOCAL_SETUP.md`**: Detailed local setup

### Key folders
- **`backend/`**: FastAPI backend
- **`frontend/`**: React + TypeScript frontend
- **`docs/`**: Architecture/SRS and diagrams
- **`scripts/`**: DB init scripts (legacy/optional)
- **`analytics/`**: dbt/Superset (optional)
- **`.github/`**: GitHub Actions

---

## Backend (`backend/`)

### Config
- **`Dockerfile`**: Backend container image
- **`requirements.txt`**: Python dependencies

### Migrations (`backend/migrations/`)
- **`add_stripe_fields.sql`**: Adds Stripe/email fields to `bookings`

### App (`backend/app/`)

#### Entry / error handling
- **`main.py`**: FastAPI app, routers, CORS
- **`exceptions.py`**: Exception handlers (including DB connection errors)

#### Core config (`app/core/`)
- **`config.py`**: DB URL builder + Stripe/SMTP config via env vars

#### DB (`app/db/`)
- **`base.py`**, **`session.py`**

#### Models (`app/models/`)
- **`room.py`**, **`booking.py`**, **`task.py`**, **`guest_token.py`**

#### Services (`app/services/`)
- **`email_service.py`**: SMTP email (optional)

#### API (`app/api/v1/`)
- **`health.py`**: `GET /api/v1/health`
- **`rooms.py`**: Rooms CRUD + availability search
- **`bookings.py`**: Bookings CRUD + guest token creation
- **`tasks.py`**: Cleaning tasks CRUD-style operations
- **`guest.py`**: Guest token access + checkout
- **`stripe.py`**: Stripe checkout + webhooks + success-page confirmation
- **`auth.py`**: Stub login/logout

---

## Frontend (`frontend/`)

### Key files
- **`package.json`**, **`vite.config.ts`**, **`tsconfig.json`**
- **`frontend/.env`**: `VITE_*` environment variables

### Source (`frontend/src/`)
- **`api/`**: HTTP client + API wrappers + mock API
- **`router/`**: React Router routes
- **`pages/`**:
  - `booking/` (public booking flow + success/cancel)
  - `guest/` (guest access by token)
  - `admin/` (admin dashboard + bookings management)
  - `staff/` (cleaning tasks)

---

## Documentation

### Top-level docs (recommended entry points)
- **`QUICK_START.md`**: Fast start
- **`LOCAL_SETUP.md`**: Detailed setup
- **`TROUBLESHOOTING.md`**: Common issues (Docker, DB, network)
- **`STRIPE_SETUP.md`**: Stripe configuration
- **`HOW_TO_BOOK.md`**: Booking flow description
- **`PROJECT_FEATURES.md`**: Feature / operations overview

### `docs/`
- **`docs/architecture.md`**
- **`docs/srs.md`**
- **`docs/frontend-backend-integration.md`**
