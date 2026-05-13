-- File database/seed.sql: PostgreSQL seed data for the application.
-- =============================================================================
-- WIND OF FALL - Real Product Image Reseed
-- =============================================================================
-- Adapted for the current PostgreSQL schema in this project.
-- Source dataset: 26 products + 78 real Cloudinary product images.
--
-- Manual run:
--   psql -U postgres -d tmdt_ecommerce -f database/seed.sql
--
-- Notes:
-- - This script keeps the category/sale structure compatible with the current app.
-- - It clears product-dependent data before reseeding products, images, and variants.
-- - Sale windows use PostgreSQL relative dates so promotions stay active after reseed.
-- =============================================================================

START TRANSACTION;
-- ADMIN USER (password: admin123)
-- =============================================================================
INSERT INTO users (email, password_hash, full_name, phone, role, email_verified, is_active) VALUES
('admin@fashionstore.vn', '$2b$10$zWfYhRKxfkvhp.82oM2RR.Nax8x3LBVxY6vLKVPjNOuVY1REt5EcW', 'Admin', '0123456789', 'admin', TRUE, TRUE)
ON CONFLICT (email) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    full_name = EXCLUDED.full_name,
    phone = EXCLUDED.phone,
    role = EXCLUDED.role,
    email_verified = EXCLUDED.email_verified,
    is_active = EXCLUDED.is_active;

-- -----------------------------------------------------------------------------
-- 1. Categories
-- -----------------------------------------------------------------------------
INSERT INTO categories (id, name, slug, description, image_url, display_order, is_active) VALUES
(1, 'Thời Trang Nam', 'nam', 'Quần áo và phụ kiện nam', 'https://res.cloudinary.com/dywdkpcub/image/upload/v1773120094/tmdt_ecommerce/products/ao-polo-classic-nam-1.jpg', 1, TRUE),
(2, 'Thời Trang Nữ', 'nu', 'Quần áo và phụ kiện nữ', 'https://res.cloudinary.com/dywdkpcub/image/upload/v1773120138/tmdt_ecommerce/products/dam-maxi-hoa-1.jpg', 2, TRUE),
(3, 'Thời Trang Trẻ Em', 'tre-em', 'Quần áo trẻ em', 'https://res.cloudinary.com/dywdkpcub/image/upload/v1773120177/tmdt_ecommerce/products/bo-do-be-trai-1.jpg', 3, TRUE)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    slug = EXCLUDED.slug,
    description = EXCLUDED.description,
    image_url = EXCLUDED.image_url,
    display_order = EXCLUDED.display_order,
    is_active = EXCLUDED.is_active;

SELECT setval(pg_get_serial_sequence('categories', 'id'), COALESCE((SELECT MAX(id) FROM categories), 1), true);

-- -----------------------------------------------------------------------------
-- 2. Sales
-- -----------------------------------------------------------------------------
-- Original durations were 7 / 20 / 15 / 30 days.
-- They are converted to relative PostgreSQL dates so sale data is usable after reseed.
INSERT INTO sales (id, name, description, type, value, start_date, end_date, is_active) VALUES
(1, 'Flash Sale 30%', 'Giảm 30% cho các sản phẩm flash sale', 'percentage', 30.00, NOW() - INTERVAL '1 DAY', NOW() + INTERVAL '6 DAY', TRUE),
(2, 'Giảm 100K', 'Giảm trực tiếp 100.000đ', 'fixed', 100000.00, NOW() - INTERVAL '1 DAY', NOW() + INTERVAL '19 DAY', TRUE),
(3, 'Giảm Giá 21%', 'Ưu đãi giảm 21% cho các sản phẩm chọn lọc', 'percentage', 21.00, NOW() - INTERVAL '1 DAY', NOW() + INTERVAL '14 DAY', TRUE),
(4, 'Sale Cuối Mùa', 'Sale cuối mùa giảm sâu', 'percentage', 50.00, NOW() - INTERVAL '1 DAY', NOW() + INTERVAL '29 DAY', TRUE)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    type = EXCLUDED.type,
    value = EXCLUDED.value,
    start_date = EXCLUDED.start_date,
    end_date = EXCLUDED.end_date,
    is_active = EXCLUDED.is_active;

