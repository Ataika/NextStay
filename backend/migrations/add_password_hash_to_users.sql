-- Migration: Add password_hash column to users table and backfill default dev credentials

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);

UPDATE users
SET password_hash = CASE email
    WHEN 'admin@nextstay.com' THEN 'ad86f7b12998e74610480a33cf5b63c65c7aa71806294ead8c1797b442f75302:48e4ba4a91cdc7623318d17ec51ad56c883f84c56ffdc00e19b09418c987e0f3'
    WHEN 'staff@nextstay.com' THEN 'e1ebe27883cf319856064b6aca5d5c4d4cc6e90b1de3ef4f8f54a5cdc8e630ab:f396d335e4118707bcb1c242e247a30039efac0ad4c837be21b657ea052d6889'
    ELSE password_hash
END
WHERE password_hash IS NULL
  AND email IN ('admin@nextstay.com', 'staff@nextstay.com');
