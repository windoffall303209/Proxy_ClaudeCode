-- PostgreSQL migration: snapshot order shipping address.
ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS shipping_name VARCHAR(255) NULL,
    ADD COLUMN IF NOT EXISTS shipping_phone VARCHAR(20) NULL,
    ADD COLUMN IF NOT EXISTS shipping_address_line VARCHAR(500) NULL,
    ADD COLUMN IF NOT EXISTS shipping_ward VARCHAR(255) NULL,
    ADD COLUMN IF NOT EXISTS shipping_district VARCHAR(255) NULL,
    ADD COLUMN IF NOT EXISTS shipping_city VARCHAR(255) NULL;

UPDATE orders o
SET
    shipping_name = COALESCE(o.shipping_name, a.full_name),
    shipping_phone = COALESCE(o.shipping_phone, a.phone),
    shipping_address_line = COALESCE(o.shipping_address_line, a.address_line),
    shipping_ward = COALESCE(o.shipping_ward, a.ward),
    shipping_district = COALESCE(o.shipping_district, a.district),
    shipping_city = COALESCE(o.shipping_city, a.city)
FROM addresses a
WHERE a.id = o.address_id
  AND (
    o.shipping_name IS NULL
    OR o.shipping_phone IS NULL
    OR o.shipping_address_line IS NULL
    OR o.shipping_city IS NULL
  );

ALTER TABLE orders
    ALTER COLUMN address_id DROP NOT NULL,
    ALTER COLUMN shipping_name SET NOT NULL,
    ALTER COLUMN shipping_phone DROP NOT NULL,
    ALTER COLUMN shipping_address_line SET NOT NULL,
    ALTER COLUMN shipping_ward DROP NOT NULL,
    ALTER COLUMN shipping_district DROP NOT NULL,
    ALTER COLUMN shipping_city SET NOT NULL;

DO $$
DECLARE constraint_name text;
BEGIN
    SELECT tc.constraint_name INTO constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'orders'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'address_id'
    LIMIT 1;

    IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE orders DROP CONSTRAINT %I', constraint_name);
    END IF;
END $$;

ALTER TABLE orders
    ADD CONSTRAINT fk_orders_address_id
    FOREIGN KEY (address_id) REFERENCES addresses(id) ON DELETE SET NULL;
