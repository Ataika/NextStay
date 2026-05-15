-- Migration: add room_holds table for 10-minute reservation holds
-- Run once against the live database.

CREATE TABLE IF NOT EXISTS public.room_holds (
    id SERIAL PRIMARY KEY,
    room_id INTEGER NOT NULL REFERENCES public.rooms (id) ON DELETE CASCADE,
    check_in TIMESTAMPTZ NOT NULL,
    check_out TIMESTAMPTZ NOT NULL,
    session_id TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_room_holds_room_expires
ON public.room_holds (room_id, expires_at);

CREATE INDEX IF NOT EXISTS idx_room_holds_session
ON public.room_holds (session_id);
