-- Allow MANAGER, DIRECTOR, and SYS_ADMIN in users.role

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_chk;

ALTER TABLE users
    ADD CONSTRAINT users_role_chk
    CHECK (role IN ('OWNER', 'STAFF', 'MANAGER', 'DIRECTOR', 'SYS_ADMIN'));
