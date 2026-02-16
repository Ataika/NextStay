BEGIN;

TRUNCATE TABLE stg.cleaning_tasks, stg.bookings, stg.clients, stg.users, stg.rooms;

INSERT INTO stg.rooms (room_id, room_number, room_type, status, price_per_night, created_at, loaded_at, source_system, etl_batch_id, company_code)
SELECT
  r.id,
  r.number,
  CASE
    WHEN lower(r.category) = 'standard' THEN 'standard'::room_type_enum
    WHEN lower(r.category) = 'deluxe' THEN 'deluxe'::room_type_enum
    ELSE 'dorm'::room_type_enum
  END,
  CASE
    WHEN r.status = 'Available' THEN 'available'::room_status_enum
    WHEN r.status = 'Occupied' THEN 'occupied'::room_status_enum
    WHEN r.status = 'Dirty' THEN 'dirty'::room_status_enum
    ELSE 'maintenance'::room_status_enum
  END,
  r.price,
  COALESCE(r.created_at, now()),
  now(),
  'oltp',
  'batch-' || to_char(now(), 'YYYYMMDDHH24MISS'),
  COALESCE(r.company_code, 'C1')
FROM oltp.rooms r;

INSERT INTO stg.users (user_id, username, role, email, created_at, loaded_at, source_system, etl_batch_id, company_code)
SELECT DISTINCT
  COALESCE(t.assigned_to, 0),
  COALESCE(lower(replace(t.assigned_to_name, ' ', '_')), 'unassigned'),
  CASE
    WHEN t.assigned_to_name IS NULL THEN 'cleaner'::user_role_enum
    WHEN t.assigned_to_name ILIKE '%manager%' THEN 'manager'::user_role_enum
    ELSE 'cleaner'::user_role_enum
  END,
  NULL,
  now(),
  now(),
  'oltp',
  'batch-' || to_char(now(), 'YYYYMMDDHH24MISS'),
  COALESCE(t.company_code, 'C1')
FROM oltp.cleaning_tasks t;

INSERT INTO stg.clients (client_id, full_name, email, phone, created_at, loaded_at, source_system, etl_batch_id, company_code)
SELECT
  row_number() OVER (ORDER BY COALESCE(b.company_code, 'C1'), b.guest_name, b.guest_email) AS client_id,
  b.guest_name,
  b.guest_email,
  NULL,
  MIN(b.created_at),
  now(),
  'oltp',
  'batch-' || to_char(now(), 'YYYYMMDDHH24MISS'),
  COALESCE(b.company_code, 'C1')
FROM oltp.bookings b
GROUP BY COALESCE(b.company_code, 'C1'), b.guest_name, b.guest_email;

INSERT INTO stg.bookings (booking_id, room_id, client_id, check_in, check_out, total_price, status, created_at, loaded_at, source_system, etl_batch_id, company_code)
SELECT
  b.id,
  b.room_id,
  c.client_id,
  b.check_in::date,
  b.check_out::date,
  COALESCE(b.amount_paid, r.price * GREATEST(1, (b.check_out::date - b.check_in::date))),
  CASE
    WHEN b.status IN ('Confirmed', 'Pending') THEN 'confirmed'::booking_status_enum
    WHEN b.status = 'Checked-in' THEN 'staying'::booking_status_enum
    WHEN b.status = 'Checked-out' THEN 'completed'::booking_status_enum
    ELSE 'cancelled'::booking_status_enum
  END,
  b.created_at,
  now(),
  'oltp',
  'batch-' || to_char(now(), 'YYYYMMDDHH24MISS'),
  COALESCE(b.company_code, 'C1')
FROM oltp.bookings b
JOIN oltp.rooms r ON r.id = b.room_id
JOIN stg.clients c ON c.full_name = b.guest_name AND c.email IS NOT DISTINCT FROM b.guest_email
  AND c.company_code = COALESCE(b.company_code, 'C1');

INSERT INTO stg.cleaning_tasks (task_id, room_id, assigned_to, status, priority, created_at, loaded_at, source_system, etl_batch_id, company_code)
SELECT
  t.id,
  t.room_id,
  COALESCE(t.assigned_to, 0),
  CASE
    WHEN t.status = 'Pending' THEN 'pending'::task_status_enum
    WHEN t.status = 'In Progress' THEN 'in_progress'::task_status_enum
    ELSE 'done'::task_status_enum
  END,
  CASE
    WHEN t.priority = 'High' THEN 3
    WHEN t.priority = 'Medium' THEN 2
    ELSE 1
  END,
  t.created_at,
  now(),
  'oltp',
  'batch-' || to_char(now(), 'YYYYMMDDHH24MISS'),
  COALESCE(t.company_code, 'C1')
FROM oltp.cleaning_tasks t;

COMMIT;
