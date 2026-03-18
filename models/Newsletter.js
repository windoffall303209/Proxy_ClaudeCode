/**
 * =============================================================================
 * NEWSLETTER MODEL - Model Đăng ký nhận tin khuyến mãi
 * =============================================================================
 * File này chứa các phương thức quản lý danh sách email đăng ký nhận
 * thông báo khuyến mãi từ cửa hàng.
 * =============================================================================
 */

const pool = require('../config/database');

class Newsletter {
    /**
     * Đăng ký email nhận tin khuyến mãi
     *
     * @param {string} email - Email đăng ký
     * @param {number|null} userId - ID người dùng (nếu đã đăng nhập)
     *
     * @returns {Promise<Object>} Thông tin đăng ký
     */
    static async subscribe(email, userId = null) {
        // Kiểm tra email đã đăng ký chưa
        const existing = await this.findByEmail(email);

        if (existing) {
            // Nếu đã đăng ký và đang active
            if (existing.is_active) {
                return { success: false, message: 'Email này đã đăng ký nhận tin rồi' };
            }

            // Nếu đã hủy đăng ký, kích hoạt lại
            await pool.execute(
                'UPDATE newsletter_subscribers SET is_active = TRUE, unsubscribed_at = NULL, user_id = ? WHERE id = ?',
                [userId, existing.id]
            );
            return { success: true, message: 'Đăng ký nhận tin thành công!', reactivated: true };
        }

        // Thêm email mới
        const query = 'INSERT INTO newsletter_subscribers (email, user_id) VALUES (?, ?)';
        const [result] = await pool.execute(query, [email, userId]);

        return {
            success: true,
            message: 'Đăng ký nhận tin thành công!',
            id: result.insertId
        };
    }

    /**
     * Hủy đăng ký nhận tin
     *
     * @param {string} email - Email cần hủy
     *
     * @returns {Promise<Object>} Kết quả hủy đăng ký
     */
    static async unsubscribe(email) {
        const existing = await this.findByEmail(email);

        if (!existing || !existing.is_active) {
            return { success: false, message: 'Email này chưa đăng ký nhận tin' };
        }

        await pool.execute(
            'UPDATE newsletter_subscribers SET is_active = FALSE, unsubscribed_at = NOW() WHERE email = ?',
            [email]
        );

        return { success: true, message: 'Đã hủy đăng ký nhận tin thành công' };
    }

    /**
     * Tìm email trong danh sách đăng ký
     *
     * @param {string} email - Email cần tìm
     *
     * @returns {Promise<Object|null>} Thông tin đăng ký hoặc null
     */
    static async findByEmail(email) {
        const query = 'SELECT * FROM newsletter_subscribers WHERE email = ?';
        const [rows] = await pool.execute(query, [email]);
        return rows[0] || null;
    }

    /**
     * Kiểm tra user đã đăng ký nhận tin chưa
     *
     * @param {number} userId - ID người dùng
     *
     * @returns {Promise<boolean>} true nếu đã đăng ký và đang active
     */
    static async isUserSubscribed(userId) {
        const query = 'SELECT id FROM newsletter_subscribers WHERE user_id = ? AND is_active = TRUE';
        const [rows] = await pool.execute(query, [userId]);
        return rows.length > 0;
    }

    /**
     * Kiểm tra email đã đăng ký nhận tin chưa
     *
     * @param {string} email - Email cần kiểm tra
     *
     * @returns {Promise<boolean>} true nếu đã đăng ký và đang active
     */
    static async isEmailSubscribed(email) {
        const query = 'SELECT id FROM newsletter_subscribers WHERE email = ? AND is_active = TRUE';
        const [rows] = await pool.execute(query, [email]);
        return rows.length > 0;
    }

    /**
     * Lấy danh sách tất cả email đang active (Admin)
     *
     * @param {Object} filters - Bộ lọc
     * @param {number} filters.limit - Số lượng tối đa
     * @param {number} filters.offset - Bỏ qua bao nhiêu
     *
     * @returns {Promise<Array>} Mảng thông tin đăng ký
     */
    static async getActiveSubscribers(filters = {}) {
        let query = `
            SELECT ns.*, u.full_name as user_name
            FROM newsletter_subscribers ns
            LEFT JOIN users u ON ns.user_id = u.id
            WHERE ns.is_active = TRUE
            ORDER BY ns.subscribed_at DESC
        `;

        if (filters.limit) {
            const limit = parseInt(filters.limit) || 50;
            const offset = parseInt(filters.offset) || 0;
            query += ` LIMIT ${limit} OFFSET ${offset}`;
        }

        const [rows] = await pool.query(query);
        return rows;
    }

    /**
     * Đếm số lượng subscribers
     *
     * @returns {Promise<number>} Số lượng email đang active
     */
    static async countActive() {
        const query = 'SELECT COUNT(*) as total FROM newsletter_subscribers WHERE is_active = TRUE';
        const [rows] = await pool.execute(query);
        return rows[0].total;
    }

    /**
     * Liên kết email với user_id (khi user đăng nhập)
     *
     * @param {string} email - Email cần liên kết
     * @param {number} userId - ID người dùng
     */
    static async linkToUser(email, userId) {
        await pool.execute(
            'UPDATE newsletter_subscribers SET user_id = ? WHERE email = ? AND user_id IS NULL',
            [userId, email]
        );
    }
}

module.exports = Newsletter;