SELECT setval(pg_get_serial_sequence('sales', 'id'), COALESCE((SELECT MAX(id) FROM sales), 1), true);

-- -----------------------------------------------------------------------------
-- 3. Remove existing product-related data
-- -----------------------------------------------------------------------------
TRUNCATE TABLE
    reviews,
    wishlist,
    cart_items,
    order_items,
    voucher_products,
    product_variants,
    product_images,
    products
RESTART IDENTITY CASCADE;

-- -----------------------------------------------------------------------------
-- 4. Product catalog
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS tmp_product_catalog;
CREATE TEMPORARY TABLE tmp_product_catalog (
    category_slug VARCHAR(20) NOT NULL,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    stock_quantity INT NOT NULL,
    sku VARCHAR(100) NOT NULL,
    is_featured BOOLEAN NOT NULL,
    is_active BOOLEAN NOT NULL,
    sale_id INT NULL,
    PRIMARY KEY (slug),
    CONSTRAINT uk_tmp_product_catalog_sku UNIQUE (sku)
);

INSERT INTO tmp_product_catalog (category_slug, name, slug, description, price, stock_quantity, sku, is_featured, is_active, sale_id) VALUES
('nam', 'Áo Polo Classic Nam', 'ao-polo-classic-nam', 'Áo polo nam chất liệu cotton cao cấp, thoáng mát', 450000.00, 100, 'APM001', TRUE, TRUE, 4),
('nam', 'Áo Thun Basic Nam', 'ao-thun-basic-nam', 'Áo thun nam form rộng thoải mái', 250000.00, 150, 'ATM002', FALSE, TRUE, NULL),
('nam', 'Quần Jeans Slim Fit', 'quan-jeans-slim-fit', 'Quần jeans nam form slim hiện đại', 680000.00, 90, 'QJM001', FALSE, TRUE, NULL),
('nam', 'Áo Sơ Mi Oxford', 'ao-so-mi-oxford', 'Áo sơ mi nam Oxford cao cấp', 520000.00, 60, 'ASM001', TRUE, TRUE, 3),
('nam', 'Quần Kaki Nam', 'quan-kaki-nam', 'Quần kaki nam công sở lịch sự', 380000.00, 120, 'QKM001', FALSE, TRUE, NULL),
('nam', 'Áo Polo Pique Nam', 'ao-polo-pique-nam', 'Áo polo pique cotton 100%, form regular fit thoải mái', 380000.00, 120, 'APM002', FALSE, TRUE, NULL),
('nam', 'Áo Thun Oversize Nam', 'ao-thun-oversize-nam', 'Áo thun oversize phong cách streetwear', 290000.00, 200, 'ATM003', TRUE, TRUE, 1),
('nam', 'Áo Hoodie Basic Nam', 'ao-hoodie-basic-nam', 'Áo hoodie cotton french terry ấm áp', 550000.00, 75, 'AHM001', TRUE, TRUE, NULL),
('nam', 'Áo Khoác Bomber Nam', 'ao-khoac-bomber-nam', 'Áo khoác bomber phong cách trẻ trung', 890000.00, 50, 'AKM001', TRUE, TRUE, 1),
('nam', 'Quần Jogger Nam', 'quan-jogger-nam', 'Quần jogger thể thao năng động', 380000.00, 150, 'QGM001', FALSE, TRUE, 1),
('nu', 'Đầm Maxi Hoa', 'dam-maxi-hoa', 'Đầm maxi họa tiết hoa thanh lịch', 750000.00, 50, 'DMN001', TRUE, TRUE, 3),
('nu', 'Áo Sơ Mi Lụa Nữ', 'ao-so-mi-lua-nu', 'Áo sơ mi lụa nữ cao cấp', 520000.00, 60, 'ASN002', TRUE, TRUE, NULL),
('nu', 'Váy Công Sở', 'vay-cong-so', 'Váy công sở thanh lịch tự tin', 420000.00, 80, 'VCS001', FALSE, TRUE, NULL),
('nu', 'Quần Jean Nữ', 'quan-jean-nu', 'Quần jean nữ co giãn thoải mái', 580000.00, 70, 'QJN001', FALSE, TRUE, 4),
('nu', 'Áo Kiểu Công Sở', 'ao-kieu-cong-so', 'Áo kiểu nữ lịch sự sang trọng', 350000.00, 90, 'AKN001', TRUE, TRUE, NULL),
('nu', 'Áo Croptop Nữ', 'ao-croptop-nu', 'Áo croptop nữ trẻ trung năng động', 280000.00, 150, 'ACN001', TRUE, TRUE, 1),
('nu', 'Áo Cardigan Nữ', 'ao-cardigan-nu', 'Áo cardigan len mỏng phong cách Hàn Quốc', 490000.00, 80, 'ACN002', TRUE, TRUE, NULL),
('nu', 'Váy Midi Xòe', 'vay-midi-xoe-nu', 'Váy midi xòe họa tiết vintage', 480000.00, 85, 'VMN001', TRUE, TRUE, 1),
('nu', 'Đầm Dự Tiệc', 'dam-du-tiec-nu', 'Đầm dự tiệc sang trọng lộng lẫy', 1100000.00, 35, 'DDN001', TRUE, TRUE, NULL),
('nu', 'Quần Baggy Nữ', 'quan-baggy-nu', 'Quần baggy jeans phong cách', 550000.00, 70, 'QBN001', TRUE, TRUE, NULL),
('tre-em', 'Bộ Đồ Bé Trai', 'bo-do-be-trai', 'Bộ đồ cotton mềm mại cho bé trai', 320000.00, 80, 'BTE001', FALSE, TRUE, NULL),
('tre-em', 'Váy Công Chúa Bé Gái', 'vay-cong-chua-be-gai', 'Váy công chúa xinh xắn cho bé gái', 450000.00, 40, 'VTE002', TRUE, TRUE, 4),
('tre-em', 'Áo Thun Trẻ Em', 'ao-thun-tre-em', 'Áo thun trẻ em nhiều màu sắc', 180000.00, 150, 'ATE001', FALSE, TRUE, NULL),
('tre-em', 'Quần Short Bé Trai', 'quan-short-be-trai', 'Quần short thể thao cho bé trai', 220000.00, 100, 'QTE001', FALSE, TRUE, NULL),
('tre-em', 'Bộ Thể Thao Bé Trai', 'bo-the-thao-be-trai', 'Bộ thể thao năng động cho bé trai', 320000.00, 90, 'BTT001', TRUE, TRUE, NULL),
('tre-em', 'Váy Đầm Bé Gái Hoa', 'vay-dam-be-gai-hoa', 'Váy đầm hoa xinh xắn cho bé gái', 280000.00, 100, 'VDG001', TRUE, TRUE, 1);

