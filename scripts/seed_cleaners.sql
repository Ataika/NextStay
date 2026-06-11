-- Add 3 additional cleaning staff members for round-robin scheduling.
-- Safe to run multiple times (checks by name+role to avoid duplicates).

INSERT INTO staff_members (name, role, email, phone, hire_date, annual_days_off)
SELECT 'Carlos Mendoza', 'cleaner', 'carlos.mendoza@nextstay.com', '+1 (555) 234-5678', '2024-03-01', 20
WHERE NOT EXISTS (
    SELECT 1 FROM staff_members WHERE name = 'Carlos Mendoza' AND role = 'cleaner'
);

INSERT INTO staff_members (name, role, email, phone, hire_date, annual_days_off)
SELECT 'Sophie Laurent', 'cleaner', 'sophie.laurent@nextstay.com', '+1 (555) 345-6789', '2024-06-15', 20
WHERE NOT EXISTS (
    SELECT 1 FROM staff_members WHERE name = 'Sophie Laurent' AND role = 'cleaner'
);

INSERT INTO staff_members (name, role, email, phone, hire_date, annual_days_off)
SELECT 'James Chen', 'cleaner', 'james.chen@nextstay.com', '+1 (555) 456-7890', '2025-01-10', 20
WHERE NOT EXISTS (
    SELECT 1 FROM staff_members WHERE name = 'James Chen' AND role = 'cleaner'
);
