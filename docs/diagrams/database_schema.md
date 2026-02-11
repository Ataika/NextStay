NextStay Data Architecture Documentation
This document describes the OLTP + DWH structure for NextStay (PMS).
The system supports both operational transactions and analytical reporting.
The visual diagram can be found here: https://dbdiagram.io/d/69618669d6e030a0249db386

1. Overview
The database is organized into four layers:
OLTP (public schema):
Source of truth for the application (rooms, bookings, tasks, guest tokens).

STG (stg schema):
Mirror of OLTP with technical columns for ETL (loaded_at, source_system, etl_batch_id).

CORE (core schema):
Normalized DWH with surrogate keys and SCD2‑ready dimensions.

MART (mart schema):
Aggregated BI tables (occupancy, loyalty, RevPAR).

2. OLTP (Application Source of Truth)
Tables:
- rooms
- bookings
- cleaning_tasks
- guest_tokens

Key notes:
- Status values in OLTP are case‑sensitive (e.g. Available, Cleaning).
- These tables are used directly by the backend API.

3. ENUMS (Analytical Standardization)
We use enums in DWH layers to standardize values:
room_status_enum: available, occupied, dirty, maintenance
room_type_enum: standard, deluxe, dorm
user_role_enum: admin, manager, cleaner
booking_status_enum: confirmed, staying, completed, cancelled
task_status_enum: pending, in_progress, done
loyalty_tier_enum: bronze, silver, gold

4. STG (Mirror + Technical Columns)
STG mirrors OLTP and adds metadata:
Common columns:
- loaded_at (ETL load timestamp)
- source_system (default 'oltp')
- etl_batch_id (optional batch identifier)

Tables:
- stg.rooms
- stg.users
- stg.clients
- stg.bookings
- stg.cleaning_tasks

5. CORE (DWH Layer)
SCD2‑ready dimensions + facts:
Dimensions:
- core.dim_rooms
- core.dim_clients
- core.dim_users
- core.dim_dates

Facts:
- core.fact_bookings

Relationships:
- fact_bookings references dim_rooms, dim_clients, dim_dates

6. MART (Analytical / BI)
BI‑ready aggregates:
- mart.fact_occupancy
- mart.customer_loyalty
- mart.revpar_daily

7. ETL / Data Flow
OLTP → STG:
Extract raw operational data, mirror into STG with technical columns.

STG → CORE:
Clean, deduplicate, assign surrogate keys, manage SCD2.

CORE → MART:
Aggregate KPIs for dashboards.

Direct OLTP/STG → MART is not allowed.

8. Why This Architecture?
- Clear separation between operational and analytical workloads.
- Stable DWH (CORE) with flexible BI (MART).
- Easier auditing via STG technical columns.
- Scalable for new data sources and BI use cases.
