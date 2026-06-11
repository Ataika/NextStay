-- Migration: add hotel channel synchronization tables.
-- Run once against an existing database.

CREATE TABLE IF NOT EXISTS public.hotel_sync_events (
    id SERIAL PRIMARY KEY,
    hotel_id INTEGER NOT NULL DEFAULT 1,
    external_event_id TEXT NOT NULL UNIQUE,
    source TEXT NOT NULL DEFAULT 'hotel_site_simulator',
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'received',
    error TEXT,
    booking_id INTEGER REFERENCES public.bookings(id) ON DELETE SET NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    CONSTRAINT hotel_sync_events_status_chk
        CHECK (status IN ('received', 'processed', 'failed')),
    CONSTRAINT hotel_sync_events_type_chk
        CHECK (event_type IN ('booking_created', 'booking_cancelled', 'room_status_updated'))
);

CREATE INDEX IF NOT EXISTS idx_hotel_sync_events_hotel_received
    ON public.hotel_sync_events(hotel_id, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_hotel_sync_events_booking
    ON public.hotel_sync_events(booking_id);

CREATE TABLE IF NOT EXISTS public.hotel_channel_bookings (
    id SERIAL PRIMARY KEY,
    hotel_id INTEGER NOT NULL DEFAULT 1,
    external_booking_id TEXT NOT NULL,
    booking_id INTEGER REFERENCES public.bookings(id) ON DELETE SET NULL,
    room_id INTEGER REFERENCES public.rooms(id) ON DELETE SET NULL,
    room_number VARCHAR(10) NOT NULL,
    source TEXT NOT NULL DEFAULT 'hotel_site_simulator',
    status TEXT NOT NULL DEFAULT 'active',
    check_in TIMESTAMPTZ,
    check_out TIMESTAMPTZ,
    guest_name VARCHAR(100),
    guest_email VARCHAR(255),
    synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    cancelled_at TIMESTAMPTZ,
    CONSTRAINT hotel_channel_bookings_status_chk
        CHECK (status IN ('active', 'cancelled')),
    CONSTRAINT hotel_channel_bookings_unique_external
        UNIQUE (hotel_id, external_booking_id)
);

CREATE INDEX IF NOT EXISTS idx_hotel_channel_bookings_booking
    ON public.hotel_channel_bookings(booking_id);

CREATE INDEX IF NOT EXISTS idx_hotel_channel_bookings_room_dates
    ON public.hotel_channel_bookings(room_id, check_in, check_out);
