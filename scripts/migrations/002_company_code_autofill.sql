-- Ensure company_code is auto-populated in OLTP transactional tables.
-- Safe to run multiple times.

BEGIN;

CREATE OR REPLACE FUNCTION oltp.set_company_code_oltp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_TABLE_NAME = 'bookings' THEN
    IF NEW.company_code IS NULL AND NEW.room_id IS NOT NULL THEN
      SELECT r.company_code INTO NEW.company_code
      FROM oltp.rooms r
      WHERE r.id = NEW.room_id;
    END IF;

  ELSIF TG_TABLE_NAME = 'guest_tokens' THEN
    IF NEW.company_code IS NULL AND NEW.booking_id IS NOT NULL THEN
      SELECT b.company_code INTO NEW.company_code
      FROM oltp.bookings b
      WHERE b.id = NEW.booking_id;
    END IF;
    IF NEW.company_code IS NULL AND NEW.room_id IS NOT NULL THEN
      SELECT r.company_code INTO NEW.company_code
      FROM oltp.rooms r
      WHERE r.id = NEW.room_id;
    END IF;

  ELSIF TG_TABLE_NAME = 'cleaning_tasks' THEN
    IF NEW.company_code IS NULL AND NEW.room_id IS NOT NULL THEN
      SELECT r.company_code INTO NEW.company_code
      FROM oltp.rooms r
      WHERE r.id = NEW.room_id;
    END IF;

  ELSIF TG_TABLE_NAME = 'payments' THEN
    IF NEW.company_code IS NULL AND NEW.booking_id IS NOT NULL THEN
      SELECT b.company_code INTO NEW.company_code
      FROM oltp.bookings b
      WHERE b.id = NEW.booking_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('oltp.bookings') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_set_company_code_bookings ON oltp.bookings';
    EXECUTE 'CREATE TRIGGER trg_set_company_code_bookings
             BEFORE INSERT OR UPDATE ON oltp.bookings
             FOR EACH ROW
             EXECUTE FUNCTION oltp.set_company_code_oltp()';
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('oltp.guest_tokens') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_set_company_code_guest_tokens ON oltp.guest_tokens';
    EXECUTE 'CREATE TRIGGER trg_set_company_code_guest_tokens
             BEFORE INSERT OR UPDATE ON oltp.guest_tokens
             FOR EACH ROW
             EXECUTE FUNCTION oltp.set_company_code_oltp()';
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('oltp.cleaning_tasks') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_set_company_code_cleaning_tasks ON oltp.cleaning_tasks';
    EXECUTE 'CREATE TRIGGER trg_set_company_code_cleaning_tasks
             BEFORE INSERT OR UPDATE ON oltp.cleaning_tasks
             FOR EACH ROW
             EXECUTE FUNCTION oltp.set_company_code_oltp()';
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('oltp.payments') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_set_company_code_payments ON oltp.payments';
    EXECUTE 'CREATE TRIGGER trg_set_company_code_payments
             BEFORE INSERT OR UPDATE ON oltp.payments
             FOR EACH ROW
             EXECUTE FUNCTION oltp.set_company_code_oltp()';
  END IF;
END $$;

-- Backfill historical data.
UPDATE oltp.rooms
SET company_code = CASE
  WHEN regexp_replace(COALESCE(number, ''), '[^0-9]', '', 'g') LIKE '2%' THEN 'C2'
  ELSE 'C1'
END
WHERE company_code IS NULL;

UPDATE oltp.bookings b
SET company_code = r.company_code
FROM oltp.rooms r
WHERE b.company_code IS NULL
  AND b.room_id = r.id;

UPDATE oltp.guest_tokens gt
SET company_code = COALESCE(
  (SELECT b.company_code FROM oltp.bookings b WHERE b.id = gt.booking_id),
  (SELECT r.company_code FROM oltp.rooms r WHERE r.id = gt.room_id)
)
WHERE gt.company_code IS NULL;

UPDATE oltp.cleaning_tasks t
SET company_code = r.company_code
FROM oltp.rooms r
WHERE t.company_code IS NULL
  AND t.room_id = r.id;

UPDATE oltp.payments p
SET company_code = b.company_code
FROM oltp.bookings b
WHERE p.company_code IS NULL
  AND p.booking_id = b.id;

COMMIT;
