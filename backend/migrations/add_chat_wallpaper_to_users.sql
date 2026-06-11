-- Migration: Add chat_wallpaper preference column to users table

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS chat_wallpaper VARCHAR(500);
