-- Scope rooms to a hotel (multi-tenant isolation)

ALTER TABLE rooms ADD COLUMN IF NOT EXISTS hotel_id INTEGER REFERENCES hotel_profile(id);

UPDATE rooms
SET hotel_id = (SELECT id FROM hotel_profile ORDER BY id ASC LIMIT 1)
WHERE hotel_id IS NULL
  AND EXISTS (SELECT 1 FROM hotel_profile);

ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_number_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_rooms_hotel_number ON rooms(hotel_id, number);
