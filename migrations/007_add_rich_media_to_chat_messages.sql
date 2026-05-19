-- PostgreSQL migration: add rich content support to chat messages.
ALTER TABLE chat_messages
    ADD COLUMN IF NOT EXISTS message_type VARCHAR(50) NOT NULL DEFAULT 'text',
    ADD COLUMN IF NOT EXISTS message_metadata TEXT NULL;

ALTER TABLE chat_messages
    DROP CONSTRAINT IF EXISTS chk_chat_messages_message_type;

ALTER TABLE chat_messages
    ADD CONSTRAINT chk_chat_messages_message_type
    CHECK (message_type IN ('text', 'media', 'product_cards'));
