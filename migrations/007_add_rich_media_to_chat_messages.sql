-- Migration: add rich content support to chat messages
-- Run manually:
-- mysql -u root -p tmdt_ecommerce < migrations/007_add_rich_media_to_chat_messages.sql

ALTER TABLE chat_messages
    ADD COLUMN message_type ENUM('text', 'media', 'product_cards') NOT NULL DEFAULT 'text' AFTER message,
    ADD COLUMN message_metadata LONGTEXT NULL AFTER message_type;
