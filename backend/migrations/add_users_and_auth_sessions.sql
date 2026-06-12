-- Migration: Add users and auth_sessions tables for OTP + RBAC

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(120) NOT NULL,
    role VARCHAR(20) NOT NULL,
    password_hash VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    chat_wallpaper VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT users_role_chk CHECK (role IN ('OWNER', 'STAFF'))
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

CREATE TABLE IF NOT EXISTS auth_sessions (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_jti VARCHAR(64) NOT NULL UNIQUE,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at ON auth_sessions (expires_at);

-- Backfill columns for databases created before password/login migrations
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS chat_wallpaper VARCHAR(500);
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(10) NOT NULL DEFAULT 'en';
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;

INSERT INTO users (email, full_name, role, password_hash, is_active, preferred_language, failed_login_attempts)
VALUES
    (
        'admin@nextstay.com',
        'Admin User',
        'OWNER',
        'c4b698a06f616872ec2ecdf2e1bcee260addc189056e390ad189b3c9d22513d3:056e80a9d3fd4bc76f299cf28af78edcc1404bc23ca006e8849ff78fc8bd1cb6',
        TRUE,
        'en',
        0
    ),
    (
        'staff@nextstay.com',
        'Staff User',
        'STAFF',
        'e1ebe27883cf319856064b6aca5d5c4d4cc6e90b1de3ef4f8f54a5cdc8e630ab:f396d335e4118707bcb1c242e247a30039efac0ad4c837be21b657ea052d6889',
        TRUE,
        'en',
        0
    ),
    (
        'lizett@cleaning.com',
        'Lizett',
        'STAFF',
        '2845e14722a9bb59b8bfdac9329b1b9e5494cdd04759e2d6ef7a3b176cb4706c:d973e6e83921048d86e8cd454283935d83ea6d88cf991c891bfe70592ed6de69',
        TRUE,
        'en',
        0
    )
ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash;
