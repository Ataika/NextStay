NexStay OS Data Architecture Documentation
This document describes the data structure and analytical pipeline for NexStay OS, a Property Management System (PMS) for hotels.
The system is designed to handle both operational data and analytical reporting.
The visual diagram can be found here: https://dbdiagram.io/d/69618669d6e030a0249db386

1. Overview
The NexStay OS data model is built in three layers:
STAGING (STG) Layer:
Raw data ingestion from the operational system. This layer represents the OLTP system, including rooms, users, clients, bookings, and cleaning tasks. Data here is stored as-is and includes all source IDs.
CORE Layer:
This layer contains cleaned and business-ready data. Surrogate keys are added for analytical purposes. Dimensions (rooms, users, clients, dates) and facts (bookings) are created here. This is the DWH layer, used as a single source of truth for analytics.
MART Layer:
The analytical / BI layer. Aggregates, KPIs, and facts are calculated here for dashboards, reporting, and business intelligence tools (e.g., Power BI, Superset). Examples include occupancy, revenue, repeat visits, loyalty, and RevPAR.

2. ENUMS
We use enums to standardize values in the database:
room_status_enum: available, occupied, dirty, maintenance
room_type_enum: standard, deluxe, dorm
user_role_enum: admin, manager, cleaner
booking_status_enum: confirmed, staying, completed, cancelled
task_status_enum: pending, in_progress, done
This ensures consistency across STG, CORE, and MART layers.

3. STAGING (OLTP) LAYER
The staging layer stores raw operational data. All tables include:
*_id – unique primary key in STG
created_at – original creation timestamp from the operational system
loaded_at – timestamp when data was ingested into STG
Tables:
stg_rooms: Raw information about hotel rooms (number, type, status, price).
stg_users: Staff accounts, including admin, manager, and cleaner roles.
stg_clients: Guest/client information including name, email, and phone.
stg_bookings: Bookings made by clients for rooms, with check-in/check-out dates and total price.
stg_cleaning_tasks: Tasks assigned to staff for cleaning rooms after check-out.
Relationships in STG (real FK):
Many bookings belong to one room (stg_bookings.room_id → stg_rooms.room_id)
Many bookings belong to one client (stg_bookings.client_id → stg_clients.client_id)
Many cleaning tasks belong to one room (stg_cleaning_tasks.room_id → stg_rooms.room_id)
Many cleaning tasks belong to one staff (stg_cleaning_tasks.assigned_to → stg_users.user_id)
This allows the STG layer to accurately represent the operational system.

4. CORE (DWH) LAYER
The core layer contains cleaned and business-logic ready data.
Key features:
Surrogate keys (*_sk) for analytics and stable identifiers
Dimension tables (rooms, users, clients, dates)
Fact table (bookings) with business grain (each booking is a row)

Tables:
core_clients: Unique clients with cleaned personal info.
core_rooms: Rooms with validity dates, price, and type.
core_users: Staff accounts with role information.
core_dates: Calendar dimension for analytics (day, week, month, weekend flags).
core_bookings: Cleaned bookings fact table linking rooms, clients, and check-in/check-out dates.
Relationships in CORE:
Bookings reference rooms and clients (core_bookings.room_sk → core_rooms.room_sk, core_bookings.client_sk → core_clients.client_sk)
Bookings reference dates (core_bookings.check_in_date_sk → core_dates.date_sk, core_bookings.check_out_date_sk → core_dates.date_sk)
Why CORE exists:
To deduplicate, clean, and standardize STG data
To assign surrogate keys for efficient analytics
To serve as a single source of truth for MART layer

5. MART (Analytical / BI) LAYER
The MART layer contains aggregated, BI-ready facts and KPIs.
Tables / Facts:
mart_fact_bookings: Revenue and booking metrics per booking.
mart_fact_occupancy: Daily room occupancy per room type.
mart_revpar_daily: RevPAR (Revenue per Available Room) per day.
mart_cleaning_tasks: Operational KPI for cleaning efficiency.
mart_fact_customer_visits: Total bookings, first/last visit, repeat visits.
mart_revenue_per_customer: Total revenue and average revenue per booking per client.
mart_customer_loyalty: Loyalty tier (bronze/silver/gold) based on lifetime revenue and stay nights.

Relationships:
MART tables always reference CORE tables
No MART table references STG directly (all STG data flows through CORE)

Why MART exists:
To aggregate operational data for KPIs and dashboards
To provide metrics for hotel management, marketing, and loyalty analysis
To support BI Superset

6. ETL / Data Flow

STG → CORE:
Extract raw data from operational system
Clean, validate, deduplicate
Assign surrogate keys (*_sk)
Load into CORE dimensions and facts

CORE → MART:
Aggregate facts for occupancy, revenue, RevPAR
Calculate customer analytics (repeat visits, revenue per client, loyalty)
Create KPI tables for dashboards

Direct STG → MART:
Not allowed — ensures MART is always consistent and based on cleaned CORE data

7. Why This Architecture?
Separation of concerns: OLTP vs analytical data (OLAP)
Scalability: New analytics or dashboards only need MART, CORE remains stable
Data quality: CORE ensures consistent, deduplicated data
Extensibility: Can integrate external data (e.g., OTA, CRM) via STG without breaking MART
BI-ready: STAR schema design in MART allows fast queries in tools like Power BI
