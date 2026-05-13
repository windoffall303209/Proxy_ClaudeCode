-- PostgreSQL version.

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS payment_expires_at TIMESTAMP NULL;

CREATE INDEX IF NOT EXISTS idx_orders_payment_expires_at ON orders(payment_expires_at);

UPDATE orders
SET payment_expires_at = created_at + INTERVAL '24 HOUR'
WHERE status = 'pending_payment'
  AND payment_method IN ('vnpay', 'momo')
  AND payment_status <> 'paid'
  AND payment_expires_at IS NULL;
