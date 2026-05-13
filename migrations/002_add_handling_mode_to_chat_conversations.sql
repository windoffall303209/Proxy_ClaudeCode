-- File migrations/002_add_handling_mode_to_chat_conversations.sql
-- PostgreSQL version.

ALTER TABLE chat_conversations
    ADD COLUMN IF NOT EXISTS handling_mode VARCHAR(20) NOT NULL DEFAULT 'ai';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'chat_conversations'::regclass
          AND conname = 'chat_conversations_handling_mode_check'
    ) THEN
        ALTER TABLE chat_conversations
            ADD CONSTRAINT chat_conversations_handling_mode_check
            CHECK (handling_mode IN ('ai', 'manual'));
    END IF;
END $$;
