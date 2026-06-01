-- =============================================================================
-- WIND OF FALL - E-commerce Database Schema
-- =============================================================================
-- Complete database schema including all tables and features
-- Version: 2.1 (Consolidated through migrations/019)
-- =============================================================================

-- Drop database if exists and create fresh
DROP DATABASE IF EXISTS tmdt_ecommerce;
CREATE DATABASE tmdt_ecommerce CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE tmdt_ecommerce;

-- =============================================================================
-- USERS TABLE
-- =============================================================================
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    avatar_url VARCHAR(500) DEFAULT NULL,
    birthday DATE DEFAULT NULL,
    role ENUM('customer', 'admin') DEFAULT 'customer',
    -- Email verification
    email_verified BOOLEAN DEFAULT FALSE,
    email_verified_at DATETIME DEFAULT NULL,
    verification_code VARCHAR(6) DEFAULT NULL,
    verification_expires DATETIME DEFAULT NULL,
    -- Phone verification
    phone_verified BOOLEAN DEFAULT FALSE,
    -- Password reset
    reset_code VARCHAR(6) DEFAULT NULL,
    reset_code_expires DATETIME DEFAULT NULL,
    -- Marketing
    marketing_consent BOOLEAN DEFAULT FALSE,
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    account_deleted_at DATETIME DEFAULT NULL,
    account_delete_expires_at DATETIME DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_role (role),
    INDEX idx_verification_code (verification_code),
    INDEX idx_reset_code (reset_code),
    INDEX idx_account_delete_expires_at (account_delete_expires_at)
) ENGINE=InnoDB;

-- =============================================================================
-- CATEGORIES TABLE
-- =============================================================================
CREATE TABLE categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    parent_id INT NULL,
    image_url VARCHAR(500),
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL,
    INDEX idx_slug (slug),
    INDEX idx_parent (parent_id)
) ENGINE=InnoDB;

-- =============================================================================
-- SALES TABLE
-- =============================================================================
CREATE TABLE sales (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type ENUM('percentage', 'fixed', 'bogo') NOT NULL,
    value DECIMAL(10, 2) NOT NULL,
    start_date DATETIME NOT NULL,
    end_date DATETIME NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_active_dates (is_active, start_date, end_date)
) ENGINE=InnoDB;

-- =============================================================================
-- PRODUCTS TABLE
-- =============================================================================
CREATE TABLE products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    category_id INT NOT NULL,
    sale_id INT NULL,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    stock_quantity INT DEFAULT 0,
    sku VARCHAR(100) UNIQUE,
    is_active BOOLEAN DEFAULT TRUE,
    is_featured BOOLEAN DEFAULT FALSE,
    view_count INT DEFAULT 0,
    sold_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
    FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE SET NULL,
    INDEX idx_category (category_id),
    INDEX idx_slug (slug),
    INDEX idx_active (is_active),
    INDEX idx_featured (is_featured)
) ENGINE=InnoDB;

-- =============================================================================
-- PRODUCT IMAGES TABLE
-- =============================================================================
CREATE TABLE product_images (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    image_url VARCHAR(500) NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE,
    display_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    INDEX idx_product (product_id)
) ENGINE=InnoDB;

-- =============================================================================
-- PRODUCT VARIANTS TABLE (sizes, colors)
-- =============================================================================
CREATE TABLE product_variants (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    image_id INT NULL,
    size VARCHAR(50),
    color VARCHAR(50),
    additional_price DECIMAL(10, 2) DEFAULT 0,
    stock_quantity INT DEFAULT 0,
    sku VARCHAR(100) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (image_id) REFERENCES product_images(id) ON DELETE SET NULL,
    INDEX idx_product (product_id),
    INDEX idx_variant_image (image_id)
) ENGINE=InnoDB;

-- =============================================================================
-- VOUCHERS TABLE
-- =============================================================================
CREATE TABLE vouchers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type ENUM('percentage', 'fixed') NOT NULL DEFAULT 'percentage',
    value DECIMAL(10, 2) NOT NULL,
    min_order_amount DECIMAL(10, 2) DEFAULT 0,
    max_discount_amount DECIMAL(10, 2) NULL,
    usage_limit INT DEFAULT NULL,
    used_count INT DEFAULT 0,
    user_limit INT DEFAULT 1,
    start_date DATETIME NOT NULL,
    end_date DATETIME NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_code (code),
    INDEX idx_active_dates (is_active, start_date, end_date)
) ENGINE=InnoDB;