INSERT INTO products (
    category_id,
    sale_id,
    name,
    slug,
    description,
    price,
    stock_quantity,
    sku,
    is_featured,
    is_active
)
SELECT
    c.id,
    pc.sale_id,
    pc.name,
    pc.slug,
    pc.description,
    pc.price,
    pc.stock_quantity,
    pc.sku,
    pc.is_featured,
    pc.is_active
FROM tmp_product_catalog pc
JOIN categories c ON c.slug = pc.category_slug;

-- -----------------------------------------------------------------------------
-- 5. Real Cloudinary product images
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS tmp_product_images;
CREATE TEMPORARY TABLE tmp_product_images (
    product_slug VARCHAR(255) NOT NULL,
    image_url VARCHAR(500) NOT NULL,
    is_primary BOOLEAN NOT NULL,
    display_order INT NOT NULL,
    PRIMARY KEY (product_slug, display_order)
);

INSERT INTO tmp_product_images (product_slug, image_url, is_primary, display_order) VALUES
('ao-polo-classic-nam', 'https://res.cloudinary.com/dywdkpcub/image/upload/v1773120094/tmdt_ecommerce/products/ao-polo-classic-nam-1.jpg', TRUE, 0),
('ao-polo-classic-nam', 'https://res.cloudinary.com/dywdkpcub/image/upload/v1773120096/tmdt_ecommerce/products/ao-polo-classic-nam-2.jpg', FALSE, 1),
('ao-polo-classic-nam', 'https://res.cloudinary.com/dywdkpcub/image/upload/v1773120097/tmdt_ecommerce/products/ao-polo-classic-nam-3.jpg', FALSE, 2),
('ao-thun-basic-nam', 'https://res.cloudinary.com/dywdkpcub/image/upload/v1773120099/tmdt_ecommerce/products/ao-thun-basic-nam-1.jpg', TRUE, 0),
('ao-thun-basic-nam', 'https://res.cloudinary.com/dywdkpcub/image/upload/v1773120100/tmdt_ecommerce/products/ao-thun-basic-nam-2.jpg', FALSE, 1),
('ao-thun-basic-nam', 'https://res.cloudinary.com/dywdkpcub/image/upload/v1773120102/tmdt_ecommerce/products/ao-thun-basic-nam-3.jpg', FALSE, 2),
('quan-jeans-slim-fit', 'https://res.cloudinary.com/dywdkpcub/image/upload/v1773120103/tmdt_ecommerce/products/quan-jeans-slim-fit-1.jpg', TRUE, 0),
('quan-jeans-slim-fit', 'https://res.cloudinary.com/dywdkpcub/image/upload/v1773120105/tmdt_ecommerce/products/quan-jeans-slim-fit-2.jpg', FALSE, 1),
('quan-jeans-slim-fit', 'https://res.cloudinary.com/dywdkpcub/image/upload/v1773120106/tmdt_ecommerce/products/quan-jeans-slim-fit-3.jpg', FALSE, 2),
('ao-so-mi-oxford', 'https://res.cloudinary.com/dywdkpcub/image/upload/v1773120107/tmdt_ecommerce/products/ao-so-mi-oxford-1.jpg', TRUE, 0),
('ao-so-mi-oxford', 'https://res.cloudinary.com/dywdkpcub/image/upload/v1773120109/tmdt_ecommerce/products/ao-so-mi-oxford-2.jpg', FALSE, 1),
('ao-so-mi-oxford', 'https://res.cloudinary.com/dywdkpcub/image/upload/v1773120110/tmdt_ecommerce/products/ao-so-mi-oxford-3.jpg', FALSE, 2),
('quan-kaki-nam', 'https://res.cloudinary.com/dywdkpcub/image/upload/v1773120112/tmdt_ecommerce/products/quan-kaki-nam-1.jpg', TRUE, 0),
('quan-kaki-nam', 'https://res.cloudinary.com/dywdkpcub/image/upload/v1773120113/tmdt_ecommerce/products/quan-kaki-nam-2.jpg', FALSE, 1),
('quan-kaki-nam', 'https://res.cloudinary.com/dywdkpcub/image/upload/v1773120114/tmdt_ecommerce/products/quan-kaki-nam-3.jpg', FALSE, 2),
('ao-polo-pique-nam', 'https://res.cloudinary.com/dywdkpcub/image/upload/v1773120115/tmdt_ecommerce/products/ao-polo-pique-nam-1.jpg', TRUE, 0),
('ao-polo-pique-nam', 'https://res.cloudinary.com/dywdkpcub/image/upload/v1773120117/tmdt_ecommerce/products/ao-polo-pique-nam-2.jpg', FALSE, 1),
('ao-polo-pique-nam', 'https://res.cloudinary.com/dywdkpcub/image/upload/v1773120118/tmdt_ecommerce/products/ao-polo-pique-nam-3.jpg', FALSE, 2),
('ao-thun-oversize-nam', 'https://res.cloudinary.com/dywdkpcub/image/upload/v1773120119/tmdt_ecommerce/products/ao-thun-oversize-nam-1.jpg', TRUE, 0),
('ao-thun-oversize-nam', 'https://res.cloudinary.com/dywdkpcub/image/upload/v1773120120/tmdt_ecommerce/products/ao-thun-oversize-nam-2.jpg', FALSE, 1),
('ao-thun-oversize-nam', 'https://res.cloudinary.com/dywdkpcub/image/upload/v1773120121/tmdt_ecommerce/products/ao-thun-oversize-nam-3.jpg', FALSE, 2),
('ao-hoodie-basic-nam', 'https://res.cloudinary.com/dywdkpcub/image/upload/v1773120123/tmdt_ecommerce/products/ao-hoodie-basic-nam-1.jpg', TRUE, 0),
('ao-hoodie-basic-nam', 'https://res.cloudinary.com/dywdkpcub/image/upload/v1773120124/tmdt_ecommerce/products/ao-hoodie-basic-nam-2.jpg', FALSE, 1),
('ao-hoodie-basic-nam', 'https://res.cloudinary.com/dywdkpcub/image/upload/v1773120125/tmdt_ecommerce/products/ao-hoodie-basic-nam-3.jpg', FALSE, 2),
('ao-khoac-bomber-nam', 'https://res.cloudinary.com/dywdkpcub/image/upload/v1773120127/tmdt_ecommerce/products/ao-khoac-bomber-nam-1.jpg', TRUE, 0),
('ao-khoac-bomber-nam', 'https://res.cloudinary.com/dywdkpcub/image/upload/v1773120129/tmdt_ecommerce/products/ao-khoac-bomber-nam-2.jpg', FALSE, 1),
('ao-khoac-bomber-nam', 'https://res.cloudinary.com/dywdkpcub/image/upload/v1773120130/tmdt_ecommerce/products/ao-khoac-bomber-nam-3.jpg', FALSE, 2),
('quan-jogger-nam', 'https://res.cloudinary.com/dywdkpcub/image/upload/v1773120132/tmdt_ecommerce/products/quan-jogger-nam-1.jpg', TRUE, 0),
('quan-jogger-nam', 'https://res.cloudinary.com/dywdkpcub/image/upload/v1773120133/tmdt_ecommerce/products/quan-jogger-nam-2.jpg', FALSE, 1),
('quan-jogger-nam', 'https://res.cloudinary.com/dywdkpcub/image/upload/v1773120135/tmdt_ecommerce/products/quan-jogger-nam-3.jpg', FALSE, 2),
('dam-maxi-hoa', 'https://res.cloudinary.com/dywdkpcub/image/upload/v1773120138/tmdt_ecommerce/products/dam-maxi-hoa-1.jpg', TRUE, 0),
('dam-maxi-hoa', 'https://res.cloudinary.com/dywdkpcub/image/upload/v1773120139/tmdt_ecommerce/products/dam-maxi-hoa-2.jpg', FALSE, 1),
('dam-maxi-hoa', 'https://res.cloudinary.com/dywdkpcub/image/upload/v1773120141/tmdt_ecommerce/products/dam-maxi-hoa-3.jpg', FALSE, 2),
('ao-so-mi-lua-nu', 'https://res.cloudinary.com/dywdkpcub/image/upload/v1773120142/tmdt_ecommerce/products/ao-so-mi-lua-nu-1.jpg', TRUE, 0),
('ao-so-mi-lua-nu', 'https://res.cloudinary.com/dywdkpcub/image/upload/v1773120143/tmdt_ecommerce/products/ao-so-mi-lua-nu-2.jpg', FALSE, 1),
('ao-so-mi-lua-nu', 'https://res.cloudinary.com/dywdkpcub/image/upload/v1773120144/tmdt_ecommerce/products/ao-so-mi-lua-nu-3.jpg', FALSE, 2),
('vay-cong-so', 'https://res.cloudinary.com/dywdkpcub/image/upload/v1773120145/tmdt_ecommerce/products/vay-cong-so-1.jpg', TRUE, 0),
('vay-cong-so', 'https://res.cloudinary.com/dywdkpcub/image/upload/v1773120147/tmdt_ecommerce/products/vay-cong-so-2.jpg', FALSE, 1),
('vay-cong-so', 'https://res.cloudinary.com/dywdkpcub/image/upload/v1773120148/tmdt_ecommerce/products/vay-cong-so-3.jpg', FALSE, 2),
('quan-jean-nu', 'https://res.cloudinary.com/dywdkpcub/image/upload/v1773120149/tmdt_ecommerce/products/quan-jean-nu-1.jpg', TRUE, 0),
('quan-jean-nu', 'https://res.cloudinary.com/dywdkpcub/image/upload/v1773120151/tmdt_ecommerce/products/quan-jean-nu-2.jpg', FALSE, 1),
('quan-jean-nu', 'https://res.cloudinary.com/dywdkpcub/image/upload/v1773120152/tmdt_ecommerce/products/quan-jean-nu-3.jpg', FALSE, 2),
('ao-kieu-cong-so', 'https://res.cloudinary.com/dywdkpcub/image/upload/v1773120153/tmdt_ecommerce/products/ao-kieu-cong-so-1.jpg', TRUE, 0),
('ao-kieu-cong-so', 'https://res.cloudinary.com/dywdkpcub/image/upload/v1773120155/tmdt_ecommerce/products/ao-kieu-cong-so-2.jpg', FALSE, 1),
('ao-kieu-cong-so', 'https://res.cloudinary.com/dywdkpcub/image/upload/v1773120156/tmdt_ecommerce/products/ao-kieu-cong-so-3.jpg', FALSE, 2),
('ao-croptop-nu', 'https://res.cloudinary.com/dywdkpcub/image/upload/v1773120157/tmdt_ecommerce/products/ao-croptop-nu-1.jpg', TRUE, 0),
('ao-croptop-nu', 'https://res.cloudinary.com/dywdkpcub/image/upload/v1773120158/tmdt_ecommerce/products/ao-croptop-nu-2.jpg', FALSE, 1),
('ao-croptop-nu', 'https://res.cloudinary.com/dywdkpcub/image/upload/v1773120160/tmdt_ecommerce/products/ao-croptop-nu-3.jpg', FALSE, 2),
('ao-cardigan-nu', 'https://res.cloudinary.com/dywdkpcub/image/upload/v1773120161/tmdt_ecommerce/products/ao-cardigan-nu-1.jpg', TRUE, 0),
('ao-cardigan-nu', 'https://res.cloudinary.com/dywdkpcub/image/upload/v1773120162/tmdt_ecommerce/products/ao-cardigan-nu-2.jpg', FALSE, 1),
('ao-cardigan-nu', 'https://res.cloudinary.com/dywdkpcub/image/upload/v1773120164/tmdt_ecommerce/products/ao-cardigan-nu-3.jpg', FALSE, 2),
('vay-midi-xoe-nu', 'https://res.cloudinary.com/dywdkpcub/image/upload/v1773120165/tmdt_ecommerce/products/vay-midi-xoe-nu-1.jpg', TRUE, 0),
('vay-midi-xoe-nu', 'https://res.cloudinary.com/dywdkpcub/image/upload/v1773120166/tmdt_ecommerce/products/vay-midi-xoe-nu-2.jpg', FALSE, 1),
('vay-midi-xoe-nu', 'https://res.cloudinary.com/dywdkpcub/image/upload/v1773120167/tmdt_ecommerce/products/vay-midi-xoe-nu-3.jpg', FALSE, 2),
('dam-du-tiec-nu', 'https://res.cloudinary.com/dywdkpcub/image/upload/v1773120169/tmdt_ecommerce/products/dam-du-tiec-nu-1.jpg', TRUE, 0),
('dam-du-tiec-nu', 'https://res.cloudinary.com/dywdkpcub/image/upload/v1773120170/tmdt_ecommerce/products/dam-du-tiec-nu-2.jpg', FALSE, 1),
('dam-du-tiec-nu', 'https://res.cloudinary.com/dywdkpcub/image/upload/v1773120172/tmdt_ecommerce/products/dam-du-tiec-nu-3.jpg', FALSE, 2),
('quan-baggy-nu', 'https://res.cloudinary.com/dywdkpcub/image/upload/v1773120173/tmdt_ecommerce/products/quan-baggy-nu-1.jpg', TRUE, 0),
('quan-baggy-nu', 'https://res.cloudinary.com/dywdkpcub/image/upload/v1773120174/tmdt_ecommerce/products/quan-baggy-nu-2.jpg', FALSE, 1),
('quan-baggy-nu', 'https://res.cloudinary.com/dywdkpcub/image/upload/v1773120176/tmdt_ecommerce/products/quan-baggy-nu-3.jpg', FALSE, 2),
('bo-do-be-trai', 'https://res.cloudinary.com/dywdkpcub/image/upload/v1773120177/tmdt_ecommerce/products/bo-do-be-trai-1.jpg', TRUE, 0),
('bo-do-be-trai', 'https://res.cloudinary.com/dywdkpcub/image/upload/v1773120178/tmdt_ecommerce/products/bo-do-be-trai-2.jpg', FALSE, 1),
('bo-do-be-trai', 'https://res.cloudinary.com/dywdkpcub/image/upload/v1773120180/tmdt_ecommerce/products/bo-do-be-trai-3.jpg', FALSE, 2),
('vay-cong-chua-be-gai', 'https://res.cloudinary.com/dywdkpcub/image/upload/v1773120181/tmdt_ecommerce/products/vay-cong-chua-be-gai-1.jpg', TRUE, 0),
('vay-cong-chua-be-gai', 'https://res.cloudinary.com/dywdkpcub/image/upload/v1773120182/tmdt_ecommerce/products/vay-cong-chua-be-gai-2.jpg', FALSE, 1),
('vay-cong-chua-be-gai', 'https://res.cloudinary.com/dywdkpcub/image/upload/v1773120184/tmdt_ecommerce/products/vay-cong-chua-be-gai-3.jpg', FALSE, 2),
('ao-thun-tre-em', 'https://res.cloudinary.com/dywdkpcub/image/upload/v1773120185/tmdt_ecommerce/products/ao-thun-tre-em-1.jpg', TRUE, 0),
('ao-thun-tre-em', 'https://res.cloudinary.com/dywdkpcub/image/upload/v1773120186/tmdt_ecommerce/products/ao-thun-tre-em-2.jpg', FALSE, 1),
('ao-thun-tre-em', 'https://res.cloudinary.com/dywdkpcub/image/upload/v1773120187/tmdt_ecommerce/products/ao-thun-tre-em-3.jpg', FALSE, 2),
('quan-short-be-trai', 'https://res.cloudinary.com/dywdkpcub/image/upload/v1773120188/tmdt_ecommerce/products/quan-short-be-trai-1.jpg', TRUE, 0),
('quan-short-be-trai', 'https://res.cloudinary.com/dywdkpcub/image/upload/v1773120189/tmdt_ecommerce/products/quan-short-be-trai-2.jpg', FALSE, 1),
('quan-short-be-trai', 'https://res.cloudinary.com/dywdkpcub/image/upload/v1773120190/tmdt_ecommerce/products/quan-short-be-trai-3.jpg', FALSE, 2),
('bo-the-thao-be-trai', 'https://res.cloudinary.com/dywdkpcub/image/upload/v1773120191/tmdt_ecommerce/products/bo-the-thao-be-trai-1.jpg', TRUE, 0),
('bo-the-thao-be-trai', 'https://res.cloudinary.com/dywdkpcub/image/upload/v1773120192/tmdt_ecommerce/products/bo-the-thao-be-trai-2.jpg', FALSE, 1),
('bo-the-thao-be-trai', 'https://res.cloudinary.com/dywdkpcub/image/upload/v1773120194/tmdt_ecommerce/products/bo-the-thao-be-trai-3.jpg', FALSE, 2),
('vay-dam-be-gai-hoa', 'https://res.cloudinary.com/dywdkpcub/image/upload/v1773120195/tmdt_ecommerce/products/vay-dam-be-gai-hoa-1.jpg', TRUE, 0),
('vay-dam-be-gai-hoa', 'https://res.cloudinary.com/dywdkpcub/image/upload/v1773120196/tmdt_ecommerce/products/vay-dam-be-gai-hoa-2.jpg', FALSE, 1),
('vay-dam-be-gai-hoa', 'https://res.cloudinary.com/dywdkpcub/image/upload/v1773120198/tmdt_ecommerce/products/vay-dam-be-gai-hoa-3.jpg', FALSE, 2);

