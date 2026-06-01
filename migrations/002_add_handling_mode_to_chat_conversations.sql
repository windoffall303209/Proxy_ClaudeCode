-- File migrations/002_add_handling_mode_to_chat_conversations.sql: dinh nghia thay doi hoac cau truc du lieu cho he thong.
ALTER TABLE chat_conversations
ADD COLUMN handling_mode ENUM('ai', 'manual') NOT NULL DEFAULT 'ai' AFTER status;
