-- PostgreSQL migration: add chat handling mode.
ALTER TABLE chat_conversations
    ADD COLUMN IF NOT EXISTS handling_mode VARCHAR(50) NOT NULL DEFAULT 'ai';

ALTER TABLE chat_conversations
    DROP CONSTRAINT IF EXISTS chk_chat_conversations_handling_mode;

ALTER TABLE chat_conversations
    ADD CONSTRAINT chk_chat_conversations_handling_mode
    CHECK (handling_mode IN ('ai', 'manual'));
