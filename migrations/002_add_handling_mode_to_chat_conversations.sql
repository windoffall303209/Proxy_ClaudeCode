ALTER TABLE chat_conversations
ADD COLUMN handling_mode ENUM('ai', 'manual') NOT NULL DEFAULT 'ai' AFTER status;
