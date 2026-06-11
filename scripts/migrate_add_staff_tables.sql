-- Migration: staff_members + staff_shifts tables
-- Run once against the live database.

CREATE TABLE IF NOT EXISTS public.staff_members (
    id SERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    role VARCHAR(60) NOT NULL,
    email VARCHAR(120),
    phone VARCHAR(30),
    hire_date DATE DEFAULT CURRENT_DATE,
    is_active BOOLEAN DEFAULT TRUE,
    annual_days_off INTEGER DEFAULT 20,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.staff_shifts (
    id SERIAL PRIMARY KEY,
    staff_id INTEGER NOT NULL REFERENCES public.staff_members (id) ON DELETE CASCADE,
    shift_date DATE NOT NULL,
    shift_type VARCHAR(20) NOT NULL
    CHECK (shift_type IN ('morning', 'afternoon', 'night', 'off')),
    hours NUMERIC(4, 2) DEFAULT 8.0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (staff_id, shift_date)
);

CREATE INDEX IF NOT EXISTS idx_staff_shifts_date
ON public.staff_shifts (shift_date);

CREATE INDEX IF NOT EXISTS idx_staff_shifts_staff
ON public.staff_shifts (staff_id);
