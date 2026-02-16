BEGIN;

TRUNCATE TABLE
  oltp.guest_tokens,
  oltp.cleaning_tasks,
  oltp.payments,
  oltp.bookings,
  oltp.rooms
RESTART IDENTITY CASCADE;

WITH companies_src AS (
  SELECT 'C1'::text AS company_code, 'CityHub'::text AS brand
  UNION ALL
  SELECT 'C2'::text AS company_code, 'ResortLine'::text AS brand
),
room_gen AS (
  SELECT
    c.company_code,
    c.brand,
    gs AS seq,
    CASE
      WHEN gs % 10 IN (1, 2, 3, 4, 5, 6) THEN 'Standard'
      WHEN gs % 10 IN (7, 8, 9) THEN 'Deluxe'
      ELSE 'Suite'
    END AS category
  FROM companies_src c
  CROSS JOIN generate_series(1, {{rooms_per_company}}) gs
)
INSERT INTO oltp.rooms (number, category, status, price, capacity, description, amenities, company_code)
SELECT
  CASE
    WHEN rg.company_code = 'C1' THEN '1' || LPAD(rg.seq::text, 3, '0')
    ELSE '2' || LPAD(rg.seq::text, 3, '0')
  END AS number,
  rg.category,
  CASE WHEN rg.seq % 40 = 0 THEN 'Maintenance' ELSE 'Available' END AS status,
  ROUND(
    (
      CASE rg.category
        WHEN 'Standard' THEN 85
        WHEN 'Deluxe' THEN 125
        ELSE 175
      END
      + (rg.seq % 9) * 3
      + CASE WHEN rg.company_code = 'C2' THEN 18 ELSE 0 END
    )::numeric,
    2
  ) AS price,
  CASE rg.category
    WHEN 'Standard' THEN 2
    WHEN 'Deluxe' THEN 3
    ELSE 4
  END AS capacity,
  rg.brand || ' ' || rg.category || ' room #' || rg.seq,
  CASE
    WHEN rg.category = 'Suite' THEN jsonb_build_array('wifi', 'tv', 'minibar', 'workspace', 'bathtub')
    WHEN rg.category = 'Deluxe' THEN jsonb_build_array('wifi', 'tv', 'minibar', 'workspace')
    ELSE jsonb_build_array('wifi', 'tv')
  END,
  rg.company_code
FROM room_gen rg;

WITH room_base AS (
  SELECT id, number, company_code, category, price
  FROM oltp.rooms
  WHERE status <> 'Maintenance'
),
date_window AS (
  SELECT d::date AS date_day
  FROM generate_series(current_date - interval '59 day', current_date, interval '1 day') AS d
),
room_day AS (
  SELECT
    rb.id AS room_id,
    rb.number AS room_number,
    rb.company_code,
    rb.category,
    rb.price,
    dw.date_day,
    (EXTRACT(ISODOW FROM dw.date_day) IN (6, 7)) AS is_weekend,
    to_char(dw.date_day, 'MM-DD') IN ('01-01', '01-07', '02-14') AS is_holiday,
    (
      (
        ('x' || substr(md5(rb.id::text || '-' || dw.date_day::text || '-demand'), 1, 8))::bit(32)::int
        & 2147483647
      )::numeric / 2147483647
    ) AS demand_rand,
    (
      (
        ('x' || substr(md5(rb.id::text || '-' || dw.date_day::text || '-status'), 1, 8))::bit(32)::int
        & 2147483647
      )::numeric / 2147483647
    ) AS status_rand,
    (
      (
        ('x' || substr(md5(rb.id::text || '-' || dw.date_day::text || '-price'), 1, 8))::bit(32)::int
        & 2147483647
      )::numeric / 2147483647
    ) AS price_rand
  FROM room_base rb
  CROSS JOIN date_window dw
),
bookable_room_day AS (
  SELECT
    rd.*,
    LEAST(
      0.97,
      CASE
        WHEN rd.is_holiday THEN 0.92
        WHEN rd.is_weekend THEN 0.78
        ELSE 0.55
      END
      + CASE WHEN rd.company_code = 'C2' THEN 0.03 ELSE 0 END
    ) AS target_fill
  FROM room_day rd
),
candidate_bookings AS (
  SELECT
    brd.company_code,
    brd.room_id,
    brd.room_number,
    brd.category,
    brd.price,
    brd.date_day,
    brd.is_weekend,
    brd.is_holiday,
    brd.status_rand,
    brd.price_rand,
    row_number() OVER (PARTITION BY brd.company_code ORDER BY brd.date_day, brd.room_id) AS company_seq
  FROM bookable_room_day brd
  WHERE brd.demand_rand < brd.target_fill
),
selected_bookings AS (
  SELECT *
  FROM candidate_bookings
  WHERE company_seq <= {{bookings_per_company}}
),
prepared_bookings AS (
  SELECT
    sb.company_code,
    sb.company_seq,
    sb.room_id,
    sb.room_number,
    ('Guest ' || sb.company_code || '-' || to_char(sb.date_day, 'YYYYMMDD') || '-' || sb.room_id)::text AS guest_name,
    (lower(sb.company_code) || '-' || to_char(sb.date_day, 'YYYYMMDD') || '-' || sb.room_id || '@guest.nextstay.local')::text AS guest_email,
    (sb.date_day::timestamptz + interval '14 hour') AS check_in,
    (sb.date_day::timestamptz + interval '1 day' + interval '12 hour') AS check_out,
    CASE
      WHEN sb.date_day < current_date THEN
        CASE
          WHEN sb.status_rand < 0.06 THEN 'Cancelled'
          ELSE 'Checked-out'
        END
      WHEN sb.date_day = current_date THEN
        CASE
          WHEN sb.status_rand < 0.65 THEN 'Checked-in'
          WHEN sb.status_rand < 0.95 THEN 'Confirmed'
          ELSE 'Pending'
        END
      ELSE
        CASE
          WHEN sb.status_rand < 0.03 THEN 'Cancelled'
          WHEN sb.status_rand < 0.30 THEN 'Pending'
          ELSE 'Confirmed'
        END
    END AS status,
    ('Auto-simulated demand; weekend/holiday uplift')::text AS notes,
    ROUND(
      (
        sb.price
        * CASE
            WHEN sb.is_holiday THEN (1.35 + sb.price_rand * 0.20)
            WHEN sb.is_weekend THEN (1.18 + sb.price_rand * 0.15)
            ELSE (0.95 + sb.price_rand * 0.15)
          END
      )::numeric,
      2
    ) AS revenue_amount
  FROM selected_bookings sb
)
INSERT INTO oltp.bookings (
  guest_name,
  guest_email,
  room_id,
  room_number,
  check_in,
  check_out,
  status,
  notes,
  amount_paid,
  company_code
)
SELECT
  pb.guest_name,
  pb.guest_email,
  pb.room_id,
  pb.room_number,
  pb.check_in,
  pb.check_out,
  pb.status,
  pb.notes,
  CASE WHEN pb.status IN ('Confirmed', 'Checked-in', 'Checked-out') THEN pb.revenue_amount::float ELSE NULL END,
  pb.company_code
