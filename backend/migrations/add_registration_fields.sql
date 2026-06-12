-- User profile fields and hotel invites for registration flow

ALTER TABLE users ADD COLUMN IF NOT EXISTS birth_year INTEGER;
ALTER TABLE users ADD COLUMN IF NOT EXISTS gender VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS hotel_id INTEGER REFERENCES hotel_profile(id);

-- Link existing users to the default hotel profile row
UPDATE users
SET hotel_id = (SELECT id FROM hotel_profile ORDER BY id ASC LIMIT 1)
WHERE hotel_id IS NULL
  AND EXISTS (SELECT 1 FROM hotel_profile);

CREATE TABLE IF NOT EXISTS hotel_invites (
    id SERIAL PRIMARY KEY,
    hotel_id INTEGER NOT NULL REFERENCES hotel_profile(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    code VARCHAR(16) NOT NULL UNIQUE,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hotel_invites_code ON hotel_invites(code);
CREATE INDEX IF NOT EXISTS idx_hotel_invites_email ON hotel_invites(email);
