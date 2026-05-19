-- PostgreSQL migration: create storefront settings.
CREATE TABLE IF NOT EXISTS storefront_settings (
    id SERIAL PRIMARY KEY,
    setting_key VARCHAR(100) NOT NULL UNIQUE,
    setting_value TEXT NOT NULL,
    value_type VARCHAR(50) NOT NULL DEFAULT 'int' CHECK (value_type IN ('int', 'string', 'boolean', 'json')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS storefront_settings_idx_key ON storefront_settings (setting_key);

INSERT INTO storefront_settings (setting_key, setting_value, value_type)
VALUES
    ('product_grid_columns', '5', 'int'),
    ('home_category_showcase_count', '3', 'int')
ON CONFLICT (setting_key) DO UPDATE SET
    setting_value = EXCLUDED.setting_value,
    value_type = EXCLUDED.value_type;
