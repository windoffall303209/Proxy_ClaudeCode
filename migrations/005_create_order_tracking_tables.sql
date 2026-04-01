CREATE TABLE IF NOT EXISTS shipments (
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
);

CREATE TABLE IF NOT EXISTS order_tracking_events (
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
);

INSERT INTO shipments (order_id, current_status, last_event_at)
SELECT o.id, o.status, COALESCE(o.updated_at, o.created_at)
FROM orders o
LEFT JOIN shipments s ON s.order_id = o.id
WHERE s.id IS NULL;

INSERT INTO order_tracking_events (
    order_id, shipment_id, status, title, description, event_time, source
)
SELECT
    o.id,
    s.id,
    o.status,
    CASE o.status
        WHEN 'pending' THEN 'Đơn hàng đã được tạo'
        WHEN 'confirmed' THEN 'Đơn hàng đã được xác nhận'
        WHEN 'processing' THEN 'Đơn hàng đang được xử lý'
        WHEN 'shipping' THEN 'Đơn hàng đang được giao'
        WHEN 'delivered' THEN 'Đơn hàng đã giao thành công'
        WHEN 'cancelled' THEN 'Đơn hàng đã bị hủy'
        ELSE 'Cập nhật đơn hàng'
    END,
    CASE o.status
        WHEN 'pending' THEN 'Hệ thống đã ghi nhận đơn hàng và đang chờ xác nhận.'
        WHEN 'confirmed' THEN 'Đơn hàng đã được xác nhận và đang được chuẩn bị bàn giao vận chuyển.'
        WHEN 'processing' THEN 'Kho hàng đang đóng gói và chuẩn bị xuất kho.'
        WHEN 'shipping' THEN 'Đơn hàng đã rời kho và đang trên đường giao đến người nhận.'
        WHEN 'delivered' THEN 'Người nhận đã nhận được đơn hàng.'
        WHEN 'cancelled' THEN 'Đơn hàng đã được hủy theo cập nhật mới nhất.'
        ELSE 'Thông tin đơn hàng đã được cập nhật.'
    END,
    COALESCE(s.last_event_at, o.updated_at, o.created_at),
    'system'
FROM orders o
JOIN shipments s ON s.order_id = o.id
LEFT JOIN order_tracking_events ote ON ote.order_id = o.id
WHERE ote.id IS NULL;
