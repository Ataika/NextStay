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
CREATE SCHEMA IF NOT EXISTS oltp;

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

DO $$
BEGIN
    EXECUTE format('GRANT CONNECT ON DATABASE %I TO superset_ro', current_database());
END $$;
GRANT USAGE ON SCHEMA public TO superset_ro;
GRANT USAGE ON SCHEMA oltp TO superset_ro;
GRANT USAGE ON SCHEMA stg TO superset_ro;
GRANT USAGE ON SCHEMA core TO superset_ro;
GRANT USAGE ON SCHEMA mart TO superset_ro;

-- Default read access for Superset on all schemas
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO superset_ro;
ALTER DEFAULT PRIVILEGES IN SCHEMA oltp GRANT SELECT ON TABLES TO superset_ro;
ALTER DEFAULT PRIVILEGES IN SCHEMA stg GRANT SELECT ON TABLES TO superset_ro;
ALTER DEFAULT PRIVILEGES IN SCHEMA core GRANT SELECT ON TABLES TO superset_ro;
ALTER DEFAULT PRIVILEGES IN SCHEMA mart GRANT SELECT ON TABLES TO superset_ro;

-- ------------------------------------------
-- 2) OLTP LAYER (Application Source of Truth)
-- ------------------------------------------
-- These tables are used directly by the backend.

