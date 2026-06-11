-- Migration: add edit/delete tracking to chat_messages

ALTER TABLE chat_messages
    ADD COLUMN IF NOT EXISTS edited_at  TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
