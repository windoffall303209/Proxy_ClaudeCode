/**
 * =============================================================================
 * CATEGORY MODEL - Model Danh mục sản phẩm
 * =============================================================================
 * File này chứa các phương thức tương tác với bảng categories trong database:
 * - Lấy danh sách danh mục
 * - Tìm danh mục theo ID, slug
 * - Lấy danh mục kèm sản phẩm
 * - CRUD danh mục (Tạo, Đọc, Cập nhật, Xóa)
 * - Lấy danh mục hàng đầu cho trang chủ
 * =============================================================================
 */

const pool = require('../config/database');

class Category {
    // =============================================================================
    // LẤY TẤT CẢ DANH MỤC - FIND ALL CATEGORIES
    // =============================================================================

    /**
     * Lấy danh sách tất cả danh mục đang hoạt động
     *
     * @description Lấy tất cả danh mục với số lượng sản phẩm trong mỗi danh mục.
     *              Sắp xếp theo thứ tự hiển thị (display_order) và tên.
     *
     * @returns {Promise<Array>} Mảng danh mục với product_count
     */
    static async findAll() {
        const query = `
            SELECT c.*,
                   (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.is_active = TRUE) as product_count
            FROM categories c
            WHERE c.is_active = TRUE
            ORDER BY c.display_order ASC, c.name ASC
        `;
        const [rows] = await pool.query(query);
        return rows;
    }

    // =============================================================================
    // TÌM DANH MỤC THEO ID - FIND BY ID
    // =============================================================================

    /**
     * Tìm danh mục theo ID
     *
     * @description Lấy thông tin danh mục đang hoạt động bằng ID
     *
     * @param {number} id - ID danh mục
     *
     * @returns {Promise<Object|null>} Thông tin danh mục hoặc null
     */
    static async findById(id) {
        const query = 'SELECT * FROM categories WHERE id = ? AND is_active = TRUE';
        const [rows] = await pool.execute(query, [id]);
        return rows[0] || null;
    }

    // =============================================================================
    // TÌM DANH MỤC THEO SLUG - FIND BY SLUG
    // =============================================================================

    /**
     * Tìm danh mục theo slug URL
     *
     * @description Tìm danh mục bằng slug thân thiện URL
     *
     * @param {string} slug - Slug của danh mục (VD: 'thoi-trang-nam')
     *
     * @returns {Promise<Object|null>} Thông tin danh mục hoặc null
     */
    static async findBySlug(slug) {
        const query = 'SELECT * FROM categories WHERE slug = ? AND is_active = TRUE';
        const [rows] = await pool.execute(query, [slug]);
        return rows[0] || null;
    }

    // =============================================================================
    // LẤY DANH MỤC KÈM SẢN PHẨM - FIND WITH PRODUCTS
    // =============================================================================

    /**
     * Lấy danh mục kèm danh sách sản phẩm
     *
     * @description Lấy thông tin danh mục và các sản phẩm thuộc danh mục đó.
     *              Bao gồm cả thông tin khuyến mãi đang áp dụng.
     *
     * @param {number} categoryId - ID danh mục
     * @param {number} [limit=10] - Số sản phẩm tối đa
     *
     * @returns {Promise<Object|null>} Danh mục với mảng products hoặc null
     */
    static async findWithProducts(categoryId, limit = 10) {
        // Lấy thông tin danh mục
        const category = await this.findById(categoryId);
        if (!category) return null;

        // Lấy sản phẩm thuộc danh mục
        const query = `
            SELECT p.*,
                   (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = TRUE LIMIT 1) as primary_image,
                   s.type as sale_type,
                   s.value as sale_value
            FROM products p
            LEFT JOIN sales s ON p.sale_id = s.id AND s.is_active = TRUE
                AND NOW() BETWEEN s.start_date AND s.end_date
            WHERE p.category_id = ? AND p.is_active = TRUE
            ORDER BY p.created_at DESC
            LIMIT ?
        `;
        const [products] = await pool.execute(query, [categoryId, limit]);

        // Gắn danh sách sản phẩm vào danh mục
        category.products = products;
        return category;
    }