INSERT INTO product_images (product_id, image_url, is_primary, display_order)
SELECT
    p.id,
    tpi.image_url,
    tpi.is_primary,
    tpi.display_order
FROM tmp_product_images tpi
JOIN products p ON p.slug = tpi.product_slug;

-- -----------------------------------------------------------------------------
-- 6. Variants mapped to the real images
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS tmp_variant_profile;
CREATE TEMPORARY TABLE tmp_variant_profile (
    category_slug VARCHAR(20) NOT NULL,
    display_order INT NOT NULL,
    size_value VARCHAR(20) NOT NULL,
    color_value VARCHAR(50) NOT NULL,
    additional_price DECIMAL(10, 2) NOT NULL,
    PRIMARY KEY (category_slug, display_order)
);

INSERT INTO tmp_variant_profile (category_slug, display_order, size_value, color_value, additional_price) VALUES
('nam', 0, 'S', 'Trang', 0.00),
('nam', 1, 'M', 'Den', 20000.00),
('nam', 2, 'L', 'Navy', 40000.00),
('nu', 0, 'S', 'Kem', 0.00),
('nu', 1, 'M', 'Hong', 20000.00),
('nu', 2, 'L', 'Do', 40000.00),
('tre-em', 0, '4Y', 'Xanh Duong', 0.00),
('tre-em', 1, '6Y', 'Vang', 10000.00),
('tre-em', 2, '8Y', 'Hong', 20000.00);

