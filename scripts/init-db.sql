-- ==========================================
-- NextStay DB Bootstrap (OLTP + DWH)
-- Goal:
-- 1) OLTP as the source of truth for the app
-- 2) STG mirror with technical columns for ETL
-- 3) CORE and MART layers for analytics
-- ==========================================

-- ------------------------------------------
-- 0) Schemas
-- ------------------------------------------
CREATE SCHEMA IF NOT EXISTS stg;
CREATE SCHEMA IF NOT EXISTS core;
CREATE SCHEMA IF NOT EXISTS mart;

-- ------------------------------------------
-- 1) Service & Developer Roles
-- ------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_user WHERE usename = 'superset_ro') THEN
        CREATE USER superset_ro WITH PASSWORD 'superset_pass';
    END IF;

    IF NOT EXISTS (SELECT FROM pg_catalog.pg_user WHERE usename = 'dair_dev') THEN
        CREATE USER dair_dev WITH PASSWORD 'dair_secure_pass';
    END IF;

    IF NOT EXISTS (SELECT FROM pg_catalog.pg_user WHERE usename = 'turat_dev') THEN
        CREATE USER turat_dev WITH PASSWORD 'turat_secure_pass';
    END IF;
END $$;

GRANT CONNECT ON DATABASE nextstay TO superset_ro;
GRANT USAGE ON SCHEMA public TO superset_ro;
GRANT USAGE ON SCHEMA stg TO superset_ro;
GRANT USAGE ON SCHEMA core TO superset_ro;
GRANT USAGE ON SCHEMA mart TO superset_ro;

-- Default read access for Superset on all schemas
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO superset_ro;
ALTER DEFAULT PRIVILEGES IN SCHEMA stg GRANT SELECT ON TABLES TO superset_ro;
ALTER DEFAULT PRIVILEGES IN SCHEMA core GRANT SELECT ON TABLES TO superset_ro;
ALTER DEFAULT PRIVILEGES IN SCHEMA mart GRANT SELECT ON TABLES TO superset_ro;

-- ------------------------------------------
-- 2) OLTP LAYER (Application Source of Truth)
-- ------------------------------------------
-- These tables are used directly by the backend.

CREATE TABLE IF NOT EXISTS rooms (
    id SERIAL PRIMARY KEY,
    number VARCHAR(10) UNIQUE NOT NULL,
    category VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Available',
    price FLOAT NOT NULL,
    capacity INT NOT NULL DEFAULT 2,
    description TEXT,
    amenities JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT rooms_status_chk CHECK (status IN ('Available', 'Occupied', 'Cleaning', 'Maintenance', 'Dirty'))
);

CREATE TABLE IF NOT EXISTS bookings (
    id SERIAL PRIMARY KEY,
    guest_name VARCHAR(100) NOT NULL,
    guest_email VARCHAR(255),
    room_id INT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    room_number VARCHAR(10) NOT NULL,
    check_in TIMESTAMPTZ NOT NULL,
    check_out TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    notes VARCHAR(500),
    stripe_session_id VARCHAR(255),
    stripe_payment_intent_id VARCHAR(255),
    amount_paid FLOAT,
    CONSTRAINT bookings_status_chk CHECK (status IN ('Pending', 'Confirmed', 'Upcoming', 'Checked-in', 'Checked-out', 'Cancelled', 'Expired'))
);

CREATE INDEX IF NOT EXISTS idx_bookings_room_id ON bookings(room_id);
CREATE INDEX IF NOT EXISTS idx_bookings_stripe_session_id ON bookings(stripe_session_id);

CREATE TABLE IF NOT EXISTS cleaning_tasks (
    id SERIAL PRIMARY KEY,
    room_id INT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    room_number VARCHAR(10) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Pending',
    priority VARCHAR(20) NOT NULL DEFAULT 'Medium',
    assigned_to INT,
    assigned_to_name VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    notes VARCHAR(500),
    CONSTRAINT tasks_status_chk CHECK (status IN ('Pending', 'In Progress', 'Completed')),
    CONSTRAINT tasks_priority_chk CHECK (priority IN ('Low', 'Medium', 'High'))
);

CREATE INDEX IF NOT EXISTS idx_tasks_room_id ON cleaning_tasks(room_id);

CREATE TABLE IF NOT EXISTS guest_tokens (
    id SERIAL PRIMARY KEY,
    token VARCHAR(100) UNIQUE NOT NULL,
    booking_id INT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    room_id INT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    room_number VARCHAR(10) NOT NULL,
    guest_name VARCHAR(100) NOT NULL,
    check_in TIMESTAMPTZ NOT NULL,
    check_out TIMESTAMPTZ NOT NULL,
    is_valid BOOLEAN NOT NULL DEFAULT TRUE,
    access_status VARCHAR(20) NOT NULL DEFAULT 'Active',
    wifi_ssid VARCHAR(100) NOT NULL DEFAULT 'NextStay_Guest',
    wifi_password VARCHAR(100) NOT NULL DEFAULT 'Welcome2026!',
    contact_info JSONB,
    instructions JSONB,
    house_rules JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT guest_access_status_chk CHECK (access_status IN ('Active', 'Expired', 'Checked out'))
);

CREATE INDEX IF NOT EXISTS idx_guest_tokens_token ON guest_tokens(token);
CREATE INDEX IF NOT EXISTS idx_guest_tokens_booking_id ON guest_tokens(booking_id);

