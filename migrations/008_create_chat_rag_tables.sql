-- PostgreSQL migration: create chat RAG storage tables.
CREATE TABLE IF NOT EXISTS chat_rag_chunks (
    id BIGSERIAL PRIMARY KEY,
    source_type VARCHAR(50) NOT NULL CHECK (source_type IN ('product', 'knowledge')),
    source_key VARCHAR(255) NOT NULL,
    source_id INT NULL,
    chunk_key VARCHAR(100) NOT NULL DEFAULT 'base',
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    metadata TEXT NULL,
    embedding_model VARCHAR(255) NOT NULL,
    embedding_vector TEXT NOT NULL,
    token_count INT NOT NULL DEFAULT 0,
    content_hash CHAR(64) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uniq_chat_rag_chunk UNIQUE (source_type, source_key, chunk_key)
);

CREATE INDEX IF NOT EXISTS chat_rag_chunks_idx_source_type ON chat_rag_chunks (source_type);
CREATE INDEX IF NOT EXISTS chat_rag_chunks_idx_source_id ON chat_rag_chunks (source_id);

CREATE TABLE IF NOT EXISTS chat_rag_sync_state (
    source_type VARCHAR(50) PRIMARY KEY,
    source_count INT NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'idle' CHECK (status IN ('idle', 'syncing', 'error')),
    last_synced_at TIMESTAMP NULL,
    detail TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
