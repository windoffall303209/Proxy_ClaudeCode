-- File migrations/003_create_voucher_products.sql
-- PostgreSQL version.

CREATE TABLE IF NOT EXISTS voucher_products (
    voucher_id INTEGER NOT NULL REFERENCES vouchers(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (voucher_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_voucher_products_product ON voucher_products(product_id);
