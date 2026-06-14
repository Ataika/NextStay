-- Migration: track per-participant read state for unread message counts

ALTER TABLE chat_participants
    ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_chat_participants_last_read_at
    ON chat_participants (user_id, last_read_at);
