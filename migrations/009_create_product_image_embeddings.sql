-- Visual search: multimodal image embeddings (e.g. NVIDIA NV-CLIP) for product primary images
-- Run: mysql -u root -p tmdt_ecommerce < migrations/009_create_product_image_embeddings.sql

CREATE TABLE IF NOT EXISTS product_image_embeddings (
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
    KEY idx_content_hash (content_hash),
    CONSTRAINT fk_pie_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
