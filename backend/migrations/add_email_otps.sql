-- Migration: Add email OTP storage table for auth flow

CREATE TABLE IF NOT EXISTS oltp.email_otps (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    code_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    attempts INT NOT NULL DEFAULT 0,
    used BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT email_otps_attempts_chk CHECK (attempts >= 0)
);

CREATE INDEX IF NOT EXISTS idx_email_otps_email_created_at
    ON oltp.email_otps (email, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_otps_expires_at
    ON oltp.email_otps (expires_at);