-- =============================================================================
-- VOUCHER PRODUCTS TABLE
-- =============================================================================
CREATE TABLE voucher_products (
    voucher_id INT NOT NULL,
    product_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (voucher_id, product_id),
    FOREIGN KEY (voucher_id) REFERENCES vouchers(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    INDEX idx_voucher_products_product (product_id)
) ENGINE=InnoDB;

-- =============================================================================
-- CART TABLE (persistent shopping cart)
-- =============================================================================
CREATE TABLE cart (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    session_id VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user (user_id),
    INDEX idx_session (session_id)
) ENGINE=InnoDB;

-- =============================================================================
-- CART ITEMS TABLE
-- =============================================================================
CREATE TABLE cart_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cart_id INT NOT NULL,
    product_id INT NOT NULL,
    variant_id INT NULL,
    quantity INT NOT NULL DEFAULT 1,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cart_id) REFERENCES cart(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE SET NULL,
    INDEX idx_cart (cart_id),
    INDEX idx_product (product_id)
) ENGINE=InnoDB;

-- =============================================================================
-- ADDRESSES TABLE
-- =============================================================================
CREATE TABLE addresses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    address_line VARCHAR(500) NOT NULL,
    ward VARCHAR(255),
    district VARCHAR(255),
    city VARCHAR(255) NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user (user_id)
) ENGINE=InnoDB;

-- =============================================================================
-- ORDERS TABLE
-- =============================================================================
CREATE TABLE orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    address_id INT NULL,
    shipping_name VARCHAR(255) NOT NULL,
    shipping_phone VARCHAR(20),
    shipping_address_line VARCHAR(500) NOT NULL,
    shipping_ward VARCHAR(255),
    shipping_district VARCHAR(255),
    shipping_city VARCHAR(255) NOT NULL,
    voucher_id INT NULL,
    order_code VARCHAR(50) UNIQUE NOT NULL,
    total_amount DECIMAL(10, 2) NOT NULL,
    discount_amount DECIMAL(10, 2) DEFAULT 0,
    shipping_fee DECIMAL(10, 2) DEFAULT 0,
    final_amount DECIMAL(10, 2) NOT NULL,
    status ENUM('pending_payment', 'pending', 'confirmed', 'processing', 'shipping', 'delivered', 'completed', 'cancelled') DEFAULT 'pending',
    payment_method ENUM('cod', 'vnpay', 'momo') NOT NULL,
    payment_status ENUM('unpaid', 'paid', 'refunded') DEFAULT 'unpaid',
    payment_expires_at DATETIME NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (address_id) REFERENCES addresses(id) ON DELETE SET NULL,
    FOREIGN KEY (voucher_id) REFERENCES vouchers(id) ON DELETE SET NULL,
    INDEX idx_user (user_id),
    INDEX idx_order_code (order_code),
    INDEX idx_status (status),
    INDEX idx_payment_expires_at (payment_expires_at)
) ENGINE=InnoDB;

-- =============================================================================
-- ORDER ITEMS TABLE
-- =============================================================================
CREATE TABLE order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    product_id INT NOT NULL,
    variant_id INT NULL,
    product_name VARCHAR(255) NOT NULL,
    product_image VARCHAR(500),
    price DECIMAL(10, 2) NOT NULL,
    sale_applied DECIMAL(10, 2) DEFAULT 0,
    quantity INT NOT NULL,
    subtotal DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE SET NULL,
    INDEX idx_order (order_id)
) ENGINE=InnoDB;

