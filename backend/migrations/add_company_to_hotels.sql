-- Add optional company grouping over hotels.
-- The `companies` table itself is created by SQLAlchemy create_all (ORM model) before
-- migrations run; this migration only adds the FK column to a pre-existing hotels table.
-- Idempotent: safe on every startup.

ALTER TABLE hotels ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_hotels_company_id ON hotels (company_id);
