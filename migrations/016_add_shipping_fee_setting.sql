INSERT INTO storefront_settings (setting_key, setting_value, value_type, published_at)
VALUES ('shipping_fee_amount', '30000', 'int', CURRENT_TIMESTAMP)
ON DUPLICATE KEY UPDATE
    value_type = VALUES(value_type);