-- =============================================================================
-- VOUCHER USAGE TABLE
-- =============================================================================
CREATE TABLE voucher_usage (
    id INT AUTO_INCREMENT PRIMARY KEY,
    voucher_id INT NOT NULL,
    user_id INT NOT NULL,
    order_id INT NOT NULL,
    discount_amount DECIMAL(10, 2) NOT NULL,
    used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (voucher_id) REFERENCES vouchers(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    INDEX idx_voucher (voucher_id),
    INDEX idx_user (user_id)
) ENGINE=InnoDB;

-- =============================================================================
-- PAYMENTS TABLE
-- =============================================================================
CREATE TABLE payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    payment_method ENUM('cod', 'vnpay', 'momo') NOT NULL,
    transaction_id VARCHAR(255) UNIQUE,
    amount DECIMAL(10, 2) NOT NULL,
    status ENUM('pending', 'success', 'failed', 'refunded') DEFAULT 'pending',
    payment_data TEXT,
    processed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    INDEX idx_order (order_id),
    INDEX idx_transaction (transaction_id)
) ENGINE=InnoDB;

-- =============================================================================
-- SHIPMENTS TABLE
-- =============================================================================
CREATE TABLE shipments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    carrier VARCHAR(100) NULL,
    tracking_code VARCHAR(100) NULL,
    tracking_url VARCHAR(500) NULL,
    current_status ENUM('pending_payment', 'pending', 'confirmed', 'processing', 'shipping', 'delivered', 'completed', 'cancelled') DEFAULT 'pending',
    current_location_text VARCHAR(255) NULL,
    current_lat DECIMAL(10, 7) NULL,
    current_lng DECIMAL(10, 7) NULL,
    estimated_delivery_at DATETIME NULL,
    last_event_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    UNIQUE KEY uq_shipments_order (order_id),
    INDEX idx_tracking_code (tracking_code),
    INDEX idx_shipments_status (current_status)
) ENGINE=InnoDB;

-- =============================================================================
-- ORDER TRACKING EVENTS TABLE
-- =============================================================================
CREATE TABLE order_tracking_events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    shipment_id INT NULL,
    status ENUM('pending_payment', 'pending', 'confirmed', 'processing', 'shipping', 'delivered', 'completed', 'cancelled') NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NULL,
    location_text VARCHAR(255) NULL,
    lat DECIMAL(10, 7) NULL,
    lng DECIMAL(10, 7) NULL,
    event_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    source ENUM('system', 'admin', 'carrier', 'user') DEFAULT 'system',
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (shipment_id) REFERENCES shipments(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_tracking_order (order_id),
    INDEX idx_tracking_shipment (shipment_id),
    INDEX idx_tracking_event_time (event_time)
) ENGINE=InnoDB;

-- =============================================================================
-- ORDER RETURN REQUESTS TABLE
-- =============================================================================
CREATE TABLE order_return_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    user_id INT NOT NULL,
    reason TEXT NOT NULL,
    status ENUM('pending', 'approved', 'rejected', 'resolved') DEFAULT 'pending',
    admin_note TEXT NULL,
    reviewed_by INT NULL,
    reviewed_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_return_order (order_id),
    INDEX idx_return_user (user_id),
    INDEX idx_return_status (status)
) ENGINE=InnoDB;

CREATE TABLE order_return_media (
    id INT AUTO_INCREMENT PRIMARY KEY,
    return_request_id INT NOT NULL,
    media_type ENUM('image', 'video') NOT NULL,
    media_url VARCHAR(500) NOT NULL,
    public_id VARCHAR(255) NULL,
    display_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (return_request_id) REFERENCES order_return_requests(id) ON DELETE CASCADE,
    INDEX idx_return_media_request (return_request_id)
) ENGINE=InnoDB;

-- =============================================================================
-- BANNERS TABLE
-- =============================================================================
CREATE TABLE banners (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    subtitle VARCHAR(255),
    description TEXT,
    image_url VARCHAR(500) NOT NULL,
    link_url VARCHAR(500),
    button_text VARCHAR(100),
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    start_date DATETIME NULL,
    end_date DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_active (is_active, display_order)
) ENGINE=InnoDB;

-- =============================================================================
-- STOREFRONT SETTINGS TABLE
-- =============================================================================
CREATE TABLE storefront_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    setting_key VARCHAR(100) NOT NULL UNIQUE,
    setting_value TEXT NOT NULL,
    draft_value TEXT NULL,
    value_type ENUM('int', 'string', 'boolean', 'json', 'color', 'url', 'image', 'select') NOT NULL DEFAULT 'string',
    updated_by INT NULL,
    published_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_storefront_settings_key (setting_key)
) ENGINE=InnoDB;

