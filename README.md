# NextStay 🏨

A Property Management System (PMS) designed to automate hotel operations, optimize workflows, and provide business intelligence.

## Tech Stack

- **Frontend:** React 19 + TypeScript + Tailwind CSS (Vite)
- **Backend:** FastAPI + SQLAlchemy + PostgreSQL 15
- **Analytics:** dbt Core + Apache Superset
- **Infrastructure:** Docker & Docker Compose, Apache Airflow

## Quick Start

See [QUICK_START.md](./QUICK_START.md) or [LOCAL_SETUP.md](./docs/LOCAL_SETUP.md) for detailed setup.

```bash
# Start full stack (db + backend + frontend + airflow + superset + dbt)
docker compose up -d
```

**Access:**
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000/api/v1
- API Docs: http://localhost:8000/docs
- Airflow: http://localhost:8080
- Superset: http://localhost:8088

## Full infrastructure (DB + Backend + Airflow + Superset + dbt)

```bash
# 1. Configure .env
# 2. Deploy all services
docker-compose up -d --build

# 3. Run setup script (if available)
chmod +x scripts/setup_all.sh
./scripts/setup_all.sh
```

## Project Structure

```
NextStay/
├── backend/          # FastAPI backend application
├── frontend/         # React frontend application
├── docs/             # Project documentation
├── scripts/          # Database initialization & setup scripts
├── analytics/        # dbt, Superset, Airflow dags
└── docker-compose.yml
```

For detailed structure, see [PROJECT_STRUCTURE.md](./docs/PROJECT_STRUCTURE.md).

## Features

### Implemented ✅
- Room management (CRUD)
- Booking system with guest tokens
- Cleaning task management
- Guest self-service portal (token-based access)
- Automatic task creation on checkout
- RESTful API with FastAPI

## Academic Requirements

**Category A (CRUD):** Room inventory, bookings, staff management
**Category B (3rd Party):** Telegram Bot, PDF generation, SMTP, Superset
**Category C (Algorithms):** Dynamic pricing, task prioritization, DWH pipelines (STG → CORE → MART)

## Documentation

- [Quick Start](./QUICK_START.md)
- [Local Setup](./docs/LOCAL_SETUP.md)
- [Project Structure](./docs/PROJECT_STRUCTURE.md)
- [SRS](./docs/srs.md)
- [API Documentation](./backend/app/api/v1/README.md)

## Development

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Test Credentials (stub)
- Admin: `admin@nextstay.com` / `admin`
- Staff: `staff@nextstay.com` / `staff`

## Team

- **Dair:** Backend API, Algorithms
- **Atay:** Data Architecture, dbt, BI
- **Turat:** Frontend, Integrations
