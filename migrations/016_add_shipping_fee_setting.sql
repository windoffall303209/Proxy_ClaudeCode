-- PostgreSQL version.

INSERT INTO storefront_settings (setting_key, setting_value, value_type, published_at)
VALUES ('shipping_fee_amount', '30000', 'int', CURRENT_TIMESTAMP)
ON CONFLICT (setting_key) DO UPDATE SET
    value_type = EXCLUDED.value_type,
    published_at = COALESCE(storefront_settings.published_at, EXCLUDED.published_at),
    updated_at = CURRENT_TIMESTAMP;
