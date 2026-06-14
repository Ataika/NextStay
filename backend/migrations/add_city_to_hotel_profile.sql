-- Migration: city field for hotel discovery in public booking flow

ALTER TABLE hotel_profile
    ADD COLUMN IF NOT EXISTS city VARCHAR(100);

UPDATE hotel_profile
SET city = 'Las Vegas'
WHERE city IS NULL OR TRIM(city) = '';
