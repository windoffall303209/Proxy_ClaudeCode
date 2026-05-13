-- File migrations/006_snapshot_order_shipping_address.sql
-- PostgreSQL version.

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS shipping_name VARCHAR(255) NULL,
    ADD COLUMN IF NOT EXISTS shipping_phone VARCHAR(20) NULL,
    ADD COLUMN IF NOT EXISTS shipping_address_line VARCHAR(500) NULL,
    ADD COLUMN IF NOT EXISTS shipping_ward VARCHAR(255) NULL,
    ADD COLUMN IF NOT EXISTS shipping_district VARCHAR(255) NULL,
    ADD COLUMN IF NOT EXISTS shipping_city VARCHAR(255) NULL;

UPDATE orders o
SET
    shipping_name = COALESCE(o.shipping_name, a.full_name, 'Khach hang'),
    shipping_phone = COALESCE(o.shipping_phone, a.phone),
    shipping_address_line = COALESCE(o.shipping_address_line, a.address_line, 'Chua cap nhat'),
    shipping_ward = COALESCE(o.shipping_ward, a.ward),
    shipping_district = COALESCE(o.shipping_district, a.district),
    shipping_city = COALESCE(o.shipping_city, a.city, 'Chua cap nhat')
FROM addresses a
WHERE a.id = o.address_id
  AND (
      o.shipping_name IS NULL
      OR o.shipping_phone IS NULL
      OR o.shipping_address_line IS NULL
      OR o.shipping_city IS NULL
  );

UPDATE orders
SET
    shipping_name = COALESCE(shipping_name, 'Khach hang'),
    shipping_address_line = COALESCE(shipping_address_line, 'Chua cap nhat'),
    shipping_city = COALESCE(shipping_city, 'Chua cap nhat')
WHERE shipping_name IS NULL
   OR shipping_address_line IS NULL
   OR shipping_city IS NULL;

DO $$
DECLARE
    fk_name text;
BEGIN
    FOR fk_name IN
        SELECT c.conname
        FROM pg_constraint c
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
        WHERE c.conrelid = 'orders'::regclass
          AND c.contype = 'f'
          AND a.attname = 'address_id'
    LOOP
        EXECUTE format('ALTER TABLE orders DROP CONSTRAINT %I', fk_name);
    END LOOP;
END $$;

ALTER TABLE orders
    ALTER COLUMN address_id DROP NOT NULL,
    ALTER COLUMN shipping_name SET NOT NULL,
    ALTER COLUMN shipping_phone DROP NOT NULL,
    ALTER COLUMN shipping_address_line SET NOT NULL,
    ALTER COLUMN shipping_ward DROP NOT NULL,
    ALTER COLUMN shipping_district DROP NOT NULL,
    ALTER COLUMN shipping_city SET NOT NULL;

ALTER TABLE orders
    ADD CONSTRAINT fk_orders_address_id
    FOREIGN KEY (address_id) REFERENCES addresses(id) ON DELETE SET NULL;
