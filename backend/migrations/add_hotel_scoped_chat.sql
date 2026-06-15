-- Scope hotel general chat per property (multi-tenant isolation)

INSERT INTO chat_conversations (kind, title, system_key, created_by_id)
SELECT
    'group',
    hp.hotel_name || ' staff',
    'hotel:' || hp.id::text,
    (
        SELECT u.id
        FROM users u
        WHERE u.hotel_id = hp.id
          AND u.role IN ('OWNER', 'SYS_ADMIN', 'DIRECTOR', 'MANAGER')
          AND u.is_active = TRUE
        ORDER BY u.id
        LIMIT 1
    )
FROM hotel_profile hp
WHERE NOT EXISTS (
    SELECT 1
    FROM chat_conversations c
    WHERE c.system_key = 'hotel:' || hp.id::text
);

INSERT INTO chat_participants (conversation_id, user_id)
SELECT c.id, u.id
FROM chat_conversations c
JOIN users u
  ON u.hotel_id = CAST(SUBSTRING(c.system_key FROM 7) AS INTEGER)
 AND u.is_active = TRUE
 AND u.role IN ('OWNER', 'STAFF', 'SYS_ADMIN', 'DIRECTOR', 'MANAGER')
WHERE c.system_key LIKE 'hotel:%'
ON CONFLICT (conversation_id, user_id) DO NOTHING;

DELETE FROM chat_participants cp
USING chat_conversations c, users u
WHERE cp.conversation_id = c.id
  AND cp.user_id = u.id
  AND c.system_key = 'general'
  AND u.hotel_id IS NOT NULL;
