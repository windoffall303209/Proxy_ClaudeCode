-- =============================================================================
-- WIND OF FALL - E-commerce Database Schema
-- =============================================================================
-- Complete database schema including all tables and features
-- Version: 3.0 (PostgreSQL consolidated through migrations/017)
-- =============================================================================

-- PostgreSQL schema runs against the current database (for example: psql -d tmdt_ecommerce -f database/schema.sql).
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
SET search_path TO public;

CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- USERS TABLE
-- =============================================================================
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    avatar_url VARCHAR(500) DEFAULT NULL,
    birthday DATE DEFAULT NULL,
    role VARCHAR(50) DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
    -- Email verification
    email_verified BOOLEAN DEFAULT FALSE,
    email_verified_at TIMESTAMP DEFAULT NULL,
    verification_code VARCHAR(6) DEFAULT NULL,
    verification_expires TIMESTAMP DEFAULT NULL,
    -- Phone verification
    phone_verified BOOLEAN DEFAULT FALSE,
    -- Password reset
    reset_code VARCHAR(6) DEFAULT NULL,
    reset_code_expires TIMESTAMP DEFAULT NULL,
    -- Marketing
    marketing_consent BOOLEAN DEFAULT FALSE,
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    account_deleted_at TIMESTAMP DEFAULT NULL,
    account_delete_expires_at TIMESTAMP DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- CATEGORIES TABLE
-- =============================================================================
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    parent_id INT NULL,
    image_url VARCHAR(500),
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
);

-- =============================================================================
-- SALES TABLE
-- =============================================================================
CREATE TABLE sales (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL CHECK (type IN ('percentage', 'fixed', 'bogo')),
    value DECIMAL(10, 2) NOT NULL,
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- PRODUCTS TABLE
-- =============================================================================
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
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
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
    FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE SET NULL
);

