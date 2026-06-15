-- Scope staff members to a hotel (multi-tenant isolation)

-- Canonical hotel entity is `hotels` (hotel_profile is its 1:1 shared-PK extension).
ALTER TABLE staff_members ADD COLUMN IF NOT EXISTS hotel_id INTEGER REFERENCES hotels(id);

UPDATE staff_members sm
SET hotel_id = u.hotel_id
FROM users u
WHERE LOWER(sm.email) = LOWER(u.email)
  AND sm.hotel_id IS NULL
  AND u.hotel_id IS NOT NULL;

UPDATE staff_members
SET hotel_id = (SELECT id FROM hotels ORDER BY id ASC LIMIT 1)
WHERE hotel_id IS NULL
  AND EXISTS (SELECT 1 FROM hotels);

CREATE INDEX IF NOT EXISTS idx_staff_members_hotel_id ON staff_members(hotel_id);