    // =============================================================================
    // TẠO DANH MỤC MỚI - CREATE CATEGORY
    // =============================================================================

    /**
     * Tạo danh mục mới
     *
     * @description Thêm một danh mục mới vào database.
     *              Hỗ trợ danh mục con (parent_id).
     *
     * @param {Object} categoryData - Dữ liệu danh mục
     * @param {string} categoryData.name - Tên danh mục
     * @param {string} categoryData.slug - Slug URL
     * @param {string} [categoryData.description] - Mô tả danh mục
     * @param {number} [categoryData.parent_id] - ID danh mục cha (nếu là danh mục con)
     * @param {string} [categoryData.image_url] - URL ảnh đại diện
     * @param {number} [categoryData.display_order=0] - Thứ tự hiển thị
     *
     * @returns {Promise<Object>} Danh mục vừa tạo với ID
     */
    static async create(categoryData) {
        const { name, slug, description, parent_id, image_url, display_order } = categoryData;

        const query = `
            INSERT INTO categories (name, slug, description, parent_id, image_url, display_order)
            VALUES (?, ?, ?, ?, ?, ?)
        `;

        const [result] = await pool.execute(query, [
            name,
            slug,
            description || null,
            parent_id || null,
            image_url || null,
            display_order || 0
        ]);

        return { id: result.insertId, ...categoryData };
    }

    // =============================================================================
    // CẬP NHẬT DANH MỤC - UPDATE CATEGORY
    // =============================================================================

    /**
     * Cập nhật thông tin danh mục
     *
     * @description Cập nhật tất cả thông tin của danh mục
     *
     * @param {number} id - ID danh mục cần cập nhật
     * @param {Object} categoryData - Dữ liệu cập nhật
     *
     * @returns {Promise<Object>} Danh mục sau khi cập nhật
     */
    static async update(id, categoryData) {
        const { name, slug, description, parent_id, image_url, display_order } = categoryData;

        const query = `
            UPDATE categories
            SET name = ?, slug = ?, description = ?, parent_id = ?, image_url = ?, display_order = ?
            WHERE id = ?
        `;

        await pool.execute(query, [
            name,
            slug,
            description || null,
            parent_id || null,
            image_url || null,
            display_order || 0,
            id
        ]);

        return await this.findById(id);
    }

    // =============================================================================
    // XÓA DANH MỤC - DELETE CATEGORY (SOFT DELETE)
    // =============================================================================

    /**
     * Xóa danh mục (soft delete)
     *
     * @description Không xóa thật sự mà chỉ đánh dấu is_active = FALSE.
     *              Giữ lại dữ liệu để báo cáo và có thể khôi phục.
     *
     * @param {number} id - ID danh mục cần xóa
     *
     * @returns {Promise<void>}
     */
    static async delete(id) {
        const query = 'UPDATE categories SET is_active = FALSE WHERE id = ?';
        await pool.execute(query, [id]);
    }

    // =============================================================================
    // LẤY DANH MỤC HÀNG ĐẦU - GET TOP CATEGORIES
    // =============================================================================

    /**
     * Lấy các danh mục hàng đầu cho trang chủ
     *
     * @description Lấy các danh mục gốc (không có parent_id) với số lượng sản phẩm.
     *              Sắp xếp theo thứ tự hiển thị.
     *              Thường dùng để hiển thị trên trang chủ.
     *
     * @param {number} [limit=3] - Số danh mục cần lấy
     *
     * @returns {Promise<Array>} Mảng danh mục hàng đầu với product_count
     */
    static async getTopCategories(limit = 3) {
        const query = `
            SELECT c.*,
                   (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.is_active = TRUE) as product_count
            FROM categories c
            WHERE c.is_active = TRUE AND c.parent_id IS NULL
            ORDER BY c.display_order ASC
            LIMIT ${parseInt(limit)}
        `;
        const [rows] = await pool.query(query);
        return rows;
    }
}

module.exports = Category;
