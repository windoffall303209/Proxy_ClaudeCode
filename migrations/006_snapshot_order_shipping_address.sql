ALTER TABLE orders
    ADD COLUMN shipping_name VARCHAR(255) NULL AFTER address_id,
    ADD COLUMN shipping_phone VARCHAR(20) NULL AFTER shipping_name,
    ADD COLUMN shipping_address_line VARCHAR(500) NULL AFTER shipping_phone,
    ADD COLUMN shipping_ward VARCHAR(255) NULL AFTER shipping_address_line,
    ADD COLUMN shipping_district VARCHAR(255) NULL AFTER shipping_ward,
    ADD COLUMN shipping_city VARCHAR(255) NULL AFTER shipping_district;

UPDATE orders o
LEFT JOIN addresses a ON a.id = o.address_id
SET
    o.shipping_name = COALESCE(o.shipping_name, a.full_name),
    o.shipping_phone = COALESCE(o.shipping_phone, a.phone),
    o.shipping_address_line = COALESCE(o.shipping_address_line, a.address_line),
    o.shipping_ward = COALESCE(o.shipping_ward, a.ward),
    o.shipping_district = COALESCE(o.shipping_district, a.district),
    o.shipping_city = COALESCE(o.shipping_city, a.city)
WHERE
    o.shipping_name IS NULL
    OR o.shipping_phone IS NULL
    OR o.shipping_address_line IS NULL
    OR o.shipping_city IS NULL;

SET @orders_address_fk = (
    SELECT CONSTRAINT_NAME
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'orders'
      AND COLUMN_NAME = 'address_id'
      AND REFERENCED_TABLE_NAME = 'addresses'
    LIMIT 1
);

SET @drop_orders_address_fk_sql = IF(
    @orders_address_fk IS NULL,
    'SELECT 1',
    CONCAT('ALTER TABLE orders DROP FOREIGN KEY ', @orders_address_fk)
);

PREPARE orders_fk_stmt FROM @drop_orders_address_fk_sql;
EXECUTE orders_fk_stmt;
DEALLOCATE PREPARE orders_fk_stmt;

ALTER TABLE orders
    MODIFY address_id INT NULL,
    MODIFY shipping_name VARCHAR(255) NOT NULL,
    MODIFY shipping_phone VARCHAR(20) NULL,
    MODIFY shipping_address_line VARCHAR(500) NOT NULL,
    MODIFY shipping_ward VARCHAR(255) NULL,
    MODIFY shipping_district VARCHAR(255) NULL,
    MODIFY shipping_city VARCHAR(255) NOT NULL;

ALTER TABLE orders
    ADD CONSTRAINT fk_orders_address_id
    FOREIGN KEY (address_id) REFERENCES addresses(id) ON DELETE SET NULL;
