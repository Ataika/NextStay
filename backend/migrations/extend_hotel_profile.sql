-- Migration: extend hotel_profile with operational fields

ALTER TABLE hotel_profile
    ADD COLUMN IF NOT EXISTS currency      VARCHAR(3),
    ADD COLUMN IF NOT EXISTS phone         VARCHAR(30),
    ADD COLUMN IF NOT EXISTS check_in_time  VARCHAR(5),
    ADD COLUMN IF NOT EXISTS check_out_time VARCHAR(5),
    ADD COLUMN IF NOT EXISTS wifi_name     VARCHAR(100),
    ADD COLUMN IF NOT EXISTS wifi_password  VARCHAR(100),
    ADD COLUMN IF NOT EXISTS house_rules   TEXT;
