-- PostgreSQL migration: create product image embeddings.
CREATE TABLE IF NOT EXISTS product_image_embeddings (
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

CREATE INDEX IF NOT EXISTS product_image_embeddings_idx_content_hash ON product_image_embeddings (content_hash);
