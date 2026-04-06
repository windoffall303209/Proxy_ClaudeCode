-- =============================================================================
-- WIND OF FALL - E-commerce Database Schema
-- =============================================================================
-- Complete database schema including all tables and features
-- Version: 2.0 (Consolidated)
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_role (role),
    INDEX idx_verification_code (verification_code),
    INDEX idx_reset_code (reset_code)
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
    status ENUM('pending', 'confirmed', 'processing', 'shipping', 'delivered', 'cancelled') DEFAULT 'pending',
    payment_method ENUM('cod', 'vnpay', 'momo') NOT NULL,
    payment_status ENUM('unpaid', 'paid', 'refunded') DEFAULT 'unpaid',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (address_id) REFERENCES addresses(id) ON DELETE SET NULL,
    FOREIGN KEY (voucher_id) REFERENCES vouchers(id) ON DELETE SET NULL,
    INDEX idx_user (user_id),
    INDEX idx_order_code (order_code),
    INDEX idx_status (status)
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
    current_status ENUM('pending', 'confirmed', 'processing', 'shipping', 'delivered', 'cancelled') DEFAULT 'pending',
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
    status ENUM('pending', 'confirmed', 'processing', 'shipping', 'delivered', 'cancelled') NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NULL,
    location_text VARCHAR(255) NULL,
    lat DECIMAL(10, 7) NULL,
    lng DECIMAL(10, 7) NULL,
    event_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    source ENUM('system', 'admin', 'carrier') DEFAULT 'system',
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
-- END OF SCHEMA
-- =============================================================================
SELECT 'Database schema created successfully!' AS Status;
