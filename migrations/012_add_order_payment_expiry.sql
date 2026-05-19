-- PostgreSQL migration: add payment expiry.
ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS payment_expires_at TIMESTAMP NULL;

CREATE INDEX IF NOT EXISTS orders_idx_payment_expires_at ON orders (payment_expires_at);

UPDATE orders
SET payment_expires_at = created_at + INTERVAL '24 hours'
WHERE status = 'pending_payment'
  AND payment_method IN ('vnpay', 'momo')
  AND payment_status <> 'paid'
  AND payment_expires_at IS NULL;