-- ------------------------------------------
-- 3) DWH ENUMS (Standardized Analytical Values)
-- ------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'room_status_enum') THEN
        CREATE TYPE room_status_enum AS ENUM ('available', 'occupied', 'dirty', 'maintenance');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'room_type_enum') THEN
        CREATE TYPE room_type_enum AS ENUM ('standard', 'deluxe', 'dorm');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role_enum') THEN
        CREATE TYPE user_role_enum AS ENUM ('admin', 'manager', 'cleaner');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_status_enum') THEN
        CREATE TYPE booking_status_enum AS ENUM ('confirmed', 'staying', 'completed', 'cancelled');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_status_enum') THEN
        CREATE TYPE task_status_enum AS ENUM ('pending', 'in_progress', 'done');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'loyalty_tier_enum') THEN
        CREATE TYPE loyalty_tier_enum AS ENUM ('bronze', 'silver', 'gold');
    END IF;
END $$;

-- ------------------------------------------
-- 4) STAGING (Mirror of OLTP + tech columns)
-- ------------------------------------------
-- STG mirrors OLTP schema and adds technical metadata for ETL.

CREATE TABLE IF NOT EXISTS stg.rooms (
    room_id INT,
    room_number VARCHAR(10),
    room_type room_type_enum,
    status room_status_enum,
    price_per_night DECIMAL(10, 2),
    created_at TIMESTAMPTZ,
    loaded_at TIMESTAMPTZ DEFAULT NOW(),
    source_system TEXT DEFAULT 'oltp',
    etl_batch_id TEXT
);

CREATE TABLE IF NOT EXISTS stg.users (
    user_id INT,
    username VARCHAR(50),
    role user_role_enum,
    email VARCHAR(100),
    created_at TIMESTAMPTZ,
    loaded_at TIMESTAMPTZ DEFAULT NOW(),
    source_system TEXT DEFAULT 'oltp',
    etl_batch_id TEXT
);

CREATE TABLE IF NOT EXISTS stg.clients (
    client_id INT,
    full_name VARCHAR(100),
    email VARCHAR(100),
    phone VARCHAR(20),
    created_at TIMESTAMPTZ,
    loaded_at TIMESTAMPTZ DEFAULT NOW(),
    source_system TEXT DEFAULT 'oltp',
    etl_batch_id TEXT
);

CREATE TABLE IF NOT EXISTS stg.bookings (
    booking_id INT,
    room_id INT,
    client_id INT,
    check_in DATE,
    check_out DATE,
    total_price DECIMAL(10, 2),
    status booking_status_enum,
    created_at TIMESTAMPTZ,
    loaded_at TIMESTAMPTZ DEFAULT NOW(),
    source_system TEXT DEFAULT 'oltp',
    etl_batch_id TEXT
);

CREATE TABLE IF NOT EXISTS stg.cleaning_tasks (
    task_id INT,
    room_id INT,
    assigned_to INT,
    status task_status_enum,
    priority INT,
    created_at TIMESTAMPTZ,
    loaded_at TIMESTAMPTZ DEFAULT NOW(),
    source_system TEXT DEFAULT 'oltp',
    etl_batch_id TEXT
);

-- ------------------------------------------
-- 5) CORE (DWH, SCD2-ready dimensions)
-- ------------------------------------------

CREATE TABLE IF NOT EXISTS core.dim_rooms (
    room_sk SERIAL PRIMARY KEY,
    room_id INT,
    room_number VARCHAR(10),
    room_type room_type_enum,
    valid_from TIMESTAMPTZ,
    valid_to TIMESTAMPTZ,
    is_current BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS core.dim_clients (
    client_sk SERIAL PRIMARY KEY,
    client_id INT,
    full_name VARCHAR(100),
    email VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    valid_from TIMESTAMPTZ,
    valid_to TIMESTAMPTZ,
    is_current BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS core.dim_users (
    user_sk SERIAL PRIMARY KEY,
    user_id INT,
    username VARCHAR(50),
    role user_role_enum,
    valid_from TIMESTAMPTZ,
    valid_to TIMESTAMPTZ,
    is_current BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS core.dim_dates (
    date_sk SERIAL PRIMARY KEY,
    date_day DATE UNIQUE,
    day_of_week INT,
    week_of_year INT,
    month INT,
    year INT,
    is_weekend BOOLEAN
);

CREATE TABLE IF NOT EXISTS core.fact_bookings (
    booking_sk SERIAL PRIMARY KEY,
    booking_id INT,
    room_sk INT REFERENCES core.dim_rooms(room_sk),
    client_sk INT REFERENCES core.dim_clients(client_sk),
    check_in_date_sk INT REFERENCES core.dim_dates(date_sk),
    check_out_date_sk INT REFERENCES core.dim_dates(date_sk),
    total_amount DECIMAL(12, 2)
);

-- ------------------------------------------
-- 6) MART (Analytical / BI)
-- ------------------------------------------

CREATE TABLE IF NOT EXISTS mart.fact_occupancy (
    date_day DATE,
    room_type room_type_enum,
    occupied_rooms INT,
    total_rooms INT,
    occupancy_rate DECIMAL(5, 2)
);

CREATE TABLE IF NOT EXISTS mart.customer_loyalty (
    client_sk INT REFERENCES core.dim_clients(client_sk),
    total_spent DECIMAL(15, 2),
    total_nights INT,
    loyalty_tier loyalty_tier_enum,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mart.revpar_daily (
    date_day DATE PRIMARY KEY,
    total_revenue DECIMAL(15, 2),
    rooms_available INT,
    revpar DECIMAL(10, 2)
);

-- ------------------------------------------
-- Notes:
-- - init-db.sql runs only on the first DB container start (volume creation).
-- - Re-apply manually if you need to refresh schemas:
--   docker exec -i nextstay_db_clean psql -U nextstay -d nextstay < scripts/init-db.sql
-- ------------------------------------------
