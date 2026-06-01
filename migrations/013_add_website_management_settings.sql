INSERT INTO storefront_settings (setting_key, setting_value, value_type)
VALUES
    ('jwt_expire_minutes', '60', 'int'),
    ('payment_window_hours', '24', 'int'),
    ('default_web_email', 'nvuthanh4@gmail.com', 'string')
ON DUPLICATE KEY UPDATE
    setting_value = VALUES(setting_value),
    value_type = VALUES(value_type);
