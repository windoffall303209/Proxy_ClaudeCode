-- PostgreSQL migration: add account soft delete window.
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS account_deleted_at TIMESTAMP DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS account_delete_expires_at TIMESTAMP DEFAULT NULL;

CREATE INDEX IF NOT EXISTS users_idx_account_delete_expires_at ON users (account_delete_expires_at);
