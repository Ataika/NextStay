-- Migration: Add hotel_profile table for hotel location and metadata.
-- `hotel_profile` is the 1:1 descriptive extension of the canonical `hotels` entity:
-- its id IS hotels.id (shared primary key). `hotels` (created in init-db.sql) carries
-- identity + sync config; `hotel_profile` carries the descriptive profile.
CREATE TABLE IF NOT EXISTS hotel_profile (
    id INTEGER PRIMARY KEY REFERENCES hotels(id) ON DELETE CASCADE,
    hotel_name VARCHAR(255) NOT NULL DEFAULT 'My Hotel',
    address TEXT,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed a 1:1 profile for every hotels row that lacks one, so GET /hotel/profile
-- always returns something and the shared-PK alignment holds.
INSERT INTO hotel_profile (id, hotel_name)
SELECT h.id, h.name
FROM hotels h
WHERE NOT EXISTS (
    SELECT 1
    FROM hotel_profile hp
    WHERE hp.id = h.id
);
