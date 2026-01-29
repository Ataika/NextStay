# NextStay 🏨

A Property Management System (PMS) designed to automate hotel operations, optimize workflows, and provide business intelligence.

## Tech Stack

- **Frontend:** React 19 + TypeScript + Tailwind CSS (Vite)
- **Backend:** FastAPI + SQLAlchemy + PostgreSQL 15
- **Analytics:** dbt Core + Apache Superset
- **Infrastructure:** Docker & Docker Compose

## Quick Start

See [LOCAL_SETUP.md](./docs/LOCAL_SETUP.md) for detailed setup instructions.

```bash
# Start database and backend
docker-compose up db backend

# In another terminal, start frontend
cd frontend
npm install
npm run dev
```

**Access:**
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000/api/v1
- API Docs: http://localhost:8000/docs

## Project Structure

```
NextStay/
├── backend/          # FastAPI backend application
├── frontend/         # React frontend application
├── docs/             # Project documentation
├── scripts/          # Database initialization scripts
├── analytics/        # dbt configuration
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

This project fulfills three functional categories:

**Category A (CRUD):** Room inventory, bookings, staff management  
**Category B (3rd Party):** Telegram Bot, PDF generation, SMTP  
**Category C (Algorithms):** Dynamic pricing, task prioritization, DWH pipelines

## Documentation

- [Local Setup Guide](./docs/LOCAL_SETUP.md) - How to run the project locally
- [Project Structure](./docs/PROJECT_STRUCTURE.md) - Detailed file structure
- [Architecture](./docs/architecture.md) - System architecture
- [SRS](./docs/srs.md) - Software Requirements Specification
- [API Documentation](./backend/app/api/v1/README.md) - API endpoints status

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