-- =============================================================================
-- PRODUCT IMAGES TABLE
-- =============================================================================
CREATE TABLE product_images (
    id SERIAL PRIMARY KEY,
    product_id INT NOT NULL,
    image_url VARCHAR(500) NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE,
    display_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- =============================================================================
-- PRODUCT VARIANTS TABLE (sizes, colors)
-- =============================================================================
CREATE TABLE product_variants (
    id SERIAL PRIMARY KEY,
    product_id INT NOT NULL,
    image_id INT NULL,
    size VARCHAR(50),
    color VARCHAR(50),
    additional_price DECIMAL(10, 2) DEFAULT 0,
    stock_quantity INT DEFAULT 0,
    sku VARCHAR(100) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (image_id) REFERENCES product_images(id) ON DELETE SET NULL
);

-- =============================================================================
-- VOUCHERS TABLE
-- =============================================================================
CREATE TABLE vouchers (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL DEFAULT 'percentage' CHECK (type IN ('percentage', 'fixed')),
    value DECIMAL(10, 2) NOT NULL,
    min_order_amount DECIMAL(10, 2) DEFAULT 0,
    max_discount_amount DECIMAL(10, 2) NULL,
    usage_limit INT DEFAULT NULL,
    used_count INT DEFAULT 0,
    user_limit INT DEFAULT 1,
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- VOUCHER PRODUCTS TABLE
-- =============================================================================
CREATE TABLE voucher_products (
    voucher_id INT NOT NULL,
    product_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (voucher_id, product_id),
    FOREIGN KEY (voucher_id) REFERENCES vouchers(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- =============================================================================
-- CART TABLE (persistent shopping cart)
-- =============================================================================
CREATE TABLE cart (
    id SERIAL PRIMARY KEY,
    user_id INT NULL,
    session_id VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- =============================================================================
-- CART ITEMS TABLE
-- =============================================================================
CREATE TABLE cart_items (
    id SERIAL PRIMARY KEY,
    cart_id INT NOT NULL,
    product_id INT NOT NULL,
    variant_id INT NULL,
    quantity INT NOT NULL DEFAULT 1,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cart_id) REFERENCES cart(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE SET NULL
);

-- =============================================================================
-- ADDRESSES TABLE
-- =============================================================================
CREATE TABLE addresses (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    address_line VARCHAR(500) NOT NULL,
    ward VARCHAR(255),
    district VARCHAR(255),
    city VARCHAR(255) NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- =============================================================================
-- ORDERS TABLE
-- =============================================================================
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
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
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending_payment', 'pending', 'confirmed', 'processing', 'shipping', 'delivered', 'completed', 'cancelled')),
    payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN ('cod', 'vnpay', 'momo')),
    payment_status VARCHAR(50) DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'refunded')),
    payment_expires_at TIMESTAMP NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (address_id) REFERENCES addresses(id) ON DELETE SET NULL,
    FOREIGN KEY (voucher_id) REFERENCES vouchers(id) ON DELETE SET NULL
);

-- =============================================================================
-- ORDER ITEMS TABLE
-- =============================================================================
CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
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
    FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE SET NULL
);

-- =============================================================================
-- VOUCHER USAGE TABLE
-- =============================================================================
CREATE TABLE voucher_usage (
    id SERIAL PRIMARY KEY,
    voucher_id INT NOT NULL,
    user_id INT NOT NULL,
    order_id INT NOT NULL,
    discount_amount DECIMAL(10, 2) NOT NULL,
    used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (voucher_id) REFERENCES vouchers(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

-- =============================================================================
-- PAYMENTS TABLE
-- =============================================================================
CREATE TABLE payments (
    id SERIAL PRIMARY KEY,
    order_id INT NOT NULL,
    payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN ('cod', 'vnpay', 'momo')),
    transaction_id VARCHAR(255) UNIQUE,
    amount DECIMAL(10, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed', 'refunded')),
    payment_data TEXT,
    processed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

-- =============================================================================
-- SHIPMENTS TABLE
-- =============================================================================
CREATE TABLE shipments (
    id SERIAL PRIMARY KEY,
    order_id INT NOT NULL,
    carrier VARCHAR(100) NULL,
    tracking_code VARCHAR(100) NULL,
    tracking_url VARCHAR(500) NULL,
    current_status VARCHAR(50) DEFAULT 'pending' CHECK (current_status IN ('pending_payment', 'pending', 'confirmed', 'processing', 'shipping', 'delivered', 'completed', 'cancelled')),
    current_location_text VARCHAR(255) NULL,
    current_lat DECIMAL(10, 7) NULL,
    current_lng DECIMAL(10, 7) NULL,
    estimated_delivery_at TIMESTAMP NULL,
    last_event_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    CONSTRAINT uq_shipments_order UNIQUE (order_id)
);

-- =============================================================================
-- ORDER TRACKING EVENTS TABLE
-- =============================================================================
CREATE TABLE order_tracking_events (
    id SERIAL PRIMARY KEY,
    order_id INT NOT NULL,
    shipment_id INT NULL,
    status VARCHAR(50) NOT NULL CHECK (status IN ('pending_payment', 'pending', 'confirmed', 'processing', 'shipping', 'delivered', 'completed', 'cancelled')),
    title VARCHAR(255) NOT NULL,
    description TEXT NULL,
    location_text VARCHAR(255) NULL,
    lat DECIMAL(10, 7) NULL,
    lng DECIMAL(10, 7) NULL,
    event_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    source VARCHAR(50) DEFAULT 'system' CHECK (source IN ('system', 'admin', 'carrier', 'user')),
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (shipment_id) REFERENCES shipments(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- =============================================================================
-- ORDER RETURN REQUESTS TABLE
-- =============================================================================
CREATE TABLE order_return_requests (
    id SERIAL PRIMARY KEY,
    order_id INT NOT NULL,
    user_id INT NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'resolved')),
    admin_note TEXT NULL,
    reviewed_by INT NULL,
    reviewed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE order_return_media (
    id SERIAL PRIMARY KEY,
    return_request_id INT NOT NULL,
    media_type VARCHAR(50) NOT NULL CHECK (media_type IN ('image', 'video')),
    media_url VARCHAR(500) NOT NULL,
    public_id VARCHAR(255) NULL,
    display_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (return_request_id) REFERENCES order_return_requests(id) ON DELETE CASCADE
);

-- =============================================================================
-- BANNERS TABLE
-- =============================================================================
CREATE TABLE banners (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    subtitle VARCHAR(255),
    description TEXT,
    image_url VARCHAR(500) NOT NULL,
    link_url VARCHAR(500),
    button_text VARCHAR(100),
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    start_date TIMESTAMP NULL,
    end_date TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- STOREFRONT SETTINGS TABLE
-- =============================================================================
CREATE TABLE storefront_settings (
    id SERIAL PRIMARY KEY,
    setting_key VARCHAR(100) NOT NULL UNIQUE,
    setting_value TEXT NOT NULL,
    draft_value TEXT NULL,
    value_type VARCHAR(50) NOT NULL DEFAULT 'string' CHECK (value_type IN ('int', 'string', 'boolean', 'json', 'color', 'url', 'image', 'select')),
    updated_by INT NULL,
    published_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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
    id SERIAL PRIMARY KEY,
    product_id INT NOT NULL,
    user_id INT NOT NULL,
    order_id INT NOT NULL,
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    is_verified BOOLEAN DEFAULT FALSE,
    is_approved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE TABLE review_media (
    id SERIAL PRIMARY KEY,
    review_id INT NOT NULL,
    media_type VARCHAR(50) NOT NULL CHECK (media_type IN ('image', 'video')),
    media_url VARCHAR(500) NOT NULL,
    public_id VARCHAR(255) NULL,
    display_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE
);

-- =============================================================================
-- EMAIL CAMPAIGNS TABLE
-- =============================================================================
CREATE TABLE email_campaigns (
    id SERIAL PRIMARY KEY,
    subject VARCHAR(255) NOT NULL,
    template_name VARCHAR(100) NOT NULL,
    content TEXT NOT NULL,
    recipient_count INT DEFAULT 0,
    sent_count INT DEFAULT 0,
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'failed')),
    scheduled_at TIMESTAMP NULL,
    sent_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- WISHLIST TABLE
-- =============================================================================
CREATE TABLE wishlist (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    product_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    CONSTRAINT unique_wishlist UNIQUE (user_id, product_id)
);

-- =============================================================================
-- NEWSLETTER SUBSCRIBERS TABLE
-- =============================================================================
CREATE TABLE newsletter_subscribers (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    user_id INT DEFAULT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    subscribed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    unsubscribed_at TIMESTAMP DEFAULT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- =============================================================================
-- PASSWORD RESET TOKENS TABLE (Legacy - kept for compatibility)
-- =============================================================================
CREATE TABLE password_reset_tokens (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    token VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- =============================================================================
-- EMAIL VERIFICATION TOKENS TABLE (Legacy - kept for compatibility)
-- =============================================================================
CREATE TABLE email_verification_tokens (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    token VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- =============================================================================
-- CHAT CONVERSATIONS TABLE
-- =============================================================================
CREATE TABLE chat_conversations (
    id SERIAL PRIMARY KEY,
    user_id INT DEFAULT NULL,
    session_id VARCHAR(255) DEFAULT NULL,
    guest_name VARCHAR(100) DEFAULT 'Khách',
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'closed')),
    handling_mode VARCHAR(50) DEFAULT 'ai' CHECK (handling_mode IN ('ai', 'manual')),
    last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- =============================================================================
-- CHAT MESSAGES TABLE
-- =============================================================================
CREATE TABLE chat_messages (
    id SERIAL PRIMARY KEY,
    conversation_id INT NOT NULL,
    sender_type VARCHAR(50) NOT NULL CHECK (sender_type IN ('customer', 'admin', 'bot')),
    sender_id INT DEFAULT NULL,
    message TEXT NOT NULL,
    message_type VARCHAR(50) NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'media', 'product_cards')),
    message_metadata TEXT DEFAULT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE SET NULL
);

-- =============================================================================
-- CHAT RAG TABLES
-- =============================================================================
CREATE TABLE chat_rag_chunks (
    id BIGSERIAL PRIMARY KEY,
    source_type VARCHAR(50) NOT NULL CHECK (source_type IN ('product', 'knowledge')),
    source_key VARCHAR(255) NOT NULL,
    source_id INT NULL,
    chunk_key VARCHAR(100) NOT NULL DEFAULT 'base',
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    metadata TEXT DEFAULT NULL,
    embedding_model VARCHAR(255) NOT NULL,
    embedding_vector TEXT NOT NULL,
    token_count INT NOT NULL DEFAULT 0,
    content_hash CHAR(64) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uniq_chat_rag_chunk UNIQUE (source_type, source_key, chunk_key)
);

CREATE TABLE chat_rag_sync_state (
    source_type VARCHAR(50) PRIMARY KEY,
    source_count INT NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'idle' CHECK (status IN ('idle', 'syncing', 'error')),
    last_synced_at TIMESTAMP DEFAULT NULL,
    detail TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- PRODUCT IMAGE EMBEDDINGS TABLE
-- =============================================================================
CREATE TABLE product_image_embeddings (
    id BIGSERIAL PRIMARY KEY,
    product_id INT NOT NULL,
    product_image_id INT NULL,
    image_url VARCHAR(2048) NOT NULL,
    content_hash CHAR(64) NOT NULL,
    embedding_model VARCHAR(128) NOT NULL,
    embedding_dim INT NOT NULL DEFAULT 512,
    embedding_vector TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uniq_product_image_embedding UNIQUE (product_id),
    CONSTRAINT fk_pie_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);


-- =============================================================================
-- INDEXES
-- =============================================================================
CREATE INDEX users_idx_email ON users (email);
CREATE INDEX users_idx_role ON users (role);
CREATE INDEX users_idx_verification_code ON users (verification_code);
CREATE INDEX users_idx_reset_code ON users (reset_code);
CREATE INDEX users_idx_account_delete_expires_at ON users (account_delete_expires_at);
CREATE INDEX categories_idx_slug ON categories (slug);
CREATE INDEX categories_idx_parent ON categories (parent_id);
CREATE INDEX sales_idx_active_dates ON sales (is_active, start_date, end_date);
CREATE INDEX products_idx_category ON products (category_id);
CREATE INDEX products_idx_slug ON products (slug);
CREATE INDEX products_idx_active ON products (is_active);
CREATE INDEX products_idx_featured ON products (is_featured);
CREATE INDEX product_images_idx_product ON product_images (product_id);
CREATE INDEX product_variants_idx_product ON product_variants (product_id);
CREATE INDEX product_variants_idx_variant_image ON product_variants (image_id);
CREATE INDEX vouchers_idx_code ON vouchers (code);
CREATE INDEX vouchers_idx_active_dates ON vouchers (is_active, start_date, end_date);
CREATE INDEX voucher_products_idx_voucher_products_product ON voucher_products (product_id);
CREATE INDEX cart_idx_user ON cart (user_id);
CREATE INDEX cart_idx_session ON cart (session_id);
CREATE INDEX cart_items_idx_cart ON cart_items (cart_id);
CREATE INDEX cart_items_idx_product ON cart_items (product_id);
CREATE INDEX addresses_idx_user ON addresses (user_id);
CREATE INDEX orders_idx_user ON orders (user_id);
CREATE INDEX orders_idx_order_code ON orders (order_code);
CREATE INDEX orders_idx_status ON orders (status);
CREATE INDEX orders_idx_payment_expires_at ON orders (payment_expires_at);
CREATE INDEX order_items_idx_order ON order_items (order_id);
CREATE INDEX voucher_usage_idx_voucher ON voucher_usage (voucher_id);
CREATE INDEX voucher_usage_idx_user ON voucher_usage (user_id);
CREATE INDEX payments_idx_order ON payments (order_id);
CREATE INDEX payments_idx_transaction ON payments (transaction_id);
CREATE INDEX shipments_idx_tracking_code ON shipments (tracking_code);
CREATE INDEX shipments_idx_shipments_status ON shipments (current_status);
CREATE INDEX order_tracking_events_idx_tracking_order ON order_tracking_events (order_id);
CREATE INDEX order_tracking_events_idx_tracking_shipment ON order_tracking_events (shipment_id);
CREATE INDEX order_tracking_events_idx_tracking_event_time ON order_tracking_events (event_time);
CREATE INDEX order_return_requests_idx_return_order ON order_return_requests (order_id);
CREATE INDEX order_return_requests_idx_return_user ON order_return_requests (user_id);
CREATE INDEX order_return_requests_idx_return_status ON order_return_requests (status);
CREATE INDEX order_return_media_idx_return_media_request ON order_return_media (return_request_id);
CREATE INDEX banners_idx_active ON banners (is_active, display_order);
CREATE INDEX storefront_settings_idx_storefront_settings_key ON storefront_settings (setting_key);
CREATE INDEX reviews_idx_product ON reviews (product_id);
CREATE INDEX reviews_idx_user ON reviews (user_id);
CREATE INDEX review_media_idx_review_media_review ON review_media (review_id);
CREATE INDEX email_campaigns_idx_status ON email_campaigns (status);
CREATE INDEX wishlist_idx_user ON wishlist (user_id);
CREATE INDEX newsletter_subscribers_idx_email ON newsletter_subscribers (email);
CREATE INDEX newsletter_subscribers_idx_user_id ON newsletter_subscribers (user_id);
CREATE INDEX newsletter_subscribers_idx_is_active ON newsletter_subscribers (is_active);
CREATE INDEX password_reset_tokens_idx_token ON password_reset_tokens (token);
CREATE INDEX password_reset_tokens_idx_user ON password_reset_tokens (user_id);
CREATE INDEX email_verification_tokens_idx_token ON email_verification_tokens (token);
CREATE INDEX chat_conversations_idx_user ON chat_conversations (user_id);
CREATE INDEX chat_conversations_idx_session ON chat_conversations (session_id);
CREATE INDEX chat_conversations_idx_status ON chat_conversations (status);
CREATE INDEX chat_conversations_idx_last_message ON chat_conversations (last_message_at);
CREATE INDEX chat_messages_idx_conversation ON chat_messages (conversation_id);
CREATE INDEX chat_messages_idx_read ON chat_messages (is_read);
CREATE INDEX chat_messages_idx_created ON chat_messages (created_at);
CREATE INDEX chat_rag_chunks_idx_chat_rag_source_type ON chat_rag_chunks (source_type);
CREATE INDEX chat_rag_chunks_idx_chat_rag_source_id ON chat_rag_chunks (source_id);
CREATE INDEX product_image_embeddings_idx_content_hash ON product_image_embeddings (content_hash);

-- =============================================================================
-- UPDATED_AT TRIGGERS
-- =============================================================================
CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_sales_updated_at
    BEFORE UPDATE ON sales
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_vouchers_updated_at
    BEFORE UPDATE ON vouchers
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_cart_updated_at
    BEFORE UPDATE ON cart
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_addresses_updated_at
    BEFORE UPDATE ON addresses
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_shipments_updated_at
    BEFORE UPDATE ON shipments
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_order_return_requests_updated_at
    BEFORE UPDATE ON order_return_requests
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_banners_updated_at
    BEFORE UPDATE ON banners
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_storefront_settings_updated_at
    BEFORE UPDATE ON storefront_settings
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_reviews_updated_at
    BEFORE UPDATE ON reviews
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_email_campaigns_updated_at
    BEFORE UPDATE ON email_campaigns
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_chat_conversations_updated_at
    BEFORE UPDATE ON chat_conversations
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_chat_rag_chunks_updated_at
    BEFORE UPDATE ON chat_rag_chunks
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_chat_rag_sync_state_updated_at
    BEFORE UPDATE ON chat_rag_sync_state
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_product_image_embeddings_updated_at
    BEFORE UPDATE ON product_image_embeddings
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- =============================================================================
-- END OF SCHEMA
-- =============================================================================
SELECT 'Database schema created successfully!' AS Status;