INSERT INTO product_variants (
    product_id,
    image_id,
    size,
    color,
    additional_price,
    stock_quantity,
    sku
)
SELECT
    p.id,
    pi.id,
    tvp.size_value,
    tvp.color_value,
    tvp.additional_price,
    CASE pi.display_order
        WHEN 0 THEN (p.stock_quantity / 3) + CASE WHEN MOD(p.stock_quantity, 3) > 0 THEN 1 ELSE 0 END
        WHEN 1 THEN (p.stock_quantity / 3) + CASE WHEN MOD(p.stock_quantity, 3) > 1 THEN 1 ELSE 0 END
        ELSE (p.stock_quantity / 3)
    END AS variant_stock,
    CONCAT(
        p.sku,
        '-',
        REPLACE(UPPER(tvp.color_value), ' ', ''),
        '-',
        UPPER(tvp.size_value)
    ) AS variant_sku
FROM products p
JOIN categories c ON c.id = p.category_id
JOIN product_images pi ON pi.product_id = p.id
JOIN tmp_variant_profile tvp
    ON tvp.category_slug = c.slug
   AND tvp.display_order = pi.display_order;

-- Re-sync product stock from variants for consistency
UPDATE products p
SET stock_quantity = pv.total_stock
FROM (
    SELECT product_id, SUM(stock_quantity) AS total_stock
    FROM product_variants
    GROUP BY product_id
) pv
WHERE pv.product_id = p.id;

