BEGIN;

TRUNCATE TABLE core.fact_bookings, core.dim_dates, core.dim_users, core.dim_clients, core.dim_rooms RESTART IDENTITY CASCADE;

INSERT INTO core.dim_rooms (room_id, room_number, room_type, valid_from, valid_to, is_current, company_code)
SELECT DISTINCT
  s.room_id,
  s.room_number,
  s.room_type,
  COALESCE(s.created_at, now()),
  NULL::timestamptz,
  TRUE,
  COALESCE(s.company_code, 'C1')
FROM stg.rooms s;

INSERT INTO core.dim_clients (client_id, full_name, email, is_active, valid_from, valid_to, is_current, company_code)
SELECT DISTINCT
  c.client_id,
  c.full_name,
  c.email,
  TRUE,
  COALESCE(c.created_at, now()),
  NULL::timestamptz,
  TRUE,
  COALESCE(c.company_code, 'C1')
FROM stg.clients c;

INSERT INTO core.dim_users (user_id, username, role, valid_from, valid_to, is_current, company_code)
SELECT DISTINCT
  u.user_id,
  u.username,
  u.role,
  COALESCE(u.created_at, now()),
  NULL::timestamptz,
  TRUE,
  COALESCE(u.company_code, 'C1')
FROM stg.users u;

INSERT INTO core.dim_dates (date_day, day_of_week, week_of_year, month, year, is_weekend)
SELECT DISTINCT
  d::date,
  EXTRACT(ISODOW FROM d)::int,
  EXTRACT(WEEK FROM d)::int,
  EXTRACT(MONTH FROM d)::int,
  EXTRACT(YEAR FROM d)::int,
  CASE WHEN EXTRACT(ISODOW FROM d) IN (6, 7) THEN TRUE ELSE FALSE END
FROM (
  SELECT check_in::date AS d FROM stg.bookings
  UNION
  SELECT check_out::date AS d FROM stg.bookings
) dates;

INSERT INTO core.fact_bookings (booking_id, room_sk, client_sk, check_in_date_sk, check_out_date_sk, total_amount, company_code)
SELECT
  b.booking_id,
  dr.room_sk,
  dc.client_sk,
  d_in.date_sk,
  d_out.date_sk,
  b.total_price,
  COALESCE(b.company_code, 'C1')
FROM stg.bookings b
JOIN core.dim_rooms dr ON dr.room_id = b.room_id AND dr.is_current
  AND dr.company_code = COALESCE(b.company_code, 'C1')
JOIN core.dim_clients dc ON dc.client_id = b.client_id AND dc.is_current
  AND dc.company_code = COALESCE(b.company_code, 'C1')
JOIN core.dim_dates d_in ON d_in.date_day = b.check_in
JOIN core.dim_dates d_out ON d_out.date_day = b.check_out;

COMMIT;
