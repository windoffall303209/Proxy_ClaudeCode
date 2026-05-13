-- Migration: add rich content support to chat messages
-- PostgreSQL version.

ALTER TABLE chat_messages
    ADD COLUMN IF NOT EXISTS message_type VARCHAR(30) NOT NULL DEFAULT 'text',
    ADD COLUMN IF NOT EXISTS message_metadata TEXT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'chat_messages'::regclass
          AND conname = 'chat_messages_message_type_check'
    ) THEN
        ALTER TABLE chat_messages
            ADD CONSTRAINT chat_messages_message_type_check
            CHECK (message_type IN ('text', 'media', 'product_cards'));
    END IF;
END $$;