CREATE TABLE IF NOT EXISTS oltp.companies (
    company_code TEXT PRIMARY KEY,
    company_name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO oltp.companies (company_code, company_name)
VALUES
    ('C1', 'NextStay Alpha Hospitality'),
    ('C2', 'NextStay Beta Hospitality')
ON CONFLICT (company_code) DO NOTHING;

CREATE TABLE IF NOT EXISTS oltp.rooms (
    id SERIAL PRIMARY KEY,
    number VARCHAR(10) UNIQUE NOT NULL,
    category VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Available',
    price FLOAT NOT NULL,
    capacity INT NOT NULL DEFAULT 2,
    description TEXT,
    amenities JSONB,
    company_code TEXT REFERENCES oltp.companies(company_code),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT rooms_status_chk CHECK (status IN ('Available', 'Occupied', 'Cleaning', 'Maintenance', 'Dirty'))
);

CREATE TABLE IF NOT EXISTS oltp.bookings (
    id SERIAL PRIMARY KEY,
    guest_name VARCHAR(100) NOT NULL,
    guest_email VARCHAR(255),
    room_id INT NOT NULL REFERENCES oltp.rooms(id) ON DELETE CASCADE,
    room_number VARCHAR(10) NOT NULL,
    check_in TIMESTAMPTZ NOT NULL,
    check_out TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    notes VARCHAR(500),
    stripe_session_id VARCHAR(255),
    stripe_payment_intent_id VARCHAR(255),
    amount_paid FLOAT,
    company_code TEXT REFERENCES oltp.companies(company_code),
    CONSTRAINT bookings_status_chk CHECK (status IN ('Pending', 'Confirmed', 'Upcoming', 'Checked-in', 'Checked-out', 'Cancelled', 'Expired'))
);

CREATE INDEX IF NOT EXISTS idx_bookings_room_id ON oltp.bookings(room_id);
CREATE INDEX IF NOT EXISTS idx_bookings_stripe_session_id ON oltp.bookings(stripe_session_id);

CREATE TABLE IF NOT EXISTS oltp.cleaning_tasks (
    id SERIAL PRIMARY KEY,
    room_id INT NOT NULL REFERENCES oltp.rooms(id) ON DELETE CASCADE,
    room_number VARCHAR(10) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Pending',
    priority VARCHAR(20) NOT NULL DEFAULT 'Medium',
    assigned_to INT,
    assigned_to_name VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    notes VARCHAR(500),
    company_code TEXT REFERENCES oltp.companies(company_code),
    CONSTRAINT tasks_status_chk CHECK (status IN ('Pending', 'In Progress', 'Completed')),
    CONSTRAINT tasks_priority_chk CHECK (priority IN ('Low', 'Medium', 'High'))
);

CREATE INDEX IF NOT EXISTS idx_tasks_room_id ON oltp.cleaning_tasks(room_id);

CREATE TABLE IF NOT EXISTS oltp.guest_tokens (
    id SERIAL PRIMARY KEY,
    token VARCHAR(100) UNIQUE NOT NULL,
    booking_id INT NOT NULL REFERENCES oltp.bookings(id) ON DELETE CASCADE,
    room_id INT NOT NULL REFERENCES oltp.rooms(id) ON DELETE CASCADE,
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
    company_code TEXT REFERENCES oltp.companies(company_code),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT guest_access_status_chk CHECK (access_status IN ('Active', 'Expired', 'Checked out'))
);

CREATE INDEX IF NOT EXISTS idx_guest_tokens_token ON oltp.guest_tokens(token);
CREATE INDEX IF NOT EXISTS idx_guest_tokens_booking_id ON oltp.guest_tokens(booking_id);
CREATE INDEX IF NOT EXISTS idx_rooms_company_code ON oltp.rooms(company_code);
CREATE INDEX IF NOT EXISTS idx_bookings_company_code ON oltp.bookings(company_code);
CREATE INDEX IF NOT EXISTS idx_cleaning_tasks_company_code ON oltp.cleaning_tasks(company_code);
CREATE INDEX IF NOT EXISTS idx_guest_tokens_company_code ON oltp.guest_tokens(company_code);

CREATE TABLE IF NOT EXISTS oltp.payments (
    id SERIAL PRIMARY KEY,
    booking_id INT NOT NULL REFERENCES oltp.bookings(id) ON DELETE CASCADE,
    stripe_session_id VARCHAR(255),
    stripe_payment_intent_id VARCHAR(255),
    stripe_event_id VARCHAR(255) UNIQUE,
    event_type VARCHAR(100),
    payment_status VARCHAR(50),
    currency VARCHAR(10),
    amount_total_cents INT,
    customer_email VARCHAR(255),
    payload JSONB,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    company_code TEXT REFERENCES oltp.companies(company_code)
);

CREATE INDEX IF NOT EXISTS idx_payments_booking_id ON oltp.payments (booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_session_id ON oltp.payments (stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_intent_id ON oltp.payments (stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_payments_event_type ON oltp.payments (event_type);
CREATE INDEX IF NOT EXISTS idx_payments_status ON oltp.payments (payment_status);
CREATE INDEX IF NOT EXISTS idx_payments_company_code ON oltp.payments (company_code);

CREATE OR REPLACE FUNCTION oltp.set_company_code_oltp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_TABLE_NAME = 'bookings' THEN
        IF NEW.company_code IS NULL AND NEW.room_id IS NOT NULL THEN
            SELECT r.company_code INTO NEW.company_code FROM oltp.rooms r WHERE r.id = NEW.room_id;
        END IF;
    ELSIF TG_TABLE_NAME = 'guest_tokens' THEN
        IF NEW.company_code IS NULL AND NEW.booking_id IS NOT NULL THEN
            SELECT b.company_code INTO NEW.company_code FROM oltp.bookings b WHERE b.id = NEW.booking_id;
        END IF;
        IF NEW.company_code IS NULL AND NEW.room_id IS NOT NULL THEN
            SELECT r.company_code INTO NEW.company_code FROM oltp.rooms r WHERE r.id = NEW.room_id;
        END IF;
    ELSIF TG_TABLE_NAME = 'cleaning_tasks' THEN
        IF NEW.company_code IS NULL AND NEW.room_id IS NOT NULL THEN
            SELECT r.company_code INTO NEW.company_code FROM oltp.rooms r WHERE r.id = NEW.room_id;
        END IF;
    ELSIF TG_TABLE_NAME = 'payments' THEN
        IF NEW.company_code IS NULL AND NEW.booking_id IS NOT NULL THEN
            SELECT b.company_code INTO NEW.company_code FROM oltp.bookings b WHERE b.id = NEW.booking_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_company_code_bookings ON oltp.bookings;
CREATE TRIGGER trg_set_company_code_bookings
BEFORE INSERT OR UPDATE ON oltp.bookings
FOR EACH ROW
EXECUTE FUNCTION oltp.set_company_code_oltp();

DROP TRIGGER IF EXISTS trg_set_company_code_guest_tokens ON oltp.guest_tokens;
CREATE TRIGGER trg_set_company_code_guest_tokens
BEFORE INSERT OR UPDATE ON oltp.guest_tokens
FOR EACH ROW
EXECUTE FUNCTION oltp.set_company_code_oltp();

DROP TRIGGER IF EXISTS trg_set_company_code_cleaning_tasks ON oltp.cleaning_tasks;
CREATE TRIGGER trg_set_company_code_cleaning_tasks
BEFORE INSERT OR UPDATE ON oltp.cleaning_tasks
FOR EACH ROW
EXECUTE FUNCTION oltp.set_company_code_oltp();

DROP TRIGGER IF EXISTS trg_set_company_code_payments ON oltp.payments;
CREATE TRIGGER trg_set_company_code_payments
BEFORE INSERT OR UPDATE ON oltp.payments
FOR EACH ROW
EXECUTE FUNCTION oltp.set_company_code_oltp();

CREATE TABLE IF NOT EXISTS oltp.users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(120) NOT NULL,
    role VARCHAR(20) NOT NULL,
    company_code TEXT REFERENCES oltp.companies(company_code),
    password_hash VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT users_role_chk CHECK (role IN ('OWNER', 'STAFF'))
);

ALTER TABLE oltp.users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
ALTER TABLE oltp.users ADD COLUMN IF NOT EXISTS company_code TEXT REFERENCES oltp.companies(company_code);

CREATE INDEX IF NOT EXISTS idx_users_email ON oltp.users(email);

CREATE TABLE IF NOT EXISTS oltp.auth_sessions (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES oltp.users(id) ON DELETE CASCADE,
    token_jti VARCHAR(64) NOT NULL UNIQUE,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON oltp.auth_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at ON oltp.auth_sessions (expires_at);

CREATE TABLE IF NOT EXISTS oltp.email_otps (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    code_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    attempts INT NOT NULL DEFAULT 0,
    used BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT email_otps_attempts_chk CHECK (attempts >= 0)
);

CREATE INDEX IF NOT EXISTS idx_email_otps_email_created_at ON oltp.email_otps (email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_otps_expires_at ON oltp.email_otps (expires_at);

INSERT INTO oltp.users (email, full_name, role, is_active, company_code)
VALUES
    ('admin@nextstay.com', 'Admin User', 'OWNER', TRUE, 'C1'),
    ('staff@nextstay.com', 'Staff User', 'STAFF', TRUE, 'C1'),
    ('nextstay@yandex.com', 'NextStay Owner', 'OWNER', TRUE, 'C2'),
    ('staff.uborka@yandex.com', 'Cleaning Staff Dev', 'STAFF', TRUE, 'C1'),
    ('uborka.staff@yandex.com', 'Cleaning Staff Ops', 'STAFF', TRUE, 'C2'),
    ('owner.c2@nextstay.com', 'Owner C2', 'OWNER', TRUE, 'C2')
ON CONFLICT (email) DO NOTHING;

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
    etl_batch_id TEXT,
    company_code TEXT
);

CREATE TABLE IF NOT EXISTS stg.users (
    user_id INT,
    username VARCHAR(50),
    role user_role_enum,
    email VARCHAR(100),
    created_at TIMESTAMPTZ,
    loaded_at TIMESTAMPTZ DEFAULT NOW(),
    source_system TEXT DEFAULT 'oltp',
    etl_batch_id TEXT,
    company_code TEXT
);

CREATE TABLE IF NOT EXISTS stg.clients (
    client_id INT,
    full_name VARCHAR(100),
    email VARCHAR(100),
    phone VARCHAR(20),
    created_at TIMESTAMPTZ,
    loaded_at TIMESTAMPTZ DEFAULT NOW(),
    source_system TEXT DEFAULT 'oltp',
    etl_batch_id TEXT,
    company_code TEXT
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
    etl_batch_id TEXT,
    company_code TEXT
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
    etl_batch_id TEXT,
    company_code TEXT
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
    is_current BOOLEAN DEFAULT TRUE,
    company_code TEXT
);

CREATE TABLE IF NOT EXISTS core.dim_clients (
    client_sk SERIAL PRIMARY KEY,
    client_id INT,
    full_name VARCHAR(100),
    email VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    valid_from TIMESTAMPTZ,
    valid_to TIMESTAMPTZ,
    is_current BOOLEAN DEFAULT TRUE,
    company_code TEXT
);

CREATE TABLE IF NOT EXISTS core.dim_users (
    user_sk SERIAL PRIMARY KEY,
    user_id INT,
    username VARCHAR(50),
    role user_role_enum,
    valid_from TIMESTAMPTZ,
    valid_to TIMESTAMPTZ,
    is_current BOOLEAN DEFAULT TRUE,
    company_code TEXT
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
    total_amount DECIMAL(12, 2),
    company_code TEXT
);

-- ------------------------------------------
-- 6) MART (Analytical / BI)
-- ------------------------------------------

CREATE TABLE IF NOT EXISTS mart.fact_occupancy (
    date_day DATE,
    room_type room_type_enum,
    occupied_rooms INT,
    total_rooms INT,
    occupancy_rate DECIMAL(5, 2),
    company_code TEXT
);

CREATE TABLE IF NOT EXISTS mart.customer_loyalty (
    client_sk INT REFERENCES core.dim_clients(client_sk),
    total_spent DECIMAL(15, 2),
    total_nights INT,
    loyalty_tier loyalty_tier_enum,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    company_code TEXT
);

CREATE TABLE IF NOT EXISTS mart.revpar_daily (
    company_code TEXT NOT NULL,
    date_day DATE NOT NULL,
    total_revenue DECIMAL(15, 2),
    rooms_available INT,
    revpar DECIMAL(10, 2),
    PRIMARY KEY (company_code, date_day)
);

CREATE TABLE IF NOT EXISTS mart.bookings_daily (
    company_code TEXT NOT NULL,
    date_day DATE NOT NULL,
    bookings_count INT,
    nights_sold INT,
    total_revenue DECIMAL(15, 2),
    adr DECIMAL(10, 2),
    rooms_available INT,
    occupancy_rate DECIMAL(5, 2),
    revpar DECIMAL(10, 2),
    PRIMARY KEY (company_code, date_day)
);

CREATE TABLE IF NOT EXISTS mart.revenue_by_room_type_daily (
    company_code TEXT NOT NULL,
    date_day DATE NOT NULL,
    room_type room_type_enum NOT NULL,
    bookings_count INT,
    total_revenue DECIMAL(15, 2),
    adr DECIMAL(10, 2),
    PRIMARY KEY (company_code, date_day, room_type)
);

CREATE TABLE IF NOT EXISTS mart.tasks_daily (
    company_code TEXT NOT NULL,
    date_day DATE NOT NULL,
    tasks_created INT,
    tasks_completed INT,
    completion_rate DECIMAL(5, 2),
    PRIMARY KEY (company_code, date_day)
);

-- Compatibility upgrades for existing databases
ALTER TABLE oltp.rooms ADD COLUMN IF NOT EXISTS company_code TEXT REFERENCES oltp.companies(company_code);
ALTER TABLE oltp.bookings ADD COLUMN IF NOT EXISTS company_code TEXT REFERENCES oltp.companies(company_code);
ALTER TABLE oltp.cleaning_tasks ADD COLUMN IF NOT EXISTS company_code TEXT REFERENCES oltp.companies(company_code);
ALTER TABLE oltp.guest_tokens ADD COLUMN IF NOT EXISTS company_code TEXT REFERENCES oltp.companies(company_code);

ALTER TABLE stg.rooms ADD COLUMN IF NOT EXISTS company_code TEXT;
ALTER TABLE stg.users ADD COLUMN IF NOT EXISTS company_code TEXT;
ALTER TABLE stg.clients ADD COLUMN IF NOT EXISTS company_code TEXT;
ALTER TABLE stg.bookings ADD COLUMN IF NOT EXISTS company_code TEXT;
ALTER TABLE stg.cleaning_tasks ADD COLUMN IF NOT EXISTS company_code TEXT;

ALTER TABLE core.dim_rooms ADD COLUMN IF NOT EXISTS company_code TEXT;
ALTER TABLE core.dim_clients ADD COLUMN IF NOT EXISTS company_code TEXT;
ALTER TABLE core.dim_users ADD COLUMN IF NOT EXISTS company_code TEXT;
ALTER TABLE core.fact_bookings ADD COLUMN IF NOT EXISTS company_code TEXT;

ALTER TABLE mart.fact_occupancy ADD COLUMN IF NOT EXISTS company_code TEXT;
ALTER TABLE mart.customer_loyalty ADD COLUMN IF NOT EXISTS company_code TEXT;
ALTER TABLE mart.revpar_daily ADD COLUMN IF NOT EXISTS company_code TEXT;
CREATE TABLE IF NOT EXISTS mart.bookings_daily (
    company_code TEXT NOT NULL,
    date_day DATE NOT NULL,
    bookings_count INT,
    nights_sold INT,
    total_revenue DECIMAL(15, 2),
    adr DECIMAL(10, 2),
    rooms_available INT,
    occupancy_rate DECIMAL(5, 2),
    revpar DECIMAL(10, 2),
    PRIMARY KEY (company_code, date_day)
);
CREATE TABLE IF NOT EXISTS mart.revenue_by_room_type_daily (
    company_code TEXT NOT NULL,
    date_day DATE NOT NULL,
    room_type room_type_enum NOT NULL,
    bookings_count INT,
    total_revenue DECIMAL(15, 2),
    adr DECIMAL(10, 2),
    PRIMARY KEY (company_code, date_day, room_type)
);
CREATE TABLE IF NOT EXISTS mart.tasks_daily (
    company_code TEXT NOT NULL,
    date_day DATE NOT NULL,
    tasks_created INT,
    tasks_completed INT,
    completion_rate DECIMAL(5, 2),
    PRIMARY KEY (company_code, date_day)
);

UPDATE mart.revpar_daily
SET company_code = COALESCE(company_code, 'C1')
WHERE company_code IS NULL;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_schema = 'mart'
          AND table_name = 'revpar_daily'
          AND constraint_type = 'PRIMARY KEY'
          AND constraint_name = 'revpar_daily_pkey'
    ) THEN
        ALTER TABLE mart.revpar_daily DROP CONSTRAINT revpar_daily_pkey;
    END IF;
END $$;

ALTER TABLE mart.revpar_daily
ALTER COLUMN company_code SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_schema = 'mart'
          AND table_name = 'revpar_daily'
          AND constraint_type = 'PRIMARY KEY'
          AND constraint_name = 'revpar_daily_pkey'
    ) THEN
        ALTER TABLE mart.revpar_daily ADD CONSTRAINT revpar_daily_pkey PRIMARY KEY (company_code, date_day);
    END IF;
END $$;

-- ------------------------------------------
-- Notes:
-- - init-db.sql runs only on the first DB container start (volume creation).
-- - Re-apply manually if you need to refresh schemas:
--   docker exec -i nextstay_db_clean psql -U nextstay -d nextstay < scripts/init-db.sql
-- ------------------------------------------
