-- PostgreSQL migration: add payment completion and returns.
ALTER TABLE orders DROP CONSTRAINT IF EXISTS chk_orders_status;
ALTER TABLE orders
    ALTER COLUMN status TYPE VARCHAR(50),
    ALTER COLUMN status SET DEFAULT 'pending';
ALTER TABLE orders ADD CONSTRAINT chk_orders_status CHECK (status IN ('pending_payment', 'pending', 'confirmed', 'processing', 'shipping', 'delivered', 'completed', 'cancelled'));

ALTER TABLE shipments DROP CONSTRAINT IF EXISTS chk_shipments_current_status;
ALTER TABLE shipments
    ALTER COLUMN current_status TYPE VARCHAR(50),
    ALTER COLUMN current_status SET DEFAULT 'pending';
ALTER TABLE shipments ADD CONSTRAINT chk_shipments_current_status CHECK (current_status IN ('pending_payment', 'pending', 'confirmed', 'processing', 'shipping', 'delivered', 'completed', 'cancelled'));

ALTER TABLE order_tracking_events DROP CONSTRAINT IF EXISTS chk_order_tracking_events_status;
ALTER TABLE order_tracking_events DROP CONSTRAINT IF EXISTS chk_order_tracking_events_source;
ALTER TABLE order_tracking_events
    ALTER COLUMN status TYPE VARCHAR(50),
    ALTER COLUMN status SET NOT NULL,
    ALTER COLUMN source TYPE VARCHAR(50),
    ALTER COLUMN source SET DEFAULT 'system';
ALTER TABLE order_tracking_events ADD CONSTRAINT chk_order_tracking_events_status CHECK (status IN ('pending_payment', 'pending', 'confirmed', 'processing', 'shipping', 'delivered', 'completed', 'cancelled'));
ALTER TABLE order_tracking_events ADD CONSTRAINT chk_order_tracking_events_source CHECK (source IN ('system', 'admin', 'carrier', 'user'));

CREATE TABLE IF NOT EXISTS order_return_requests (
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

CREATE INDEX IF NOT EXISTS order_return_requests_idx_order ON order_return_requests (order_id);
CREATE INDEX IF NOT EXISTS order_return_requests_idx_user ON order_return_requests (user_id);
CREATE INDEX IF NOT EXISTS order_return_requests_idx_status ON order_return_requests (status);

CREATE TABLE IF NOT EXISTS order_return_media (
    id SERIAL PRIMARY KEY,
    return_request_id INT NOT NULL,
    media_type VARCHAR(50) NOT NULL CHECK (media_type IN ('image', 'video')),
    media_url VARCHAR(500) NOT NULL,
    public_id VARCHAR(255) NULL,
    display_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (return_request_id) REFERENCES order_return_requests(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS order_return_media_idx_request ON order_return_media (return_request_id);
