-- Migration: add conversation-based chat model for direct and group messaging

CREATE TABLE IF NOT EXISTS chat_conversations (
    id SERIAL PRIMARY KEY,
    kind VARCHAR(20) NOT NULL,
    title VARCHAR(255),
    system_key VARCHAR(100) UNIQUE,
    direct_key VARCHAR(100) UNIQUE,
    created_by_id INT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chat_conversations_kind_chk CHECK (kind IN ('direct', 'group'))
);

CREATE INDEX IF NOT EXISTS idx_chat_conversations_kind
    ON chat_conversations (kind);

CREATE INDEX IF NOT EXISTS idx_chat_conversations_created_by_id
    ON chat_conversations (created_by_id);

CREATE INDEX IF NOT EXISTS idx_chat_conversations_updated_at
    ON chat_conversations (updated_at DESC);

CREATE TABLE IF NOT EXISTS chat_participants (
    id SERIAL PRIMARY KEY,
    conversation_id INT NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_chat_participants_conversation_user UNIQUE (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_participants_conversation_id
    ON chat_participants (conversation_id);

CREATE INDEX IF NOT EXISTS idx_chat_participants_user_id
    ON chat_participants (user_id);

ALTER TABLE chat_messages
    ADD COLUMN IF NOT EXISTS conversation_id INT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chat_messages_conversation_id_fkey'
    ) THEN
        ALTER TABLE chat_messages
            ADD CONSTRAINT chat_messages_conversation_id_fkey
            FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_id
    ON chat_messages (conversation_id);

INSERT INTO chat_conversations (kind, title, system_key, created_by_id)
SELECT
    'group',
    'General staff',
    'general',
    (
        SELECT id
        FROM users
        WHERE role IN ('OWNER', 'SYS_ADMIN', 'DIRECTOR')
          AND is_active = TRUE
        ORDER BY
            CASE role
                WHEN 'SYS_ADMIN' THEN 1
                WHEN 'DIRECTOR' THEN 2
                WHEN 'OWNER' THEN 3
                ELSE 4
            END,
            id
        LIMIT 1
    )
WHERE NOT EXISTS (
    SELECT 1
    FROM chat_conversations
    WHERE system_key = 'general'
);

INSERT INTO chat_participants (conversation_id, user_id)
SELECT c.id, u.id
FROM chat_conversations c
JOIN users u
  ON u.is_active = TRUE
 AND u.role IN ('OWNER', 'STAFF', 'SYS_ADMIN', 'DIRECTOR', 'MANAGER')
WHERE c.system_key = 'general'
ON CONFLICT (conversation_id, user_id) DO NOTHING;

UPDATE chat_messages
SET conversation_id = c.id
FROM chat_conversations c
WHERE c.system_key = 'general'
  AND chat_messages.conversation_id IS NULL;

ALTER TABLE chat_messages
    ALTER COLUMN conversation_id SET NOT NULL;

UPDATE chat_conversations c
SET updated_at = COALESCE(
    (
        SELECT MAX(m.created_at)
        FROM chat_messages m
        WHERE m.conversation_id = c.id
    ),
    c.updated_at
);
