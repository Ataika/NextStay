-- One-time migration for existing environments.
-- Moves OLTP tables from public -> oltp without data loss.

BEGIN;

CREATE SCHEMA IF NOT EXISTS oltp;

DO $$
BEGIN
  IF to_regclass('public.rooms') IS NOT NULL AND to_regclass('oltp.rooms') IS NULL THEN
    EXECUTE 'ALTER TABLE public.rooms SET SCHEMA oltp';
  END IF;

  IF to_regclass('public.bookings') IS NOT NULL AND to_regclass('oltp.bookings') IS NULL THEN
    EXECUTE 'ALTER TABLE public.bookings SET SCHEMA oltp';
  END IF;

  IF to_regclass('public.guest_tokens') IS NOT NULL AND to_regclass('oltp.guest_tokens') IS NULL THEN
    EXECUTE 'ALTER TABLE public.guest_tokens SET SCHEMA oltp';
  END IF;

  IF to_regclass('public.cleaning_tasks') IS NOT NULL AND to_regclass('oltp.cleaning_tasks') IS NULL THEN
    EXECUTE 'ALTER TABLE public.cleaning_tasks SET SCHEMA oltp';
  END IF;

  IF to_regclass('public.companies') IS NOT NULL AND to_regclass('oltp.companies') IS NULL THEN
    EXECUTE 'ALTER TABLE public.companies SET SCHEMA oltp';
  END IF;
END $$;

COMMIT;
