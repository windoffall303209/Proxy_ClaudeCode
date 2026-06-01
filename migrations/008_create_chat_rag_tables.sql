-- Migration: create chat RAG storage tables
-- Run manually:
-- mysql -u root -p tmdt_ecommerce < migrations/008_create_chat_rag_tables.sql

CREATE TABLE IF NOT EXISTS chat_rag_chunks (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    source_type ENUM('product', 'knowledge') NOT NULL,
    source_key VARCHAR(255) NOT NULL,
    source_id INT NULL,
    chunk_key VARCHAR(100) NOT NULL DEFAULT 'base',
    title VARCHAR(255) NOT NULL,
    content MEDIUMTEXT NOT NULL,
    metadata LONGTEXT NULL,
    embedding_model VARCHAR(255) NOT NULL,
    embedding_vector LONGTEXT NOT NULL,
    token_count INT NOT NULL DEFAULT 0,
    content_hash CHAR(64) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_chat_rag_chunk (source_type, source_key, chunk_key),
    KEY idx_chat_rag_source_type (source_type),
    KEY idx_chat_rag_source_id (source_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS chat_rag_sync_state (
    source_type VARCHAR(50) PRIMARY KEY,
    source_count INT NOT NULL DEFAULT 0,
    status ENUM('idle', 'syncing', 'error') NOT NULL DEFAULT 'idle',
    last_synced_at DATETIME NULL,
    detail TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