-- =============================================================================
-- API KEY SETTINGS TABLE
-- =============================================================================
CREATE TABLE api_key_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    provider VARCHAR(50) NOT NULL,
    key_name VARCHAR(100) NOT NULL,
    encrypted_value TEXT NULL,
    masked_value VARCHAR(80) NOT NULL DEFAULT '',
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    notes VARCHAR(255) NULL,
    updated_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_api_key_provider_name (provider, key_name),
    INDEX idx_api_key_settings_active (provider, key_name, is_active)
) ENGINE=InnoDB;

INSERT INTO storefront_settings (setting_key, setting_value, value_type, published_at)
VALUES
    ('site_name', 'WIND OF FALL', 'string', CURRENT_TIMESTAMP),
    ('site_tagline', 'Thời trang mặc đẹp mỗi ngày', 'string', CURRENT_TIMESTAMP),
    ('brand_initials', 'WF', 'string', CURRENT_TIMESTAMP),
    ('brand_alt_text', 'WIND OF FALL', 'string', CURRENT_TIMESTAMP),
    ('logo_url', '/favicon.png', 'image', CURRENT_TIMESTAMP),
    ('admin_logo_url', '/favicon.png', 'image', CURRENT_TIMESTAMP),
    ('favicon_url', '/favicon.png', 'image', CURRENT_TIMESTAMP),
    ('brand_font_family', '''Be Vietnam Pro'', sans-serif', 'select', CURRENT_TIMESTAMP),
    ('brand_name_font_size', '18', 'int', CURRENT_TIMESTAMP),
    ('site_font_family', '''Be Vietnam Pro'', sans-serif', 'select', CURRENT_TIMESTAMP),
    ('primary_color', '#f2c94c', 'color', CURRENT_TIMESTAMP),
    ('secondary_color', '#d8a617', 'color', CURRENT_TIMESTAMP),
    ('background_color', '#fcfaf4', 'color', CURRENT_TIMESTAMP),
    ('text_color', '#18140d', 'color', CURRENT_TIMESTAMP),
    ('card_radius', '20', 'int', CURRENT_TIMESTAMP),
    ('button_radius', '999', 'int', CURRENT_TIMESTAMP),
    ('product_grid_columns', '5', 'int', CURRENT_TIMESTAMP),
    ('home_category_showcase_count', '3', 'int', CURRENT_TIMESTAMP),
    ('search_placeholder', 'Tìm áo polo, váy midi, quần jean...', 'string', CURRENT_TIMESTAMP),
    ('mobile_search_placeholder', 'Tìm sản phẩm yêu thích...', 'string', CURRENT_TIMESTAMP),
    ('home_link_label', 'Trang chủ', 'string', CURRENT_TIMESTAMP),
    ('all_products_label', 'Tất cả', 'string', CURRENT_TIMESTAMP),
    ('sale_link_label', 'Sale tới 50%', 'string', CURRENT_TIMESTAMP),
    ('for_you_link_label', 'For You', 'string', CURRENT_TIMESTAMP),
    ('show_all_products_link', 'true', 'boolean', CURRENT_TIMESTAMP),
    ('show_sale_link', 'true', 'boolean', CURRENT_TIMESTAMP),
    ('show_for_you_link', 'true', 'boolean', CURRENT_TIMESTAMP),
    ('mobile_menu_eyebrow', 'WIND OF FALL', 'string', CURRENT_TIMESTAMP),
    ('mobile_menu_slogan', 'Tìm outfit cho cả gia đình', 'string', CURRENT_TIMESTAMP),
    ('mobile_support_text', 'Hỗ trợ tư vấn set đồ 1:1 qua hotline 1900 123 456', 'string', CURRENT_TIMESTAMP),
    ('hero_eyebrow', 'Bộ sưu tập mới / mặc đẹp mỗi ngày', 'string', CURRENT_TIMESTAMP),
    ('hero_title', 'Chọn nhanh outfit đẹp cho nam, nữ và trẻ em.', 'string', CURRENT_TIMESTAMP),
    ('hero_copy', 'Áo polo, sơ mi, váy, jeans và nhiều mẫu dễ mặc đã sẵn sàng để bạn mua ngay.', 'string', CURRENT_TIMESTAMP),
    ('hero_primary_label', 'Mua bộ sưu tập mới', 'string', CURRENT_TIMESTAMP),
    ('hero_primary_url', '/products', 'url', CURRENT_TIMESTAMP),
    ('hero_secondary_label', 'Xem khu sale', 'string', CURRENT_TIMESTAMP),
    ('hero_secondary_url', '/products?sale=true', 'url', CURRENT_TIMESTAMP),
    ('hero_stat_1_value', 'Từ 499K', 'string', CURRENT_TIMESTAMP),
    ('hero_stat_1_label', 'Freeship toàn quốc', 'string', CURRENT_TIMESTAMP),
    ('hero_stat_2_value', '30 ngày', 'string', CURRENT_TIMESTAMP),
    ('hero_stat_2_label', 'Đổi trả linh hoạt', 'string', CURRENT_TIMESTAMP),
    ('hero_stat_3_value', '24/7', 'string', CURRENT_TIMESTAMP),
    ('hero_stat_3_label', 'Hỗ trợ online', 'string', CURRENT_TIMESTAMP),
    ('show_home_categories', 'true', 'boolean', CURRENT_TIMESTAMP),
    ('show_home_new_products', 'true', 'boolean', CURRENT_TIMESTAMP),
    ('show_home_editorial', 'true', 'boolean', CURRENT_TIMESTAMP),
    ('show_home_best_sellers', 'true', 'boolean', CURRENT_TIMESTAMP),
    ('show_home_services', 'true', 'boolean', CURRENT_TIMESTAMP),
    ('home_new_products_limit', '10', 'int', CURRENT_TIMESTAMP),
    ('home_best_sellers_limit', '5', 'int', CURRENT_TIMESTAMP),
    ('home_categories_title', 'Mua sắm theo nhu cầu của bạn.', 'string', CURRENT_TIMESTAMP),
    ('home_categories_copy', 'Chọn nhanh theo nam, nữ và trẻ em để tìm đúng sản phẩm bạn cần.', 'string', CURRENT_TIMESTAMP),
    ('home_new_products_title', 'Hàng mới lên kệ hôm nay.', 'string', CURRENT_TIMESTAMP),
    ('home_best_sellers_title', 'Những mẫu được chọn nhiều nhất.', 'string', CURRENT_TIMESTAMP),
    ('home_editorial_title', 'Dễ mặc từ công sở đến cuối tuần.', 'string', CURRENT_TIMESTAMP),
    ('home_editorial_copy', 'Các nhóm sản phẩm được sắp theo những nhu cầu mặc thường ngày để bạn chọn nhanh hơn.', 'string', CURRENT_TIMESTAMP),
    ('popup_enabled', 'true', 'boolean', CURRENT_TIMESTAMP),
    ('popup_frequency_hours', '24', 'int', CURRENT_TIMESTAMP),
    ('popup_fallback_eyebrow', 'WIND OF FALL', 'string', CURRENT_TIMESTAMP),
    ('popup_fallback_button_label', 'Khám phá ngay', 'string', CURRENT_TIMESTAMP),
    ('footer_description', 'Thương hiệu thời trang everyday theo tinh thần hiện đại, gọn gàng và dễ mặc. Chúng tôi ưu tiên chất liệu, phom dáng và trải nghiệm mua sắm mượt mà trên mọi thiết bị.', 'string', CURRENT_TIMESTAMP),
    ('facebook_url', '#', 'url', CURRENT_TIMESTAMP),
    ('instagram_url', '#', 'url', CURRENT_TIMESTAMP),
    ('tiktok_url', '#', 'url', CURRENT_TIMESTAMP),
    ('zalo_url', '', 'url', CURRENT_TIMESTAMP),
    ('contact_hotline', '1900 123 456', 'string', CURRENT_TIMESTAMP),
    ('contact_email', 'info@windoffall.vn', 'string', CURRENT_TIMESTAMP),
    ('contact_address', '123 Nguyễn Huệ, Quận 1, TP.HCM', 'string', CURRENT_TIMESTAMP),
    ('opening_hours', 'Mở cửa 8:00 - 22:00 mỗi ngày', 'string', CURRENT_TIMESTAMP),
    ('copyright_text', '© 2026 WIND OF FALL. All rights reserved.', 'string', CURRENT_TIMESTAMP),
    ('newsletter_eyebrow', 'Newsletter', 'string', CURRENT_TIMESTAMP),
    ('newsletter_title', 'Nhập email để nhận ưu đãi và bộ sưu tập mới sớm hơn', 'string', CURRENT_TIMESTAMP),
    ('newsletter_copy', 'Cập nhật BST mới, voucher độc quyền và gợi ý phối đồ theo mùa.', 'string', CURRENT_TIMESTAMP),
    ('newsletter_button_label', 'Đăng ký ngay', 'string', CURRENT_TIMESTAMP),
    ('newsletter_success_text', 'Bạn đã đăng ký nhận tin khuyến mại thành công.', 'string', CURRENT_TIMESTAMP),
    ('payment_badges', '["COD","VNPay","MoMo","Visa"]', 'json', CURRENT_TIMESTAMP),
    ('service_shipping_title', 'Freeship đơn từ 499K', 'string', CURRENT_TIMESTAMP),
    ('service_shipping_copy', 'Thông tin ưu đãi rõ ràng ngay từ trang đầu để bạn chốt đơn nhanh hơn.', 'string', CURRENT_TIMESTAMP),
    ('service_return_title', 'Đổi trả trong 30 ngày', 'string', CURRENT_TIMESTAMP),
    ('service_return_copy', 'Yên tâm thử size và đổi mẫu nếu chưa thật sự phù hợp.', 'string', CURRENT_TIMESTAMP),
    ('service_consult_title', 'Hỗ trợ qua hotline và chat', 'string', CURRENT_TIMESTAMP),
    ('service_consult_copy', 'Dễ hỏi size, hỏi phối đồ và theo dõi đơn hàng khi cần.', 'string', CURRENT_TIMESTAMP),
    ('service_payment_title', 'Thanh toán rõ ràng', 'string', CURRENT_TIMESTAMP),
    ('service_payment_copy', 'COD, VNPay và MoMo hiển thị sớm để người mua dễ lựa chọn.', 'string', CURRENT_TIMESTAMP),
    ('free_shipping_min_amount', '500000', 'int', CURRENT_TIMESTAMP),
    ('return_window_days', '30', 'int', CURRENT_TIMESTAMP),
    ('policy_links', '[{"label":"Vận chuyển","url":"/policy/shipping"},{"label":"Đổi trả","url":"/policy/return"},{"label":"Thanh toán","url":"/policy/payment"},{"label":"Bảo mật thông tin","url":"/policy/privacy"}]', 'json', CURRENT_TIMESTAMP),
    ('seo_title', 'WIND OF FALL | Thời trang mỗi ngày', 'string', CURRENT_TIMESTAMP),
    ('meta_description', 'WIND OF FALL - mua sắm thời trang everyday cho nam, nữ và trẻ em.', 'string', CURRENT_TIMESTAMP),
    ('meta_keywords', 'thời trang, quần áo, wind of fall', 'string', CURRENT_TIMESTAMP),
    ('og_title', 'WIND OF FALL', 'string', CURRENT_TIMESTAMP),
    ('og_description', 'Thời trang everyday hiện đại, dễ mặc và dễ mua.', 'string', CURRENT_TIMESTAMP),
    ('og_image_url', '/favicon.png', 'image', CURRENT_TIMESTAMP),
    ('robots_index', 'true', 'boolean', CURRENT_TIMESTAMP),
    ('chat_enabled', 'true', 'boolean', CURRENT_TIMESTAMP),
    ('chat_title', 'WIND OF FALL', 'string', CURRENT_TIMESTAMP),
    ('chat_bot_name', 'WIND OF FALL', 'string', CURRENT_TIMESTAMP),
    ('chat_greeting', 'Xin chào! Tôi là trợ lý AI của WIND OF FALL.', 'string', CURRENT_TIMESTAMP),
    ('chat_prompt_text', 'Bạn cần hỗ trợ gì?', 'string', CURRENT_TIMESTAMP),
    ('chat_position', 'right', 'select', CURRENT_TIMESTAMP),
    ('default_web_email', 'nvuthanh4@gmail.com', 'string', CURRENT_TIMESTAMP),
    ('email_sender_name', 'WIND OF FALL', 'string', CURRENT_TIMESTAMP),
    ('support_email', 'support@windoffall.vn', 'string', CURRENT_TIMESTAMP),
    ('email_footer_text', 'Cảm ơn bạn đã đồng hành cùng WIND OF FALL.', 'string', CURRENT_TIMESTAMP),
    ('payment_window_hours', '24', 'int', CURRENT_TIMESTAMP),
    ('shipping_fee_amount', '30000', 'int', CURRENT_TIMESTAMP),
    ('payment_cod_enabled', 'true', 'boolean', CURRENT_TIMESTAMP),
    ('payment_vnpay_enabled', 'true', 'boolean', CURRENT_TIMESTAMP),
    ('payment_momo_enabled', 'true', 'boolean', CURRENT_TIMESTAMP),
    ('payment_reminder_text', 'Đơn hàng online cần thanh toán trong thời hạn quy định để được xử lý.', 'string', CURRENT_TIMESTAMP),
    ('jwt_expire_minutes', '60', 'int', CURRENT_TIMESTAMP),
    ('otp_expire_minutes', '10', 'int', CURRENT_TIMESTAMP),
    ('maintenance_mode', 'false', 'boolean', CURRENT_TIMESTAMP),
    ('maintenance_message', 'Website đang bảo trì, vui lòng quay lại sau.', 'string', CURRENT_TIMESTAMP);

-- =============================================================================
-- REVIEWS TABLE
-- =============================================================================
CREATE TABLE reviews (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    user_id INT NOT NULL,
    order_id INT NOT NULL,
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    is_verified BOOLEAN DEFAULT FALSE,
    is_approved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    INDEX idx_product (product_id),
    INDEX idx_user (user_id)
) ENGINE=InnoDB;

CREATE TABLE review_media (
    id INT AUTO_INCREMENT PRIMARY KEY,
    review_id INT NOT NULL,
    media_type ENUM('image', 'video') NOT NULL,
    media_url VARCHAR(500) NOT NULL,
    public_id VARCHAR(255) NULL,
    display_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE,
    INDEX idx_review_media_review (review_id)
) ENGINE=InnoDB;

-- =============================================================================
-- EMAIL CAMPAIGNS TABLE
-- =============================================================================
CREATE TABLE email_campaigns (
    id INT AUTO_INCREMENT PRIMARY KEY,
    subject VARCHAR(255) NOT NULL,
    template_name VARCHAR(100) NOT NULL,
    content TEXT NOT NULL,
    recipient_count INT DEFAULT 0,
    sent_count INT DEFAULT 0,
    status ENUM('draft', 'scheduled', 'sending', 'sent', 'failed') DEFAULT 'draft',
    scheduled_at DATETIME NULL,
    sent_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_status (status)
) ENGINE=InnoDB;

-- =============================================================================
-- WISHLIST TABLE
-- =============================================================================
CREATE TABLE wishlist (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    product_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    UNIQUE KEY unique_wishlist (user_id, product_id),
    INDEX idx_user (user_id)
) ENGINE=InnoDB;

-- =============================================================================
-- NEWSLETTER SUBSCRIBERS TABLE
-- =============================================================================
CREATE TABLE newsletter_subscribers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    user_id INT DEFAULT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    subscribed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    unsubscribed_at DATETIME DEFAULT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_email (email),
    INDEX idx_user_id (user_id),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB;

-- =============================================================================
-- PASSWORD RESET TOKENS TABLE (Legacy - kept for compatibility)
-- =============================================================================
CREATE TABLE password_reset_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    token VARCHAR(255) NOT NULL,
    expires_at DATETIME NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_token (token),
    INDEX idx_user (user_id)
) ENGINE=InnoDB;

