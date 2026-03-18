/**
 * =============================================================================
 * SALE MODEL - Model Chương trình khuyến mãi
 * =============================================================================
 * File này chứa các phương thức tương tác với bảng sales trong database:
 * - Lấy danh sách chương trình khuyến mãi
 * - Lấy khuyến mãi đang hoạt động
 * - CRUD khuyến mãi (Tạo, Đọc, Cập nhật, Xóa)
 * - Tự động kích hoạt/vô hiệu hóa theo lịch
 * =============================================================================
 */

const pool = require('../config/database');

class Sale {
    // =============================================================================
    // LẤY TẤT CẢ KHUYẾN MÃI - FIND ALL SALES
    // =============================================================================

    /**
     * Lấy danh sách chương trình khuyến mãi
     *
     * @description Lấy tất cả hoặc chỉ các khuyến mãi đang hoạt động.
     *              Khuyến mãi đang hoạt động là những chương trình:
     *              - is_active = TRUE
     *              - Thời gian hiện tại nằm trong khoảng start_date đến end_date
     *
     * @param {boolean} [activeOnly=false] - true = chỉ lấy đang hoạt động
     *
     * @returns {Promise<Array>} Mảng chương trình khuyến mãi
     */
    static async findAll(filters = {}) {
        const normalizedFilters = typeof filters === 'boolean'
            ? { activeOnly: filters }
            : (filters || {});
        let query = 'SELECT * FROM sales WHERE 1=1';
        const params = [];

        // Lọc chỉ lấy khuyến mãi đang hoạt động
        if (normalizedFilters.activeOnly) {
            query += ' AND is_active = TRUE AND NOW() BETWEEN start_date AND end_date';
        }

        if (normalizedFilters.search) {
            query += ' AND (name LIKE ? OR COALESCE(description, \'\') LIKE ? OR type LIKE ?)';
            const searchTerm = `%${normalizedFilters.search}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }

        query += ' ORDER BY created_at DESC';

        const [rows] = await pool.query(query, params);
        return rows;
    }

    // =============================================================================
    // TÌM KHUYẾN MÃI THEO ID - FIND BY ID
    // =============================================================================

    /**
     * Tìm khuyến mãi theo ID
     *
     * @description Lấy thông tin chi tiết của một chương trình khuyến mãi
     *
     * @param {number} id - ID khuyến mãi
     *
     * @returns {Promise<Object|null>} Thông tin khuyến mãi hoặc null
     */
    static async findById(id) {
        const query = 'SELECT * FROM sales WHERE id = ?';
        const [rows] = await pool.execute(query, [id]);
        return rows[0] || null;
    }

    // =============================================================================
    // LẤY KHUYẾN MÃI ĐANG HOẠT ĐỘNG - GET ACTIVE SALES
    // =============================================================================

    /**
     * Lấy các chương trình khuyến mãi đang hoạt động
     *
     * @description Shortcut để gọi findAll(true)
     *
     * @returns {Promise<Array>} Mảng khuyến mãi đang hoạt động
     */
    static async getActiveSales() {
        return await this.findAll({ activeOnly: true });
    }

    // =============================================================================
    // TẠO KHUYẾN MÃI MỚI - CREATE SALE
    // =============================================================================

    /**
     * Tạo chương trình khuyến mãi mới
     *
     * @description Thêm một khuyến mãi mới vào database.
     *              Hỗ trợ các loại giảm giá:
     *              - 'percentage': Giảm theo phần trăm (VD: 20% off)
     *              - 'fixed': Giảm số tiền cố định (VD: 50,000đ off)
     *              - 'bogo': Buy One Get One Free
     *
     * @param {Object} saleData - Dữ liệu khuyến mãi
     * @param {string} saleData.name - Tên chương trình
     * @param {string} [saleData.description] - Mô tả chi tiết
     * @param {string} saleData.type - Loại giảm giá ('percentage', 'fixed', 'bogo')
     * @param {number} saleData.value - Giá trị giảm (% hoặc số tiền)
     * @param {string} saleData.start_date - Ngày bắt đầu (YYYY-MM-DD HH:mm:ss)
     * @param {string} saleData.end_date - Ngày kết thúc (YYYY-MM-DD HH:mm:ss)
     *
     * @returns {Promise<Object>} Khuyến mãi vừa tạo với ID
     */
    static async create(saleData) {
        const { name, description, type, value, start_date, end_date } = saleData;

        const query = `
            INSERT INTO sales (name, description, type, value, start_date, end_date)
            VALUES (?, ?, ?, ?, ?, ?)
        `;

        const [result] = await pool.execute(query, [
            name,
            description || null,
            type,
            value,
            start_date,
            end_date
        ]);

        return { id: result.insertId, ...saleData };
    }

    /**
     * Gán chương trình khuyến mãi cho danh sách sản phẩm.
     * Nếu truyền mảng rỗng thì chương trình vẫn được tạo nhưng chưa áp dụng cho sản phẩm nào.
     */
    static async assignProducts(saleId, productIds = [], connection = pool) {
        await connection.execute(
            'UPDATE products SET sale_id = NULL WHERE sale_id = ?',
            [saleId]
        );

        if (!Array.isArray(productIds) || productIds.length === 0) {
            return;
        }

        const placeholders = productIds.map(() => '?').join(', ');
        await connection.execute(
            `UPDATE products SET sale_id = ? WHERE id IN (${placeholders})`,
            [saleId, ...productIds]
        );
    }

    /**
     * Lấy danh sách sản phẩm đang gắn với từng chương trình sale.
     */
    static async getAssignedProductsMap(saleIds = []) {
        if (!Array.isArray(saleIds) || saleIds.length === 0) {
            return new Map();
        }

        const placeholders = saleIds.map(() => '?').join(', ');
        const [rows] = await pool.execute(
            `SELECT p.sale_id,
                    p.id,
                    p.name,
                    p.slug,
                    p.sku
             FROM products p
             WHERE p.sale_id IN (${placeholders})
               AND p.is_active = TRUE
             ORDER BY p.name ASC`,
            saleIds
        );

        const assignments = new Map();
        rows.forEach((row) => {
            if (!assignments.has(row.sale_id)) {
                assignments.set(row.sale_id, []);
            }

            assignments.get(row.sale_id).push({
                id: row.id,
                name: row.name,
                slug: row.slug,
                sku: row.sku
            });
        });

        return assignments;
    }

    // =============================================================================
    // CẬP NHẬT KHUYẾN MÃI - UPDATE SALE
    // =============================================================================

    /**
     * Cập nhật thông tin khuyến mãi
     *
     * @description Cập nhật tất cả thông tin của chương trình khuyến mãi
     *
     * @param {number} id - ID khuyến mãi cần cập nhật
     * @param {Object} saleData - Dữ liệu cập nhật
     * @param {boolean} [saleData.is_active=true] - Trạng thái hoạt động
     *
     * @returns {Promise<Object>} Khuyến mãi sau khi cập nhật
     */
    static async update(id, saleData) {
        const { name, description, type, value, start_date, end_date, is_active } = saleData;

        const query = `
            UPDATE sales
            SET name = ?, description = ?, type = ?, value = ?, start_date = ?, end_date = ?, is_active = ?
            WHERE id = ?
        `;

        await pool.execute(query, [
            name,
            description || null,
            type,
            value,
            start_date,
            end_date,
            is_active !== undefined ? is_active : true,
            id
        ]);

        return await this.findById(id);
    }

    // =============================================================================
    // XÓA KHUYẾN MÃI - DELETE SALE (SOFT DELETE)
    // =============================================================================

    /**
     * Xóa khuyến mãi (soft delete)
     *
     * @description Không xóa thật sự mà chỉ đánh dấu is_active = FALSE.
     *              Giữ lại dữ liệu để báo cáo doanh thu theo khuyến mãi.
     *
     * @param {number} id - ID khuyến mãi cần xóa
     *
     * @returns {Promise<void>}
     */
    static async delete(id) {
        // Soft delete: chỉ vô hiệu hóa, không xóa thật
        const query = 'UPDATE sales SET is_active = FALSE WHERE id = ?';
        await pool.execute(query, [id]);
    }

    // =============================================================================
    // TỰ ĐỘNG KÍCH HOẠT KHUYẾN MÃI THEO LỊCH - ACTIVATE SCHEDULED SALES
    // =============================================================================

    /**
     * Kích hoạt các khuyến mãi theo lịch
     *
     * @description Tự động kích hoạt các khuyến mãi đã đến thời gian bắt đầu.
     *              Dùng trong cron job hoặc scheduler.
     *              Điều kiện kích hoạt:
     *              - is_active = FALSE
     *              - Thời gian hiện tại >= start_date
     *              - Thời gian hiện tại <= end_date
     *
     * @returns {Promise<number>} Số khuyến mãi đã được kích hoạt
     */
    static async activateScheduledSales() {
        const query = `
            UPDATE sales
            SET is_active = TRUE
            WHERE is_active = FALSE AND NOW() >= start_date AND NOW() <= end_date
        `;
        const [result] = await pool.execute(query);
        return result.affectedRows;
    }

    // =============================================================================
    // TỰ ĐỘNG VÔ HIỆU HÓA KHUYẾN MÃI HẾT HẠN - DEACTIVATE EXPIRED SALES
    // =============================================================================

    /**
     * Vô hiệu hóa các khuyến mãi đã hết hạn
     *
     * @description Tự động vô hiệu hóa các khuyến mãi đã qua thời gian kết thúc.
     *              Dùng trong cron job hoặc scheduler.
     *              Điều kiện vô hiệu hóa:
     *              - is_active = TRUE
     *              - Thời gian hiện tại > end_date
     *
     * @returns {Promise<number>} Số khuyến mãi đã được vô hiệu hóa
     */
    static async deactivateExpiredSales() {
        const query = `
            UPDATE sales
            SET is_active = FALSE
            WHERE is_active = TRUE AND NOW() > end_date
        `;
        const [result] = await pool.execute(query);
        return result.affectedRows;
    }
}

module.exports = Sale;
