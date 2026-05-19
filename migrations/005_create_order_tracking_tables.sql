-- PostgreSQL migration: create order tracking tables.
CREATE TABLE IF NOT EXISTS shipments (
    id SERIAL PRIMARY KEY,
    order_id INT NOT NULL,
    carrier VARCHAR(100) NULL,
    tracking_code VARCHAR(100) NULL,
    tracking_url VARCHAR(500) NULL,
    current_status VARCHAR(50) DEFAULT 'pending' CHECK (current_status IN ('pending', 'confirmed', 'processing', 'shipping', 'delivered', 'cancelled')),
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

CREATE INDEX IF NOT EXISTS shipments_idx_tracking_code ON shipments (tracking_code);
CREATE INDEX IF NOT EXISTS shipments_idx_status ON shipments (current_status);

CREATE TABLE IF NOT EXISTS order_tracking_events (
    id SERIAL PRIMARY KEY,
    order_id INT NOT NULL,
    shipment_id INT NULL,
    status VARCHAR(50) NOT NULL CHECK (status IN ('pending', 'confirmed', 'processing', 'shipping', 'delivered', 'cancelled')),
    title VARCHAR(255) NOT NULL,
    description TEXT NULL,
    location_text VARCHAR(255) NULL,
    lat DECIMAL(10, 7) NULL,
    lng DECIMAL(10, 7) NULL,
    event_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    source VARCHAR(50) DEFAULT 'system' CHECK (source IN ('system', 'admin', 'carrier')),
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (shipment_id) REFERENCES shipments(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS order_tracking_events_idx_order ON order_tracking_events (order_id);
CREATE INDEX IF NOT EXISTS order_tracking_events_idx_shipment ON order_tracking_events (shipment_id);
CREATE INDEX IF NOT EXISTS order_tracking_events_idx_event_time ON order_tracking_events (event_time);

INSERT INTO shipments (order_id, current_status, last_event_at)
SELECT o.id, o.status, COALESCE(o.updated_at, o.created_at)
FROM orders o
LEFT JOIN shipments s ON s.order_id = o.id
WHERE s.id IS NULL;

INSERT INTO order_tracking_events (order_id, shipment_id, status, title, description, event_time, source)
SELECT
    o.id,
    s.id,
    o.status,
    CASE o.status
        WHEN 'pending' THEN 'Don hang da duoc tao'
        WHEN 'confirmed' THEN 'Don hang da duoc xac nhan'
        WHEN 'processing' THEN 'Don hang dang duoc xu ly'
        WHEN 'shipping' THEN 'Don hang dang duoc giao'
        WHEN 'delivered' THEN 'Don hang da giao thanh cong'
        WHEN 'cancelled' THEN 'Don hang da bi huy'
        ELSE 'Cap nhat don hang'
    END,
    CASE o.status
        WHEN 'pending' THEN 'He thong da ghi nhan don hang va dang cho xac nhan.'
        WHEN 'confirmed' THEN 'Don hang da duoc xac nhan va dang duoc chuan bi ban giao van chuyen.'
        WHEN 'processing' THEN 'Kho hang dang dong goi va chuan bi xuat kho.'
        WHEN 'shipping' THEN 'Don hang da roi kho va dang tren duong giao den nguoi nhan.'
        WHEN 'delivered' THEN 'Nguoi nhan da nhan duoc don hang.'
        WHEN 'cancelled' THEN 'Don hang da duoc huy theo cap nhat moi nhat.'
        ELSE 'Thong tin don hang da duoc cap nhat.'
    END,
    COALESCE(s.last_event_at, o.updated_at, o.created_at),
    'system'
FROM orders o
JOIN shipments s ON s.order_id = o.id
LEFT JOIN order_tracking_events ote ON ote.order_id = o.id
WHERE ote.id IS NULL;
