-- File migrations/010_create_storefront_settings.sql: định nghĩa thay đổi hoặc cấu trúc dữ liệu cho hệ thống.
CREATE TABLE IF NOT EXISTS storefront_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    setting_key VARCHAR(100) NOT NULL UNIQUE,
    setting_value VARCHAR(255) NOT NULL,
    value_type ENUM('int', 'string', 'boolean', 'json') NOT NULL DEFAULT 'int',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_storefront_settings_key (setting_key)
) ENGINE=InnoDB;

INSERT INTO storefront_settings (setting_key, setting_value, value_type)
VALUES
    ('product_grid_columns', '5', 'int'),
    ('home_category_showcase_count', '3', 'int')
ON DUPLICATE KEY UPDATE
    setting_value = VALUES(setting_value),
    value_type = VALUES(value_type);
