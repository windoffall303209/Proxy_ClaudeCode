-- PostgreSQL version.

INSERT INTO storefront_settings (setting_key, setting_value, value_type)
VALUES
    ('jwt_expire_minutes', '60', 'int'),
    ('payment_window_hours', '24', 'int'),
    ('default_web_email', 'nvuthanh4@gmail.com', 'string')
ON CONFLICT (setting_key) DO UPDATE SET
    setting_value = EXCLUDED.setting_value,
    value_type = EXCLUDED.value_type,
    updated_at = CURRENT_TIMESTAMP;
