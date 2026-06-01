// Model truy vấn và chuẩn hóa dữ liệu returnrequest trong MySQL.
const pool = require('../config/database');

const RETURN_STATUSES = ['pending', 'approved', 'rejected', 'resolved'];

class ReturnRequest {
    // Chuẩn hóa trạng thái.
    static normalizeStatus(status) {
        const normalized = String(status || 'pending').trim().toLowerCase();
        return RETURN_STATUSES.includes(normalized) ? normalized : 'pending';
    }

    // Thao tác với attach media.
    static async attachMedia(request) {
        if (!request) {
            return null;
        }

        let media = [];
        try {
            [media] = await pool.execute(
                `SELECT *
                 FROM order_return_media
                 WHERE return_request_id = ?
                 ORDER BY display_order ASC, id ASC`,
                [request.id]
            );
        } catch (error) {
            if (error?.code !== 'ER_NO_SUCH_TABLE') {
                throw error;
            }
        }
        request.media = media;
        return request;
    }

    // Tạo bản ghi mới.
    static async create({ orderId, userId, reason, media = [] }) {
        const connection = await pool.getConnection();

        try {
            await connection.beginTransaction();
            const [result] = await connection.execute(
                `INSERT INTO order_return_requests (order_id, user_id, reason, status)
                 VALUES (?, ?, ?, 'pending')`,
                [orderId, userId, reason]
            );

            const requestId = result.insertId;
            for (const [index, item] of media.entries()) {
                await connection.execute(
                    `INSERT INTO order_return_media (
                        return_request_id, media_type, media_url, public_id, display_order
                    ) VALUES (?, ?, ?, ?, ?)`,
                    [
                        requestId,
                        item.mediaType || item.media_type,
                        item.mediaUrl || item.media_url,
                        item.publicId || item.public_id || null,
                        Number.isInteger(item.displayOrder) ? item.displayOrder : index
                    ]
                );
            }

            await connection.commit();
            return this.findById(requestId);
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    // Tìm theo đơn hàng ID.
    static async findByOrderId(orderId) {
        let rows = [];
        try {
            [rows] = await pool.execute(
                `SELECT rr.*, o.order_code, u.full_name AS user_name, u.email AS user_email
                 FROM order_return_requests rr
                 JOIN orders o ON rr.order_id = o.id
                 JOIN users u ON rr.user_id = u.id
                 WHERE rr.order_id = ?
                 ORDER BY rr.created_at DESC, rr.id DESC
                 LIMIT 1`,
                [orderId]
            );
        } catch (error) {
            if (error?.code === 'ER_NO_SUCH_TABLE') {
                return null;
            }
            throw error;
        }

        return this.attachMedia(rows[0] || null);
    }

    // Tìm theo ID.
    static async findById(id) {
        const [rows] = await pool.execute(
            `SELECT rr.*,
                    o.order_code,
                    o.final_amount,
                    o.status AS order_status,
                    u.full_name AS user_name,
                    u.email AS user_email,
                    reviewer.full_name AS reviewed_by_name
             FROM order_return_requests rr
             JOIN orders o ON rr.order_id = o.id
             JOIN users u ON rr.user_id = u.id
             LEFT JOIN users reviewer ON rr.reviewed_by = reviewer.id
             WHERE rr.id = ?
             LIMIT 1`,
            [id]
        );

        return this.attachMedia(rows[0] || null);
    }

    // Tìm tất cả.
    static async findAll(filters = {}) {
        let query = `
            SELECT rr.*,
                   o.order_code,
                   o.final_amount,
                   o.status AS order_status,
                   u.full_name AS user_name,
                   u.email AS user_email,
                   reviewer.full_name AS reviewed_by_name,
                   (SELECT COUNT(*) FROM order_return_media rm WHERE rm.return_request_id = rr.id) AS media_count
            FROM order_return_requests rr
            JOIN orders o ON rr.order_id = o.id
            JOIN users u ON rr.user_id = u.id
            LEFT JOIN users reviewer ON rr.reviewed_by = reviewer.id
            WHERE 1 = 1
        `;
        const params = [];

        if (filters.status) {
            query += ' AND rr.status = ?';
            params.push(this.normalizeStatus(filters.status));
        }

        query += ' ORDER BY rr.created_at DESC, rr.id DESC';

        if (filters.limit) {
            const limit = Number.parseInt(filters.limit, 10) || 50;
            const offset = Number.parseInt(filters.offset, 10) || 0;
            query += ` LIMIT ${limit} OFFSET ${offset}`;
        }

        let rows = [];
        try {
            [rows] = await pool.query(query, params);
        } catch (error) {
            if (error?.code === 'ER_NO_SUCH_TABLE') {
                return [];
            }
            throw error;
        }
        for (const row of rows) {
            await this.attachMedia(row);
        }
        return rows;
    }

    // Đếm số yêu cầu theo trạng thái để hiển thị badge bộ lọc.
    static async countByStatus() {
        const counts = RETURN_STATUSES.reduce((result, status) => {
            result[status] = 0;
            return result;
        }, { all: 0 });

        try {
            const [rows] = await pool.execute(
                `SELECT status, COUNT(*) AS total
                 FROM order_return_requests
                 GROUP BY status`
            );

            rows.forEach((row) => {
                const total = Number.parseInt(row.total, 10) || 0;
                const status = this.normalizeStatus(row.status);
                counts[status] += total;
                counts.all += total;
            });
        } catch (error) {
            if (error?.code === 'ER_NO_SUCH_TABLE') {
                return counts;
            }
            throw error;
        }

        return counts;
    }

    // Cập nhật trạng thái.
    static async updateStatus(id, status, adminNote = null, reviewedBy = null) {
        const normalizedStatus = this.normalizeStatus(status);
        await pool.execute(
            `UPDATE order_return_requests
             SET status = ?, admin_note = ?, reviewed_by = ?, reviewed_at = NOW()
             WHERE id = ?`,
            [normalizedStatus, adminNote || null, reviewedBy || null, id]
        );

        return this.findById(id);
    }
}

module.exports = ReturnRequest;
