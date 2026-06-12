-- Scope staff members to a hotel (multi-tenant isolation)

ALTER TABLE staff_members ADD COLUMN IF NOT EXISTS hotel_id INTEGER REFERENCES hotel_profile(id);

UPDATE staff_members sm
SET hotel_id = u.hotel_id
FROM users u
WHERE LOWER(sm.email) = LOWER(u.email)
  AND sm.hotel_id IS NULL
  AND u.hotel_id IS NOT NULL;

UPDATE staff_members
SET hotel_id = (SELECT id FROM hotel_profile ORDER BY id ASC LIMIT 1)
WHERE hotel_id IS NULL
  AND EXISTS (SELECT 1 FROM hotel_profile);

CREATE INDEX IF NOT EXISTS idx_staff_members_hotel_id ON staff_members(hotel_id);