-- =============================================================================
-- EMAIL VERIFICATION TOKENS TABLE (Legacy - kept for compatibility)
-- =============================================================================
CREATE TABLE email_verification_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    token VARCHAR(255) NOT NULL,
    expires_at DATETIME NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_token (token)
) ENGINE=InnoDB;

-- =============================================================================
-- CHAT CONVERSATIONS TABLE
-- =============================================================================
CREATE TABLE chat_conversations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT DEFAULT NULL,
    session_id VARCHAR(255) DEFAULT NULL,
    guest_name VARCHAR(100) DEFAULT 'Khách',
    status ENUM('active', 'closed') DEFAULT 'active',
    handling_mode ENUM('ai', 'manual') DEFAULT 'ai',
    last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_user (user_id),
    INDEX idx_session (session_id),
    INDEX idx_status (status),
    INDEX idx_last_message (last_message_at)
) ENGINE=InnoDB;

-- =============================================================================
-- CHAT MESSAGES TABLE
-- =============================================================================
CREATE TABLE chat_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    conversation_id INT NOT NULL,
    sender_type ENUM('customer', 'admin', 'bot') NOT NULL,
    sender_id INT DEFAULT NULL,
    message TEXT NOT NULL,
    message_type ENUM('text', 'media', 'product_cards') NOT NULL DEFAULT 'text',
    message_metadata LONGTEXT DEFAULT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_conversation (conversation_id),
    INDEX idx_read (is_read),
    INDEX idx_created (created_at)
) ENGINE=InnoDB;