-- -----------------------------------------------------------------------------
-- 7. Seed a few bestseller counts for storefront visuals
-- -----------------------------------------------------------------------------
UPDATE products SET sold_count = 50 WHERE slug IN ('ao-polo-classic-nam', 'dam-maxi-hoa', 'vay-cong-chua-be-gai');
UPDATE products SET sold_count = 45 WHERE slug IN ('ao-thun-oversize-nam', 'ao-croptop-nu', 'bo-the-thao-be-trai');
UPDATE products SET sold_count = 35 WHERE slug IN ('ao-hoodie-basic-nam', 'ao-cardigan-nu', 'vay-dam-be-gai-hoa');
UPDATE products SET sold_count = 30 WHERE slug IN ('ao-thun-basic-nam', 'ao-so-mi-lua-nu');
UPDATE products SET sold_count = 20 WHERE slug IN ('ao-so-mi-oxford', 'ao-kieu-cong-so');

DROP TABLE IF EXISTS tmp_product_catalog;
DROP TABLE IF EXISTS tmp_product_images;
DROP TABLE IF EXISTS tmp_variant_profile;

COMMIT;

-- -----------------------------------------------------------------------------
-- 8. Verification output
-- -----------------------------------------------------------------------------
SELECT c.slug AS category_slug, COUNT(*) AS product_count
FROM products p
JOIN categories c ON c.id = p.category_id
GROUP BY c.slug
ORDER BY c.display_order;

SELECT COUNT(*) AS total_products FROM products;
SELECT COUNT(*) AS total_images FROM product_images;
SELECT COUNT(*) AS total_variants FROM product_variants;
