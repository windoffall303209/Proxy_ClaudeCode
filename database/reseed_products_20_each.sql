-- File database/reseed_products_20_each.sql: dinh nghia thay doi hoac cau truc du lieu cho he thong.
USE tmdt_ecommerce;

START TRANSACTION;

-- Ensure required categories exist
INSERT INTO categories (name, slug, description, image_url, display_order, is_active)
SELECT 'Thoi Trang Nam', 'nam', 'Quan ao va phu kien nam', 'https://images.unsplash.com/photo-1490114538077-0a7f8cb49891?w=900', 1, TRUE
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'nam');

INSERT INTO categories (name, slug, description, image_url, display_order, is_active)
SELECT 'Thoi Trang Nu', 'nu', 'Quan ao va phu kien nu', 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=900', 2, TRUE
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'nu');

INSERT INTO categories (name, slug, description, image_url, display_order, is_active)
SELECT 'Thoi Trang Tre Em', 'tre-em', 'Quan ao tre em', 'https://images.unsplash.com/photo-1503944583220-79d8926ad5e2?w=900', 3, TRUE
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'tre-em');

-- Delete product-related data so products can be recreated cleanly
DELETE FROM cart_items;
DELETE FROM order_items;
DELETE FROM voucher_products;
DELETE FROM product_variants;
DELETE FROM product_images;
DELETE FROM products;

ALTER TABLE products AUTO_INCREMENT = 1;
ALTER TABLE product_images AUTO_INCREMENT = 1;
ALTER TABLE product_variants AUTO_INCREMENT = 1;

DROP TEMPORARY TABLE IF EXISTS tmp_numbers;
CREATE TEMPORARY TABLE tmp_numbers (
    n INT PRIMARY KEY
);

INSERT INTO tmp_numbers (n) VALUES
(1),(2),(3),(4),(5),(6),(7),(8),(9),(10),
(11),(12),(13),(14),(15),(16),(17),(18),(19),(20);

-- 20 products for category: nam
INSERT INTO products (
    category_id,
    name,
    slug,
    description,
    price,
    stock_quantity,
    sku,
    is_active,
    is_featured
)
SELECT
    c.id,
    CONCAT('Nam Urban Tee ', LPAD(t.n, 2, '0')),
    CONCAT('nam-urban-tee-', LPAD(t.n, 2, '0')),
    CONCAT('Nam urban style tee version ', LPAD(t.n, 2, '0'), '. Soft cotton and regular fit.'),
    320000 + (t.n * 12000),
    0,
    CONCAT('NEW-NAM-', LPAD(t.n, 2, '0')),
    TRUE,
    IF(t.n <= 6, TRUE, FALSE)
FROM tmp_numbers t
JOIN categories c ON c.slug = 'nam';

-- 20 products for category: nu
INSERT INTO products (
    category_id,
    name,
    slug,
    description,
    price,
    stock_quantity,
    sku,
    is_active,
    is_featured
)
SELECT
    c.id,
    CONCAT('Nu Chic Dress ', LPAD(t.n, 2, '0')),
    CONCAT('nu-chic-dress-', LPAD(t.n, 2, '0')),
    CONCAT('Nu chic dress model ', LPAD(t.n, 2, '0'), '. Breathable fabric and elegant silhouette.'),
    390000 + (t.n * 15000),
    0,
    CONCAT('NEW-NU-', LPAD(t.n, 2, '0')),
    TRUE,
    IF(t.n <= 6, TRUE, FALSE)
FROM tmp_numbers t
JOIN categories c ON c.slug = 'nu';

-- 20 products for category: tre-em
INSERT INTO products (
    category_id,
    name,
    slug,
    description,
    price,
    stock_quantity,
    sku,
    is_active,
    is_featured
)
SELECT
    c.id,
    CONCAT('Tre Em Active Set ', LPAD(t.n, 2, '0')),
    CONCAT('tre-em-active-set-', LPAD(t.n, 2, '0')),
    CONCAT('Tre em active set ', LPAD(t.n, 2, '0'), '. Lightweight and easy to move.'),
    260000 + (t.n * 9000),
    0,
    CONCAT('NEW-KID-', LPAD(t.n, 2, '0')),
    TRUE,
    IF(t.n <= 6, TRUE, FALSE)
FROM tmp_numbers t
JOIN categories c ON c.slug = 'tre-em';

DROP TEMPORARY TABLE IF EXISTS tmp_colors;
CREATE TEMPORARY TABLE tmp_colors (
    category_slug VARCHAR(20) NOT NULL,
    color_name VARCHAR(50) NOT NULL,
    image_order INT NOT NULL,
    base_url VARCHAR(600) NOT NULL,
    PRIMARY KEY (category_slug, image_order)
);

