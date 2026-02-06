-- creating user for  Superset (Read-Only)
CREATE USER superset_ro WITH PASSWORD 'superset_pass';
GRANT CONNECT ON DATABASE nextstay TO superset_ro;
-- Роли для разработчиков (Даир и Турат)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_user WHERE usename = 'dair_dev') THEN
        CREATE USER dair_dev WITH PASSWORD 'dair_secure_pass';
    END IF;
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_user WHERE usename = 'turat_dev') THEN
        CREATE USER turat_dev WITH PASSWORD 'turat_secure_pass';
    END IF;
END $$;

-- ==========================================
-- 2. ENUMS (Standardizing Values)
-- ==========================================
CREATE TYPE room_status_enum AS ENUM ('available', 'occupied', 'dirty', 'maintenance');
CREATE TYPE room_type_enum AS ENUM ('standard', 'deluxe', 'dorm');
CREATE TYPE user_role_enum AS ENUM ('admin', 'manager', 'cleaner');
CREATE TYPE booking_status_enum AS ENUM ('confirmed', 'staying', 'completed', 'cancelled');
CREATE TYPE task_status_enum AS ENUM ('pending', 'in_progress', 'done');
CREATE TYPE loyalty_tier_enum AS ENUM ('bronze', 'silver', 'gold');

-- ==========================================
-- 3. STAGING (OLTP) LAYER
-- ==========================================
CREATE TABLE stg_rooms (
    room_id SERIAL PRIMARY KEY,
    room_number VARCHAR(10) NOT NULL,
    room_type room_type_enum NOT NULL,
    status room_status_enum DEFAULT 'available',
    price_per_night DECIMAL(10, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    loaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE stg_users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    role user_role_enum NOT NULL,
    email VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE stg_clients (
    client_id SERIAL PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE,
    phone VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE stg_bookings (
    booking_id SERIAL PRIMARY KEY,
    room_id INT REFERENCES stg_rooms(room_id),
    client_id INT REFERENCES stg_clients(client_id),
    check_in DATE NOT NULL,
    check_out DATE NOT NULL,
    total_price DECIMAL(10, 2),
    status booking_status_enum DEFAULT 'confirmed',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE stg_cleaning_tasks (
    task_id SERIAL PRIMARY KEY,
    room_id INT REFERENCES stg_rooms(room_id),
    assigned_to INT REFERENCES stg_users(user_id),
    status task_status_enum DEFAULT 'pending',
    priority INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- 4. CORE (DWH) LAYER
-- ==========================================
CREATE TABLE core_rooms (
    room_sk SERIAL PRIMARY KEY,
    room_id INT, -- NK from STG
    room_number VARCHAR(10),
    room_type room_type_enum,
    valid_from TIMESTAMP,
    valid_to TIMESTAMP
);

CREATE TABLE core_clients (
    client_sk SERIAL PRIMARY KEY,
    client_id INT,
    full_name VARCHAR(100),
    email VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE core_bookings (
    booking_sk SERIAL PRIMARY KEY,
    booking_id INT,
    room_sk INT REFERENCES core_rooms(room_sk),
    client_sk INT REFERENCES core_clients(client_sk),
    check_in_date DATE,
    check_out_date DATE,
    total_amount DECIMAL(12, 2)
);

-- ==========================================
-- 5. MART (Analytical / BI) LAYER
-- ==========================================
CREATE TABLE mart_fact_occupancy (
    date_day DATE,
    room_type room_type_enum,
    occupied_rooms INT,
    total_rooms INT,
    occupancy_rate DECIMAL(5, 2)
);

CREATE TABLE mart_customer_loyalty (
    client_sk INT REFERENCES core_clients(client_sk),
    total_spent DECIMAL(15, 2),
    total_nights INT,
    loyalty_tier loyalty_tier_enum,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE mart_revpar_daily (
    date_day DATE PRIMARY KEY,
    total_revenue DECIMAL(15, 2),
    rooms_available INT,
    revpar DECIMAL(10, 2)
);

-- After creating the dbt schema, we will give the permission to  SELECT
-- We will integrate it in  Milestone 2
