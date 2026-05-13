-- File migrations/011_add_payment_completion_and_returns.sql: dinh nghia thay doi hoac cau truc du lieu cho he thong.
ALTER TABLE orders
    MODIFY status ENUM('pending_payment', 'pending', 'confirmed', 'processing', 'shipping', 'delivered', 'completed', 'cancelled') DEFAULT 'pending';

ALTER TABLE shipments
    MODIFY current_status ENUM('pending_payment', 'pending', 'confirmed', 'processing', 'shipping', 'delivered', 'completed', 'cancelled') DEFAULT 'pending';

ALTER TABLE order_tracking_events
    MODIFY status ENUM('pending_payment', 'pending', 'confirmed', 'processing', 'shipping', 'delivered', 'completed', 'cancelled') NOT NULL,
    MODIFY source ENUM('system', 'admin', 'carrier', 'user') DEFAULT 'system';

CREATE TABLE IF NOT EXISTS order_return_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    user_id INT NOT NULL,
    reason TEXT NOT NULL,
    status ENUM('pending', 'approved', 'rejected', 'resolved') DEFAULT 'pending',
    admin_note TEXT NULL,
    reviewed_by INT NULL,
    reviewed_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_return_order (order_id),
    INDEX idx_return_user (user_id),
    INDEX idx_return_status (status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS order_return_media (
    id INT AUTO_INCREMENT PRIMARY KEY,
    return_request_id INT NOT NULL,
    media_type ENUM('image', 'video') NOT NULL,
    media_url VARCHAR(500) NOT NULL,
    public_id VARCHAR(255) NULL,
    display_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (return_request_id) REFERENCES order_return_requests(id) ON DELETE CASCADE,
    INDEX idx_return_media_request (return_request_id)
) ENGINE=InnoDB;
