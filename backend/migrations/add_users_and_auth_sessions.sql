-- Migration: Add users and auth_sessions tables for OTP + RBAC

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(120) NOT NULL,
    role VARCHAR(20) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
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

INSERT INTO users (email, full_name, role, is_active)
VALUES
    ('admin@nextstay.com', 'Admin User', 'OWNER', TRUE),
    ('staff@nextstay.com', 'Staff User', 'STAFF', TRUE)
ON CONFLICT (email) DO NOTHING;
