-- Full staff seed: cleaners, hostesses, managers.
-- Safe to run multiple times (skips existing by name+role).
-- Run AFTER migrate_shift_types.sql.

-- ============================================================
-- CLEANERS  (6 new + existing Lizett stays as-is)
-- ============================================================
DO $$
DECLARE
  rid INTEGER;
  names TEXT[] := ARRAY['Catalina','Bernardina','Violetta','Sophia','Ella','Elena'];
  nm TEXT;
BEGIN
  FOREACH nm IN ARRAY names LOOP
    IF NOT EXISTS (SELECT 1 FROM staff_members WHERE name = nm AND role = 'cleaner') THEN
      INSERT INTO staff_members (name, role, hire_date, annual_days_off)
      VALUES (nm, 'cleaner', '2025-01-01', 20);
    END IF;
  END LOOP;
END $$;

-- Assign Sat + Sun as days off for all active cleaners (current week only)
-- Sat = 2026-05-16, Sun = 2026-05-17
INSERT INTO staff_shifts (staff_id, shift_date, shift_type, hours)
SELECT id, '2026-05-16'::date, 'off', 0
FROM staff_members
WHERE role = 'cleaner' AND is_active = TRUE
ON CONFLICT (staff_id, shift_date) DO NOTHING;

INSERT INTO staff_shifts (staff_id, shift_date, shift_type, hours)
SELECT id, '2026-05-17'::date, 'off', 0
FROM staff_members
WHERE role = 'cleaner' AND is_active = TRUE
ON CONFLICT (staff_id, shift_date) DO NOTHING;

-- ============================================================
-- HOSTESSES
-- ============================================================

-- Angelina: Mon-Fri 08:00-20:00, Sat-Sun off
DO $$
DECLARE rid INTEGER;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM staff_members WHERE name = 'Angelina' AND role = 'hostess') THEN
    INSERT INTO staff_members (name, role, hire_date, annual_days_off)
    VALUES ('Angelina', 'hostess', '2024-09-01', 20)
    RETURNING id INTO rid;
  ELSE
    SELECT id INTO rid FROM staff_members WHERE name = 'Angelina' AND role = 'hostess' LIMIT 1;
  END IF;

  -- Mon-Fri: day_extended (12h)
  INSERT INTO staff_shifts (staff_id, shift_date, shift_type, hours)
  SELECT rid, d::date, 'day_extended', 12
  FROM unnest(ARRAY[
    '2026-05-11','2026-05-12','2026-05-13','2026-05-14','2026-05-15'
  ]::date[]) AS d
  ON CONFLICT (staff_id, shift_date) DO UPDATE SET shift_type='day_extended', hours=12;

  -- Sat-Sun: off
  INSERT INTO staff_shifts (staff_id, shift_date, shift_type, hours)
  SELECT rid, d::date, 'off', 0
  FROM unnest(ARRAY['2026-05-16','2026-05-17']::date[]) AS d
  ON CONFLICT (staff_id, shift_date) DO UPDATE SET shift_type='off', hours=0;
END $$;

-- Michaela: Mon-Fri 20:00-08:00, Sat-Sun off
DO $$
DECLARE rid INTEGER;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM staff_members WHERE name = 'Michaela' AND role = 'hostess') THEN
    INSERT INTO staff_members (name, role, hire_date, annual_days_off)
    VALUES ('Michaela', 'hostess', '2024-09-01', 20)
    RETURNING id INTO rid;
  ELSE
    SELECT id INTO rid FROM staff_members WHERE name = 'Michaela' AND role = 'hostess' LIMIT 1;
  END IF;

  -- Mon-Fri: night_extended (12h)
  INSERT INTO staff_shifts (staff_id, shift_date, shift_type, hours)
  SELECT rid, d::date, 'night_extended', 12
  FROM unnest(ARRAY[
    '2026-05-11','2026-05-12','2026-05-13','2026-05-14','2026-05-15'
  ]::date[]) AS d
  ON CONFLICT (staff_id, shift_date) DO UPDATE SET shift_type='night_extended', hours=12;

  -- Sat-Sun: off
  INSERT INTO staff_shifts (staff_id, shift_date, shift_type, hours)
  SELECT rid, d::date, 'off', 0
  FROM unnest(ARRAY['2026-05-16','2026-05-17']::date[]) AS d
  ON CONFLICT (staff_id, shift_date) DO UPDATE SET shift_type='off', hours=0;
END $$;

-- Daniela: Sat-Sun full day (day_extended), Mon-Fri off
DO $$
DECLARE rid INTEGER;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM staff_members WHERE name = 'Daniela' AND role = 'hostess') THEN
    INSERT INTO staff_members (name, role, hire_date, annual_days_off)
    VALUES ('Daniela', 'hostess', '2024-09-01', 20)
    RETURNING id INTO rid;
  ELSE
    SELECT id INTO rid FROM staff_members WHERE name = 'Daniela' AND role = 'hostess' LIMIT 1;
  END IF;

  -- Mon-Fri: off
  INSERT INTO staff_shifts (staff_id, shift_date, shift_type, hours)
  SELECT rid, d::date, 'off', 0
  FROM unnest(ARRAY[
    '2026-05-11','2026-05-12','2026-05-13','2026-05-14','2026-05-15'
  ]::date[]) AS d
  ON CONFLICT (staff_id, shift_date) DO UPDATE SET shift_type='off', hours=0;

  -- Sat-Sun: day_extended (12h)
  INSERT INTO staff_shifts (staff_id, shift_date, shift_type, hours)
  SELECT rid, d::date, 'day_extended', 12
  FROM unnest(ARRAY['2026-05-16','2026-05-17']::date[]) AS d
  ON CONFLICT (staff_id, shift_date) DO UPDATE SET shift_type='day_extended', hours=12;
END $$;

-- ============================================================
-- MANAGERS  (staff members, not user login accounts)
-- ============================================================
INSERT INTO staff_members (name, role, hire_date, annual_days_off)
SELECT 'Staff Manager', 'manager', '2024-01-01', 25
WHERE NOT EXISTS (SELECT 1 FROM staff_members WHERE name = 'Staff Manager' AND role = 'manager');

INSERT INTO staff_members (name, role, hire_date, annual_days_off)
SELECT 'Inventory Manager', 'manager', '2024-01-01', 25
WHERE NOT EXISTS (SELECT 1 FROM staff_members WHERE name = 'Inventory Manager' AND role = 'manager');

INSERT INTO staff_members (name, role, hire_date, annual_days_off)
SELECT 'Hostess Manager', 'manager', '2024-01-01', 25
WHERE NOT EXISTS (SELECT 1 FROM staff_members WHERE name = 'Hostess Manager' AND role = 'manager');
