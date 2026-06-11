-- Migration: add hotel registry and link rooms/sync tables to it.
-- Run once against an existing database. Idempotent where possible.
-- NOTE: the two ADD CONSTRAINT statements at the end are not idempotent;
-- run this migration exactly once on a target database.

CREATE TABLE IF NOT EXISTS public.hotels (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    webhook_url VARCHAR(500),
    hmac_secret VARCHAR(255),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed a default hotel as id = 1 so existing single-hotel rows map to it.
INSERT INTO public.hotels (id, code, name, active)
VALUES (1, 'DEFAULT', 'Default Hotel', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Advance the SERIAL sequence past the explicitly-seeded id so the next
-- ORM/id-less insert does not collide on the primary key.
SELECT SETVAL(
    PG_GET_SERIAL_SEQUENCE('public.hotels', 'id'),
    (SELECT MAX(id) FROM public.hotels)
);

-- Link rooms to a hotel.
ALTER TABLE public.rooms
ADD COLUMN IF NOT EXISTS hotel_id INTEGER REFERENCES public.hotels (id);

UPDATE public.rooms
SET hotel_id = 1
WHERE hotel_id IS NULL;

-- Replace global room-number uniqueness with per-hotel uniqueness.
ALTER TABLE public.rooms
DROP CONSTRAINT IF EXISTS rooms_number_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_rooms_hotel_number
ON public.rooms (hotel_id, number);

-- Tie existing sync tables to the registry (created by migrate_add_hotel_sync.sql).
ALTER TABLE public.hotel_sync_events
ADD CONSTRAINT fk_hotel_sync_events_hotel
FOREIGN KEY (hotel_id) REFERENCES public.hotels (id);

ALTER TABLE public.hotel_channel_bookings
ADD CONSTRAINT fk_hotel_channel_bookings_hotel
FOREIGN KEY (hotel_id) REFERENCES public.hotels (id);
