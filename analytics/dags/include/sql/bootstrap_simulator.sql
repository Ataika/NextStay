BEGIN;

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

ALTER TABLE oltp.rooms ADD COLUMN IF NOT EXISTS company_code TEXT REFERENCES oltp.companies(company_code);
ALTER TABLE oltp.bookings ADD COLUMN IF NOT EXISTS company_code TEXT REFERENCES oltp.companies(company_code);
ALTER TABLE oltp.guest_tokens ADD COLUMN IF NOT EXISTS company_code TEXT REFERENCES oltp.companies(company_code);
ALTER TABLE oltp.cleaning_tasks ADD COLUMN IF NOT EXISTS company_code TEXT REFERENCES oltp.companies(company_code);

CREATE INDEX IF NOT EXISTS idx_rooms_company_code ON oltp.rooms(company_code);
CREATE INDEX IF NOT EXISTS idx_bookings_company_code ON oltp.bookings(company_code);
CREATE INDEX IF NOT EXISTS idx_guest_tokens_company_code ON oltp.guest_tokens(company_code);
CREATE INDEX IF NOT EXISTS idx_cleaning_tasks_company_code ON oltp.cleaning_tasks(company_code);

UPDATE oltp.rooms
SET company_code = COALESCE(
    company_code,
    CASE WHEN number LIKE '2%' THEN 'C2' ELSE 'C1' END
)
WHERE company_code IS NULL;

UPDATE oltp.bookings b
SET company_code = COALESCE(b.company_code, r.company_code, 'C1')
FROM oltp.rooms r
WHERE b.room_id = r.id
  AND b.company_code IS NULL;

UPDATE oltp.guest_tokens gt
SET company_code = COALESCE(gt.company_code, b.company_code, 'C1')
FROM oltp.bookings b
WHERE gt.booking_id = b.id
  AND gt.company_code IS NULL;

UPDATE oltp.cleaning_tasks t
SET company_code = COALESCE(t.company_code, r.company_code, 'C1')
FROM oltp.rooms r
WHERE t.room_id = r.id
  AND t.company_code IS NULL;

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

COMMIT;
