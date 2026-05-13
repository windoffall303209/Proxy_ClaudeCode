ALTER TABLE orders
    ADD COLUMN payment_expires_at DATETIME NULL AFTER payment_status,
    ADD INDEX idx_payment_expires_at (payment_expires_at);

UPDATE orders
SET payment_expires_at = DATE_ADD(created_at, INTERVAL 24 HOUR)
WHERE status = 'pending_payment'
  AND payment_method IN ('vnpay', 'momo')
  AND payment_status <> 'paid'
  AND payment_expires_at IS NULL;
