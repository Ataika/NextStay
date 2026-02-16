-- Migration: Add users and auth_sessions tables for OTP + RBAC

CREATE TABLE IF NOT EXISTS oltp.companies (
    company_code TEXT PRIMARY KEY,
    company_name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO oltp.companies (company_code, company_name)
VALUES
    ('C1', 'NextStay Alpha Hospitality'),
    ('C2', 'NextStay Beta Hospitality')
ON CONFLICT (company_code) DO NOTHING;

CREATE TABLE IF NOT EXISTS oltp.users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(120) NOT NULL,
    role VARCHAR(20) NOT NULL,
    company_code VARCHAR(10) REFERENCES oltp.companies(company_code),
    password_hash VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT users_role_chk CHECK (role IN ('OWNER', 'STAFF'))
);

ALTER TABLE oltp.users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
ALTER TABLE oltp.users ADD COLUMN IF NOT EXISTS company_code VARCHAR(10) REFERENCES oltp.companies(company_code);

CREATE INDEX IF NOT EXISTS idx_users_email ON oltp.users (email);

CREATE TABLE IF NOT EXISTS oltp.auth_sessions (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES oltp.users(id) ON DELETE CASCADE,
    token_jti VARCHAR(64) NOT NULL UNIQUE,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON oltp.auth_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at ON oltp.auth_sessions (expires_at);

INSERT INTO oltp.users (email, full_name, role, is_active)
VALUES
    ('admin@nextstay.com', 'Admin User', 'OWNER', TRUE),
    ('staff@nextstay.com', 'Staff User', 'STAFF', TRUE),
    ('nextstay@yandex.com', 'NextStay Owner', 'OWNER', TRUE),
    ('staff.uborka@yandex.com', 'Cleaning Staff Dev', 'STAFF', TRUE),
    ('uborka.staff@yandex.com', 'Cleaning Staff Ops', 'STAFF', TRUE),
    ('owner.c2@nextstay.com', 'Owner C2', 'OWNER', TRUE)
ON CONFLICT (email) DO NOTHING;

UPDATE oltp.users
SET company_code = CASE
    WHEN email IN ('admin@nextstay.com', 'staff@nextstay.com', 'staff.uborka@yandex.com') THEN 'C1'
    WHEN email IN ('nextstay@yandex.com', 'uborka.staff@yandex.com', 'owner.c2@nextstay.com') THEN 'C2'
    ELSE COALESCE(company_code, 'C1')
END
WHERE company_code IS NULL;
