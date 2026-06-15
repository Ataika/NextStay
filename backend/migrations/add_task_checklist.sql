-- Per-task checklist items (owner-defined or defaults)

ALTER TABLE cleaning_tasks ADD COLUMN IF NOT EXISTS checklist JSON;
