-- Migration: store Stripe payment data in dedicated table

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

CREATE TABLE IF NOT EXISTS oltp.payments (
    id SERIAL PRIMARY KEY,
    booking_id INT NOT NULL REFERENCES oltp.bookings(id) ON DELETE CASCADE,
    stripe_session_id VARCHAR(255),
    stripe_payment_intent_id VARCHAR(255),
    stripe_event_id VARCHAR(255) UNIQUE,
    event_type VARCHAR(100),
    payment_status VARCHAR(50),
    currency VARCHAR(10),
    amount_total_cents INT,
    customer_email VARCHAR(255),
    payload JSONB,
    error_message TEXT,
    company_code TEXT REFERENCES oltp.companies(company_code),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_booking_id ON oltp.payments (booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_session_id ON oltp.payments (stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_intent_id ON oltp.payments (stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_payments_event_type ON oltp.payments (event_type);
CREATE INDEX IF NOT EXISTS idx_payments_status ON oltp.payments (payment_status);
CREATE INDEX IF NOT EXISTS idx_payments_company_code ON oltp.payments (company_code);
