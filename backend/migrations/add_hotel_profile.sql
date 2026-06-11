-- Migration: Add hotel_profile table for hotel location and metadata

CREATE TABLE IF NOT EXISTS hotel_profile (
    id SERIAL PRIMARY KEY,
    hotel_name VARCHAR(255) NOT NULL DEFAULT 'My Hotel',
    address TEXT,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed one default row so GET /hotel/profile always returns something
INSERT INTO hotel_profile (hotel_name, address, lat, lng)
SELECT 'NextStay Hotel', NULL, NULL, NULL
WHERE NOT EXISTS (
    SELECT 1
    FROM hotel_profile
);
