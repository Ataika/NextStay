-- Seed data for OLTP tables
-- WARNING: This script truncates OLTP tables.

BEGIN;

TRUNCATE TABLE
  guest_tokens,
  cleaning_tasks,
  bookings,
  rooms
RESTART IDENTITY CASCADE;

-- Rooms
INSERT INTO rooms (number, category, status, price, capacity, description, amenities)
VALUES
  ('101', 'Standard', 'Available', 89.00, 2, 'Standard room, courtyard view', '{"wifi": true, "tv": true}'),
  ('102', 'Standard', 'Available', 95.00, 2, 'Standard room, city view', '{"wifi": true, "tv": true}'),
  ('201', 'Deluxe', 'Available', 140.00, 3, 'Deluxe room with sofa', '{"wifi": true, "tv": true, "sofa": true}'),
  ('202', 'Deluxe', 'Maintenance', 150.00, 3, 'Deluxe room (maintenance)', '{"wifi": true, "tv": true}'),
  ('301', 'Suite', 'Available', 220.00, 4, 'Suite with balcony', '{"wifi": true, "tv": true, "balcony": true}');

-- Bookings (one pending, one upcoming, one checked-in)
INSERT INTO bookings (
  guest_name,
  guest_email,
  room_id,
  room_number,
  check_in,
  check_out,
  status,
  notes
)
VALUES
  ('Alex Chen', 'alex@example.com', 1, '101', '2026-03-10T14:00:00Z', '2026-03-14T12:00:00Z', 'Pending', 'Late arrival'),
  ('Maria Lopez', 'maria@example.com', 2, '102', '2026-03-20T14:00:00Z', '2026-03-24T12:00:00Z', 'Upcoming', 'Allergic to feathers'),
  ('John Kim', 'john@example.com', 3, '201', '2026-02-10T14:00:00Z', '2026-02-12T12:00:00Z', 'Checked-in', 'VIP guest');

-- Guest tokens for each booking
INSERT INTO guest_tokens (
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
  house_rules
)
VALUES
  (
    'guest-token-seed-alex',
    1,
    1,
    '101',
    'Alex Chen',
    '2026-03-10T14:00:00Z',
    '2026-03-14T12:00:00Z',
    true,
    'Active',
    'NextStay_Guest',
    'Welcome2026!',
    '{"phone":"+1 (555) 111-2222","email":"support@nextstay.com"}',
    '{"accessInfo":"Use the QR at the main entrance.","activeFrom":"2026-03-10T14:00:00Z","activeUntil":"2026-03-14T12:00:00Z"}',
    '{"quietHours":"22:00-08:00","checkOutTime":"12:00","smokingPolicy":"No smoking"}'
  ),
  (
    'guest-token-seed-maria',
    2,
    2,
    '102',
    'Maria Lopez',
    '2026-03-20T14:00:00Z',
    '2026-03-24T12:00:00Z',
    true,
    'Active',
    'NextStay_Guest',
    'Welcome2026!',
    '{"phone":"+1 (555) 333-4444","email":"support@nextstay.com"}',
    '{"accessInfo":"Use the QR at the main entrance.","activeFrom":"2026-03-20T14:00:00Z","activeUntil":"2026-03-24T12:00:00Z"}',
    '{"quietHours":"22:00-08:00","checkOutTime":"12:00","smokingPolicy":"No smoking"}'
  ),
  (
    'guest-token-seed-john',
    3,
    3,
    '201',
    'John Kim',
    '2026-02-10T14:00:00Z',
    '2026-02-12T12:00:00Z',
    true,
    'Active',
    'NextStay_Guest',
    'Welcome2026!',
    '{"phone":"+1 (555) 555-6666","email":"support@nextstay.com"}',
    '{"accessInfo":"Use the QR at the main entrance.","activeFrom":"2026-02-10T14:00:00Z","activeUntil":"2026-02-12T12:00:00Z"}',
    '{"quietHours":"22:00-08:00","checkOutTime":"12:00","smokingPolicy":"No smoking"}'
  );

-- Cleaning task seed (for staff view)
INSERT INTO cleaning_tasks (
  room_id,
  room_number,
  status,
  priority,
  assigned_to,
  assigned_to_name,
  notes
)
VALUES
  (3, '201', 'Pending', 'High', NULL, NULL, 'Post-checkout cleaning'),
  (2, '102', 'In Progress', 'Medium', 2, 'Staff User', 'Routine cleaning');

COMMIT;
