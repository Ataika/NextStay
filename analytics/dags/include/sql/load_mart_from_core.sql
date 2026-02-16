BEGIN;

TRUNCATE TABLE
  mart.tasks_daily,
  mart.revenue_by_room_type_daily,
  mart.bookings_daily,
  mart.revpar_daily,
  mart.customer_loyalty,
  mart.fact_occupancy;

WITH room_inventory AS (
  SELECT
    COALESCE(company_code, 'C1') AS company_code,
    room_type,
    COUNT(*)::int AS total_rooms
  FROM stg.rooms
  GROUP BY 1, 2
),
booking_snapshot AS (
  SELECT
    b.check_in AS date_day,
    b.room_id,
    r.room_type,
    COALESCE(b.company_code, 'C1') AS company_code,
    b.status,
    b.total_price
  FROM stg.bookings b
  JOIN stg.rooms r ON r.room_id = b.room_id
),
occupancy_agg AS (
  SELECT
    bs.date_day,
    bs.room_type,
    bs.company_code,
    COUNT(DISTINCT bs.room_id) FILTER (WHERE bs.status IN ('staying', 'completed'))::int AS occupied_rooms
  FROM booking_snapshot bs
  GROUP BY bs.date_day, bs.room_type, bs.company_code
)
INSERT INTO mart.fact_occupancy (date_day, room_type, occupied_rooms, total_rooms, occupancy_rate, company_code)
SELECT
  oa.date_day,
  oa.room_type,
  oa.occupied_rooms,
  COALESCE(ri.total_rooms, 0) AS total_rooms,
  ROUND(100.0 * oa.occupied_rooms / NULLIF(COALESCE(ri.total_rooms, 0), 0), 2) AS occupancy_rate,
  oa.company_code
FROM occupancy_agg oa
LEFT JOIN room_inventory ri
  ON ri.company_code = oa.company_code
 AND ri.room_type = oa.room_type;

INSERT INTO mart.customer_loyalty (client_sk, total_spent, total_nights, loyalty_tier, updated_at, company_code)
SELECT
  fc.client_sk,
  SUM(fc.total_amount) AS total_spent,
  SUM(GREATEST(1, (d_out.date_day - d_in.date_day)))::int AS total_nights,
  CASE
    WHEN SUM(fc.total_amount) >= 10000 THEN 'gold'::loyalty_tier_enum
    WHEN SUM(fc.total_amount) >= 3000 THEN 'silver'::loyalty_tier_enum
    ELSE 'bronze'::loyalty_tier_enum
  END,
  now(),
  COALESCE(fc.company_code, 'C1')
FROM core.fact_bookings fc
JOIN core.dim_dates d_in ON d_in.date_sk = fc.check_in_date_sk
JOIN core.dim_dates d_out ON d_out.date_sk = fc.check_out_date_sk
GROUP BY fc.client_sk, COALESCE(fc.company_code, 'C1');

WITH room_totals AS (
  SELECT
    COALESCE(company_code, 'C1') AS company_code,
    COUNT(*)::int AS rooms_available
  FROM stg.rooms
  GROUP BY 1
),
revenue_daily AS (
  SELECT
    b.check_in AS date_day,
    COALESCE(b.company_code, 'C1') AS company_code,
    SUM(b.total_price) AS total_revenue
  FROM stg.bookings b
  GROUP BY b.check_in, COALESCE(b.company_code, 'C1')
)
INSERT INTO mart.revpar_daily (date_day, total_revenue, rooms_available, revpar, company_code)
SELECT
  rd.date_day,
  rd.total_revenue,
  COALESCE(rt.rooms_available, 0) AS rooms_available,
  ROUND(rd.total_revenue / NULLIF(COALESCE(rt.rooms_available, 0), 0), 2) AS revpar,
  rd.company_code
FROM revenue_daily rd
LEFT JOIN room_totals rt
  ON rt.company_code = rd.company_code;

WITH room_totals AS (
  SELECT
    COALESCE(company_code, 'C1') AS company_code,
    COUNT(*)::int AS rooms_available
  FROM stg.rooms
  GROUP BY 1
),
bookings_daily AS (
  SELECT
    b.check_in AS date_day,
    COALESCE(b.company_code, 'C1') AS company_code,
    COUNT(*)::int AS bookings_count,
    SUM(GREATEST(1, (b.check_out - b.check_in)))::int AS nights_sold,
    SUM(b.total_price) AS total_revenue,
    COUNT(DISTINCT b.room_id) FILTER (WHERE b.status IN ('confirmed', 'staying', 'completed'))::int AS occupied_rooms
  FROM stg.bookings b
  GROUP BY b.check_in, COALESCE(b.company_code, 'C1')
)
INSERT INTO mart.bookings_daily (
  company_code,
  date_day,
  bookings_count,
  nights_sold,
  total_revenue,
  adr,
  rooms_available,
  occupancy_rate,
  revpar
)
SELECT
  bd.company_code,
  bd.date_day,
  bd.bookings_count,
  bd.nights_sold,
  bd.total_revenue,
  ROUND(bd.total_revenue / NULLIF(bd.bookings_count, 0), 2) AS adr,
  COALESCE(rt.rooms_available, 0) AS rooms_available,
  ROUND(100.0 * bd.occupied_rooms / NULLIF(COALESCE(rt.rooms_available, 0), 0), 2) AS occupancy_rate,
  ROUND(bd.total_revenue / NULLIF(COALESCE(rt.rooms_available, 0), 0), 2) AS revpar
FROM bookings_daily bd
LEFT JOIN room_totals rt
  ON rt.company_code = bd.company_code;

INSERT INTO mart.revenue_by_room_type_daily (
  company_code,
  date_day,
  room_type,
  bookings_count,
  total_revenue,
  adr
)
SELECT
  COALESCE(b.company_code, 'C1') AS company_code,
  b.check_in AS date_day,
  r.room_type,
  COUNT(*)::int AS bookings_count,
  SUM(b.total_price) AS total_revenue,
  ROUND(SUM(b.total_price) / NULLIF(COUNT(*), 0), 2) AS adr
FROM stg.bookings b
JOIN stg.rooms r ON r.room_id = b.room_id
GROUP BY COALESCE(b.company_code, 'C1'), b.check_in, r.room_type;

INSERT INTO mart.tasks_daily (
  company_code,
  date_day,
  tasks_created,
  tasks_completed,
  completion_rate
)
SELECT
  COALESCE(t.company_code, 'C1') AS company_code,
  t.created_at::date AS date_day,
  COUNT(*)::int AS tasks_created,
  COUNT(*) FILTER (WHERE t.status = 'done')::int AS tasks_completed,
  ROUND(100.0 * COUNT(*) FILTER (WHERE t.status = 'done') / NULLIF(COUNT(*), 0), 2) AS completion_rate
FROM stg.cleaning_tasks t
GROUP BY COALESCE(t.company_code, 'C1'), t.created_at::date;

COMMIT;
