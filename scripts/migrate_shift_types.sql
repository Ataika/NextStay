-- Migration: extend shift types to support 12-hour hostess shifts.
-- Run once against the live database.

ALTER TABLE staff_shifts DROP CONSTRAINT IF EXISTS staff_shifts_shift_type_check;

ALTER TABLE staff_shifts
ADD CONSTRAINT staff_shifts_shift_type_check
CHECK (shift_type IN ('morning', 'afternoon', 'night', 'off', 'day_extended', 'night_extended'));
