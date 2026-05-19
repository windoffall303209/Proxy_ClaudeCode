-- PostgreSQL migration: create review_media.
CREATE TABLE IF NOT EXISTS review_media (
    id SERIAL PRIMARY KEY,
    review_id INT NOT NULL,
    media_type VARCHAR(50) NOT NULL CHECK (media_type IN ('image', 'video')),
    media_url VARCHAR(500) NOT NULL,
    public_id VARCHAR(255) NULL,
    display_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_review_media_review
        FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS review_media_idx_review ON review_media (review_id);