FROM prepared_bookings pb;

INSERT INTO oltp.guest_tokens (
  token,
  booking_id,
  room_id,
  room_number,
  guest_name,
  check_in,
  check_out,
  is_valid,
  access_status,
  wifi_ssid,
  wifi_password,
  contact_info,
  instructions,
  house_rules,
  company_code
)
SELECT
  'guest-token-' || b.company_code || '-' || b.id,
  b.id,
  b.room_id,
  b.room_number,
  b.guest_name,
  b.check_in,
  b.check_out,
  CASE WHEN b.status IN ('Cancelled', 'Expired', 'Checked-out') THEN false ELSE true END,
  CASE
    WHEN b.status IN ('Cancelled', 'Expired') THEN 'Expired'
    WHEN b.status = 'Checked-out' THEN 'Checked out'
    ELSE 'Active'
  END,
  'NextStay_Guest',
  'Welcome2026!',
  jsonb_build_object('phone', '+1-555-0100', 'email', 'support@nextstay.local'),
  jsonb_build_object('accessInfo', 'Use QR code at entrance', 'activeFrom', b.check_in, 'activeUntil', b.check_out),
  jsonb_build_object('quietHours', '22:00-08:00', 'checkOutTime', '12:00', 'smokingPolicy', 'No smoking'),
  b.company_code
FROM oltp.bookings b;

WITH checked_out_bookings AS (
  SELECT
    b.*,
    (
      (
        ('x' || substr(md5(b.id::text || '-task'), 1, 8))::bit(32)::int
        & 2147483647
      )::numeric / 2147483647
    ) AS task_rand
  FROM oltp.bookings b
  WHERE b.status = 'Checked-out'
)
INSERT INTO oltp.cleaning_tasks (
  room_id,
  room_number,
  status,
  priority,
  assigned_to,
  assigned_to_name,
  created_at,
  completed_at,
  notes,
  company_code
)
SELECT
  cb.room_id,
  cb.room_number,
  CASE
    WHEN cb.check_out::date < current_date - 1 THEN 'Completed'
    WHEN cb.check_out::date = current_date THEN 'In Progress'
    WHEN cb.task_rand < 0.55 THEN 'Pending'
    ELSE 'In Progress'
  END,
  CASE
    WHEN cb.task_rand < 0.15 THEN 'High'
    WHEN cb.task_rand < 0.60 THEN 'Medium'
    ELSE 'Low'
  END,
  NULL,
  NULL,
  cb.check_out + interval '30 minute',
  CASE
    WHEN cb.check_out::date < current_date - 1 THEN cb.check_out + interval '2 hour'
    ELSE NULL
  END,
  'Housekeeping after checkout',
  cb.company_code
FROM checked_out_bookings cb
WHERE cb.task_rand < 0.90;

UPDATE oltp.rooms r
SET status = CASE
  WHEN r.status = 'Maintenance' THEN 'Maintenance'
  WHEN EXISTS (
    SELECT 1 FROM oltp.bookings b
    WHERE b.room_id = r.id AND b.status = 'Checked-in'
  ) THEN 'Occupied'
  WHEN EXISTS (
    SELECT 1 FROM oltp.cleaning_tasks t
    WHERE t.room_id = r.id AND t.status IN ('Pending', 'In Progress')
  ) THEN 'Cleaning'
  ELSE 'Available'
END;

COMMIT;