-- =============================================================================
-- CHAT RAG TABLES
-- =============================================================================
CREATE TABLE chat_rag_chunks (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    source_type ENUM('product', 'knowledge') NOT NULL,
    source_key VARCHAR(255) NOT NULL,
    source_id INT NULL,
    chunk_key VARCHAR(100) NOT NULL DEFAULT 'base',
    title VARCHAR(255) NOT NULL,
    content MEDIUMTEXT NOT NULL,
    metadata LONGTEXT DEFAULT NULL,
    embedding_model VARCHAR(255) NOT NULL,
    embedding_vector LONGTEXT NOT NULL,
    token_count INT NOT NULL DEFAULT 0,
    content_hash CHAR(64) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_chat_rag_chunk (source_type, source_key, chunk_key),
    INDEX idx_chat_rag_source_type (source_type),
    INDEX idx_chat_rag_source_id (source_id)
) ENGINE=InnoDB;

CREATE TABLE chat_rag_sync_state (
    source_type VARCHAR(50) PRIMARY KEY,
    source_count INT NOT NULL DEFAULT 0,
    status ENUM('idle', 'syncing', 'error') NOT NULL DEFAULT 'idle',
    last_synced_at DATETIME DEFAULT NULL,
    detail TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- =============================================================================
-- PRODUCT IMAGE EMBEDDINGS TABLE
-- =============================================================================
CREATE TABLE product_image_embeddings (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    product_image_id INT NULL,
    image_url VARCHAR(2048) NOT NULL,
    content_hash CHAR(64) NOT NULL,
    embedding_model VARCHAR(128) NOT NULL,
    embedding_dim INT NOT NULL DEFAULT 512,
    embedding_vector LONGTEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_product_image_embedding (product_id),
    INDEX idx_content_hash (content_hash),
    CONSTRAINT fk_pie_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- AI AUTOMATION TABLES
-- =============================================================================
CREATE TABLE user_product_events (
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

CREATE TABLE user_recommendation_profiles (
    user_id INT PRIMARY KEY,
    profile_json LONGTEXT NOT NULL,
    source_hash CHAR(64) NOT NULL DEFAULT '',
    refreshed_at DATETIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE review_ai_insights (
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

CREATE TABLE inventory_forecasts (
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

CREATE TABLE order_risk_assessments (
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

CREATE TABLE marketing_campaign_drafts (
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

-- =============================================================================
-- END OF SCHEMA
-- =============================================================================
SELECT 'Database schema created successfully!' AS Status;