-- 3 color images per category (real Unsplash image links)
INSERT INTO tmp_colors (category_slug, color_name, image_order, base_url) VALUES
('nam', 'Navy', 0, 'https://images.unsplash.com/photo-1586790170083-2f9ceadc732d?auto=format&fit=crop&w=900&q=80'),
('nam', 'Black', 1, 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80'),
('nam', 'Beige', 2, 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=900&q=80'),
('nu', 'Red', 0, 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=900&q=80'),
('nu', 'Pink', 1, 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=900&q=80'),
('nu', 'White', 2, 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=900&q=80'),
('tre-em', 'Blue', 0, 'https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?auto=format&fit=crop&w=900&q=80'),
('tre-em', 'Yellow', 1, 'https://images.unsplash.com/photo-1518831959646-742c3a14ebf7?auto=format&fit=crop&w=900&q=80'),
('tre-em', 'Mint', 2, 'https://images.unsplash.com/photo-1503944583220-79d8926ad5e2?auto=format&fit=crop&w=900&q=80');

-- Insert exactly 3 images per product, each image maps to one color
INSERT INTO product_images (product_id, image_url, is_primary, display_order)
SELECT
    p.id,
    CONCAT(tc.base_url, '&sig=', p.id * 10 + tc.image_order),
    IF(tc.image_order = 0, TRUE, FALSE),
    tc.image_order
FROM products p
JOIN categories c ON c.id = p.category_id
JOIN tmp_colors tc ON tc.category_slug = c.slug
WHERE p.sku LIKE 'NEW-NAM-%' OR p.sku LIKE 'NEW-NU-%' OR p.sku LIKE 'NEW-KID-%';

DROP TEMPORARY TABLE IF EXISTS tmp_sizes;
CREATE TEMPORARY TABLE tmp_sizes (
    category_slug VARCHAR(20) NOT NULL,
    size_value VARCHAR(20) NOT NULL,
    PRIMARY KEY (category_slug, size_value)
);

-- 3 sizes for each category. Each color-image gets all sizes as variants.
INSERT INTO tmp_sizes (category_slug, size_value) VALUES
('nam', 'S'), ('nam', 'M'), ('nam', 'L'),
('nu', 'S'), ('nu', 'M'), ('nu', 'L'),
('tre-em', '4Y'), ('tre-em', '6Y'), ('tre-em', '8Y');

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
    ts.size_value,
    tc.color_name,
    CASE
        WHEN ts.size_value IN ('M', '6Y') THEN 20000
        WHEN ts.size_value IN ('L', '8Y') THEN 40000
        ELSE 0
    END AS additional_price,
    20,
    CONCAT('VAR-', p.sku, '-', UPPER(tc.color_name), '-', UPPER(ts.size_value))
FROM products p
JOIN categories c ON c.id = p.category_id
JOIN product_images pi ON pi.product_id = p.id
JOIN tmp_colors tc ON tc.category_slug = c.slug AND tc.image_order = pi.display_order
JOIN tmp_sizes ts ON ts.category_slug = c.slug
WHERE p.sku LIKE 'NEW-NAM-%' OR p.sku LIKE 'NEW-NU-%' OR p.sku LIKE 'NEW-KID-%';

-- Product stock = sum of variant stock for consistency
UPDATE products p
JOIN (
    SELECT product_id, SUM(stock_quantity) AS total_stock
    FROM product_variants
    GROUP BY product_id
) v ON v.product_id = p.id
SET p.stock_quantity = v.total_stock
WHERE p.sku LIKE 'NEW-NAM-%' OR p.sku LIKE 'NEW-NU-%' OR p.sku LIKE 'NEW-KID-%';

DROP TEMPORARY TABLE IF EXISTS tmp_numbers;
DROP TEMPORARY TABLE IF EXISTS tmp_colors;
DROP TEMPORARY TABLE IF EXISTS tmp_sizes;

COMMIT;

-- Verification output
SELECT c.slug AS category_slug, COUNT(*) AS product_count
FROM products p
JOIN categories c ON c.id = p.category_id
WHERE p.sku LIKE 'NEW-NAM-%' OR p.sku LIKE 'NEW-NU-%' OR p.sku LIKE 'NEW-KID-%'
GROUP BY c.slug;

SELECT COUNT(*) AS total_new_products
FROM products
WHERE sku LIKE 'NEW-NAM-%' OR sku LIKE 'NEW-NU-%' OR sku LIKE 'NEW-KID-%';

SELECT COUNT(*) AS total_new_images
FROM product_images pi
JOIN products p ON p.id = pi.product_id
WHERE p.sku LIKE 'NEW-NAM-%' OR p.sku LIKE 'NEW-NU-%' OR p.sku LIKE 'NEW-KID-%';

SELECT COUNT(*) AS total_new_variants
FROM product_variants pv
JOIN products p ON p.id = pv.product_id
WHERE p.sku LIKE 'NEW-NAM-%' OR p.sku LIKE 'NEW-NU-%' OR p.sku LIKE 'NEW-KID-%';
