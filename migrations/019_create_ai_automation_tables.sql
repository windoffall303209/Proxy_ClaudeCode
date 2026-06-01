CREATE TABLE IF NOT EXISTS user_product_events (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    session_id VARCHAR(255) NULL,
    product_id INT NOT NULL,
    event_type ENUM('view', 'add_cart', 'checkout', 'purchase', 'review') NOT NULL,
    weight DECIMAL(8, 2) NOT NULL DEFAULT 1,
    metadata LONGTEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    INDEX idx_upe_user_time (user_id, created_at),
    INDEX idx_upe_session_time (session_id, created_at),
    INDEX idx_upe_product_type (product_id, event_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_recommendation_profiles (
    user_id INT PRIMARY KEY,
    profile_json LONGTEXT NOT NULL,
    source_hash CHAR(64) NOT NULL DEFAULT '',
    refreshed_at DATETIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS review_ai_insights (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    review_id INT NOT NULL,
    sentiment ENUM('positive', 'neutral', 'negative') NOT NULL DEFAULT 'neutral',
    topics LONGTEXT NULL,
    summary TEXT NULL,
    issue_flags LONGTEXT NULL,
    confidence DECIMAL(4, 3) NOT NULL DEFAULT 0,
    model VARCHAR(128) NULL,
    analyzed_at DATETIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_review_ai_insight (review_id),
    FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE,
    INDEX idx_review_ai_sentiment (sentiment),
    INDEX idx_review_ai_analyzed_at (analyzed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inventory_forecasts (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    variant_id INT NULL,
    current_stock INT NOT NULL DEFAULT 0,
    avg_daily_sales_7d DECIMAL(10, 3) NOT NULL DEFAULT 0,
    avg_daily_sales_30d DECIMAL(10, 3) NOT NULL DEFAULT 0,
    days_until_stockout DECIMAL(10, 2) NULL,
    risk_level ENUM('out', 'high', 'medium', 'low', 'slow') NOT NULL DEFAULT 'low',
    suggested_restock_qty INT NOT NULL DEFAULT 0,
    ai_summary TEXT NULL,
    calculated_at DATETIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_inventory_forecast_product (product_id),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE CASCADE,
    INDEX idx_inventory_risk (risk_level, calculated_at),
    INDEX idx_inventory_product (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS order_risk_assessments (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    risk_score INT NOT NULL DEFAULT 0,
    risk_level ENUM('low', 'medium', 'high') NOT NULL DEFAULT 'low',
    reasons LONGTEXT NULL,
    ai_summary TEXT NULL,
    recommended_action TEXT NULL,
    model VARCHAR(128) NULL,
    reviewed_by INT NULL,
    reviewed_at DATETIME NULL,
    assessed_at DATETIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_order_risk (order_id),
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_order_risk_level (risk_level, assessed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS marketing_campaign_drafts (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    source_type ENUM('sale', 'voucher', 'product', 'manual') NOT NULL,
    source_id INT NULL,
    segment VARCHAR(100) NOT NULL DEFAULT 'newsletter',
    subject VARCHAR(255) NOT NULL,
    preview_text VARCHAR(255) NULL,
    email_html MEDIUMTEXT NOT NULL,
    sms_text VARCHAR(500) NULL,
    banner_copy VARCHAR(255) NULL,
    status ENUM('draft', 'approved', 'sent') NOT NULL DEFAULT 'draft',
    model VARCHAR(128) NULL,
    created_by INT NULL,
    approved_by INT NULL,
    sent_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_marketing_draft_source (source_type, source_id),
    INDEX idx_marketing_draft_status (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
