System Architecture — NextStay

1. Technical Stack
Frontend: React + TypeScript + Tailwind (Vite).
Backend: Python + FastAPI + SQLAlchemy.
Database: PostgreSQL 15 (OLTP + DWH).
Data Engineering: dbt Core (ELT).
BI Platform: Apache Superset.
Infrastructure: Docker + Docker Compose.

2. System Components (SOA)
Presentation Layer (Frontend): SPA for Owner/Staff/Guest flows.
Logic Layer (Backend): FastAPI API + business workflows + 3rd‑party integrations (Stripe, SMTP, etc.).
Data Layer (PostgreSQL): OLTP source-of-truth + DWH schemas.
Analytics Layer (dbt + Superset): ELT transforms + BI dashboards.

3. Data Architecture (Medallion)
The database is organized into four logical layers:

3.1 OLTP (Application Source of Truth)
Tables used directly by the backend:
- rooms
- bookings
- cleaning_tasks
- guest_tokens

3.2 STG (Mirror + Technical Columns)
The STG schema mirrors OLTP and adds metadata for ETL:
- stg.rooms, stg.users, stg.clients, stg.bookings, stg.cleaning_tasks
- Technical columns: loaded_at, source_system, etl_batch_id

3.3 CORE (SCD2‑ready Dimensions + Facts)
Normalized DWH layer with surrogate keys:
- core.dim_rooms, core.dim_clients, core.dim_users, core.dim_dates
- core.fact_bookings

3.4 MART (BI‑ready KPIs)
Aggregated views/tables:
- mart.fact_occupancy
- mart.customer_loyalty
- mart.revpar_daily

4. Functional Categories (Project Rules)
Category | Functionality | Implementation
A (CRUD) | Rooms/Bookings/Tasks | SQLAlchemy + REST
B (3rd Party) | Payments/Email/BI | Stripe + SMTP + Superset
C (Complex) | Pricing/Tasks/DWH | Algorithms + dbt pipelines

5. Deployment Architecture (Docker Compose)
Containers:
- nextstay_db (PostgreSQL, port 5433 on host)
- nextstay_backend (FastAPI, port 8000)
- nextstay_frontend (Vite dev server, port 5173)
- nextstay_dbt (dbt runtime)
- nextstay_airflow (Airflow, port 8080)
- nextstay_superset (Superset, port 8088)

6. Logic & Data Flow
1) Guest books in UI → API writes to OLTP (bookings, guest_tokens).
2) Checkout triggers room Dirty + cleaning_task creation.
3) dbt transforms OLTP → STG → CORE → MART.
4) Superset visualizes KPIs from MART.
