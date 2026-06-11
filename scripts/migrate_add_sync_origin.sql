-- Migration: add origin and revision tracking to hotel sync events.
-- Run once against an existing database.

ALTER TABLE public.hotel_sync_events
ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'HOTEL';

ALTER TABLE public.hotel_sync_events
ADD COLUMN IF NOT EXISTS revision INTEGER NOT NULL DEFAULT 0;
