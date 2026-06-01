-- Soft-delete tài khoản người dùng với cửa sổ khôi phục 14 ngày.
ALTER TABLE users
    ADD COLUMN account_deleted_at DATETIME DEFAULT NULL AFTER is_active,
    ADD COLUMN account_delete_expires_at DATETIME DEFAULT NULL AFTER account_deleted_at,
    ADD INDEX idx_account_delete_expires_at (account_delete_expires_at);
