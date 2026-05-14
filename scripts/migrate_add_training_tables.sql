-- Migration: add per-hotel training tables to an existing NextStay database.
-- Safe to run multiple times (IF NOT EXISTS / ON CONFLICT).
--
-- Usage:
--   docker exec -i nextstay_db_clean \
--     psql -U nextstay -d nextstay \
--     < scripts/migrate_add_training_tables.sql

CREATE TABLE IF NOT EXISTS pricing.hotel_model_registry (
    id SERIAL PRIMARY KEY,
    hotel_id INT NOT NULL,
    model_version VARCHAR(120) NOT NULL,
    model_path TEXT NOT NULL,
    metadata_path TEXT,
    schema_version VARCHAR(50),
    metrics_json JSONB,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    row_count INT,
    notes TEXT,
    trained_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hotel_model_registry_hotel
ON pricing.hotel_model_registry (hotel_id, is_active);

CREATE TABLE IF NOT EXISTS pricing.training_jobs (
    id SERIAL PRIMARY KEY,
    hotel_id INT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    dataset_row_count INT,
    model_version VARCHAR(120),
    model_registry_id INT REFERENCES pricing.hotel_model_registry (id),
    config_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT training_jobs_status_chk
    CHECK (status IN ('pending', 'running', 'completed', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_training_jobs_hotel
ON pricing.training_jobs (hotel_id, status);

CREATE TABLE IF NOT EXISTS pricing.hotel_pricing_config (
    hotel_id INT PRIMARY KEY,
    config_json JSONB NOT NULL,
    config_version VARCHAR(50) NOT NULL DEFAULT 'v1',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by VARCHAR(120)
);

SELECT
    'Migration complete: hotel_model_registry, training_jobs,'
    || ' hotel_pricing_config created.' AS result;
