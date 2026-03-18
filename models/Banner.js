/**
 * =============================================================================
 * BANNER MODEL - Model Banner quảng cáo
 * =============================================================================
 * File này chứa các phương thức tương tác với bảng banners trong database:
 * - Lấy banner đang hoạt động (cho carousel trang chủ)
 * - Lấy tất cả banner (Admin)
 * - Tìm banner theo ID
 * - CRUD banner (Tạo, Đọc, Cập nhật, Xóa)
 * =============================================================================
 */

const pool = require('../config/database');

class Banner {
    // =============================================================================
    // LẤY BANNER ĐANG HOẠT ĐỘNG - GET ACTIVE BANNERS
    // =============================================================================

    /**
     * Lấy danh sách banner đang hoạt động
     *
     * @description Lấy các banner thỏa mãn điều kiện:
     *              - is_active = TRUE
     *              - Trong khoảng thời gian hiển thị (start_date đến end_date)
     *              - Hoặc không có giới hạn thời gian (start_date/end_date là NULL)
     *              Sắp xếp theo thứ tự hiển thị (display_order).
     *              Dùng cho carousel trên trang chủ.
     *
     * @returns {Promise<Array>} Mảng banner đang hoạt động
     */
    static async getActiveBanners() {
        const query = `
            SELECT * FROM banners
            WHERE is_active = TRUE
              AND (start_date IS NULL OR NOW() >= start_date)
              AND (end_date IS NULL OR NOW() <= end_date)
            ORDER BY display_order ASC
        `;
        const [rows] = await pool.execute(query);
        return rows;
    }

    // =============================================================================
    // LẤY TẤT CẢ BANNER (ADMIN) - FIND ALL BANNERS
    // =============================================================================

    /**
     * Lấy tất cả banner (Admin)
     *
     * @description Lấy toàn bộ banner bao gồm cả đã ẩn và hết hạn.
     *              Dùng cho trang quản lý banner của Admin.
     *              Sắp xếp theo thứ tự hiển thị và ngày tạo.
     *
     * @returns {Promise<Array>} Mảng tất cả banner
     */
    static async findAll() {
        const query = 'SELECT * FROM banners ORDER BY display_order ASC, created_at DESC';
        const [rows] = await pool.execute(query);
        return rows;
    }

    // =============================================================================
    // TÌM BANNER THEO ID - FIND BY ID
    // =============================================================================

    /**
     * Tìm banner theo ID
     *
     * @description Lấy thông tin chi tiết của một banner
     *
     * @param {number} id - ID banner
     *
     * @returns {Promise<Object|null>} Thông tin banner hoặc null
     */
    static async findById(id) {
        const query = 'SELECT * FROM banners WHERE id = ?';
        const [rows] = await pool.execute(query, [id]);
        return rows[0] || null;
    }

    // =============================================================================
    // TẠO BANNER MỚI - CREATE BANNER
    // =============================================================================

    /**
     * Tạo banner quảng cáo mới
     *
     * @description Thêm một banner mới vào database.
     *              Banner có thể có lịch hiển thị tự động theo thời gian.
     *
     * @param {Object} bannerData - Dữ liệu banner
     * @param {string} bannerData.title - Tiêu đề chính
     * @param {string} [bannerData.subtitle] - Tiêu đề phụ
     * @param {string} [bannerData.description] - Mô tả chi tiết
     * @param {string} bannerData.image_url - URL ảnh banner
     * @param {string} [bannerData.link_url] - URL khi click vào banner
     * @param {string} [bannerData.button_text='Xem ngay'] - Text nút CTA
     * @param {number} [bannerData.display_order=0] - Thứ tự hiển thị
     * @param {string} [bannerData.start_date] - Ngày bắt đầu hiển thị (YYYY-MM-DD)
     * @param {string} [bannerData.end_date] - Ngày kết thúc hiển thị (YYYY-MM-DD)
     *
     * @returns {Promise<Object>} Banner vừa tạo với ID
     */
    static async create(bannerData) {
        const { title, subtitle, description, image_url, link_url, button_text, display_order, start_date, end_date } = bannerData;

        const query = `
            INSERT INTO banners (title, subtitle, description, image_url, link_url, button_text, display_order, start_date, end_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const [result] = await pool.execute(query, [
            title,
            subtitle || null,
            description || null,
            image_url,
            link_url || null,
            button_text || 'Xem ngay',
            display_order || 0,
            start_date || null,
            end_date || null
        ]);

        return { id: result.insertId, ...bannerData };
    }

    // =============================================================================
    // CẬP NHẬT BANNER - UPDATE BANNER
    // =============================================================================

    /**
     * Cập nhật thông tin banner
     *
     * @description Cập nhật tất cả thông tin của banner
     *
     * @param {number} id - ID banner cần cập nhật
     * @param {Object} bannerData - Dữ liệu cập nhật
     * @param {boolean} [bannerData.is_active=true] - Trạng thái hoạt động
     *
     * @returns {Promise<Object>} Banner sau khi cập nhật
     */
    static async update(id, bannerData) {
        const { title, subtitle, description, image_url, link_url, button_text, display_order, is_active, start_date, end_date } = bannerData;

        const query = `
            UPDATE banners
            SET title = ?, subtitle = ?, description = ?, image_url = ?, link_url = ?,
                button_text = ?, display_order = ?, is_active = ?, start_date = ?, end_date = ?
            WHERE id = ?
        `;

        await pool.execute(query, [
            title,
            subtitle || null,
            description || null,
            image_url,
            link_url || null,
            button_text || 'Xem ngay',
            display_order || 0,
            is_active !== undefined ? is_active : true,
            start_date || null,
            end_date || null,
            id
        ]);

        return await this.findById(id);
    }

    // =============================================================================
    // XÓA BANNER - DELETE BANNER (HARD DELETE)
    // =============================================================================

    /**
     * Xóa banner vĩnh viễn
     *
     * @description Xóa thật sự banner khỏi database.
     *              Khác với sản phẩm/danh mục, banner được xóa vĩnh viễn
     *              vì không cần giữ lại cho báo cáo.
     *
     * @param {number} id - ID banner cần xóa
     *
     * @returns {Promise<void>}
     */
    static async delete(id) {
        const query = 'DELETE FROM banners WHERE id = ?';
        await pool.execute(query, [id]);
    }
}

module.exports = Banner;
