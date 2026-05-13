// Model truy vấn và chuẩn hóa dữ liệu danh mục trong MySQL.
const pool = require('../config/database');

class Category {
    // Tìm tất cả.
    static async findAll() {
        const query = `
            SELECT c.*,
                   (
                       SELECT COUNT(*)
                       FROM products p
                       WHERE p.category_id = c.id AND p.is_active = TRUE
                   ) AS product_count
            FROM categories c
            WHERE c.is_active = TRUE
            ORDER BY c.display_order ASC, c.name ASC
        `;

        const [rows] = await pool.query(query);
        return rows;
    }

    // Tìm tất cả any.
    static async findAllAny() {
        const query = `
            SELECT *
            FROM categories
            ORDER BY id ASC
        `;

        const [rows] = await pool.query(query);
        return rows;
    }

    // Tìm root danh mục.
    static async findRootCategories(limit = null) {
        const parsedLimit = Number.parseInt(limit, 10);
        const hasLimit = Number.isInteger(parsedLimit) && parsedLimit > 0;

        let query = `
            SELECT c.*,
                   (
                       SELECT COUNT(*)
                       FROM products p
                       WHERE p.category_id = c.id AND p.is_active = TRUE
                   ) AS product_count
            FROM categories c
            WHERE c.is_active = TRUE AND c.parent_id IS NULL
            ORDER BY c.display_order ASC, c.name ASC
        `;

        if (hasLimit) {
            query += ` LIMIT ${parsedLimit}`;
        }

        const [rows] = await pool.query(query);
        return rows;
    }

    // Tìm tất cả for admin.
    static async findAllForAdmin(options = {}) {
        const search = typeof options.search === 'string' ? options.search.trim() : '';

        let query = `
            SELECT c.*,
                   parent.name AS parent_name,
                   (
                       SELECT COUNT(*)
                       FROM products p
                       WHERE p.category_id = c.id AND p.is_active = TRUE
                   ) AS product_count,
                   (
                       SELECT COUNT(*)
                       FROM categories child
                       WHERE child.parent_id = c.id AND child.is_active = TRUE
                   ) AS child_count
            FROM categories c
            LEFT JOIN categories parent ON c.parent_id = parent.id
            WHERE c.is_active = TRUE
        `;
        const params = [];

        if (search) {
            query += ' AND (c.name LIKE ? OR c.slug LIKE ? OR c.description LIKE ?)';
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }

        query += ' ORDER BY c.display_order ASC, c.name ASC';

        const [rows] = await pool.execute(query, params);
        return rows;
    }

    // Tìm theo ID.
    static async findById(id) {
        const query = 'SELECT * FROM categories WHERE id = ? AND is_active = TRUE';
        const [rows] = await pool.execute(query, [id]);
        return rows[0] || null;
    }

    // Tìm theo ID any.
    static async findByIdAny(id) {
        const query = 'SELECT * FROM categories WHERE id = ?';
        const [rows] = await pool.execute(query, [id]);
        return rows[0] || null;
    }

    // Tìm theo slug.
    static async findBySlug(slug) {
        const query = 'SELECT * FROM categories WHERE slug = ? AND is_active = TRUE';
        const [rows] = await pool.execute(query, [slug]);
        return rows[0] || null;
    }

    // Tìm theo slug any.
    static async findBySlugAny(slug) {
        const query = 'SELECT * FROM categories WHERE slug = ?';
        const [rows] = await pool.execute(query, [slug]);
        return rows[0] || null;
    }

    // Tìm with sản phẩm.
    static async findWithProducts(categoryId, limit = 10) {
        const category = await this.findById(categoryId);
        if (!category) return null;

        const query = `
            SELECT p.*,
                   (
                       SELECT image_url
                       FROM product_images
                       WHERE product_id = p.id AND is_primary = TRUE
                       LIMIT 1
                   ) AS primary_image,
                   s.type AS sale_type,
                   s.value AS sale_value
            FROM products p
            LEFT JOIN sales s ON p.sale_id = s.id
                AND s.is_active = TRUE
                AND NOW() BETWEEN s.start_date AND s.end_date
            WHERE p.category_id = ? AND p.is_active = TRUE
            ORDER BY p.created_at DESC
            LIMIT ?
        `;
        const [products] = await pool.execute(query, [categoryId, limit]);

        category.products = products;
        return category;
    }

    // Tạo bản ghi mới.
    static async create(categoryData, options = {}) {
        const { name, slug, description, parent_id, image_url, display_order } = categoryData;
        const explicitId = Number.isInteger(Number(options.id)) ? Number(options.id) : null;

        const query = explicitId
            ? `
                INSERT INTO categories (id, name, slug, description, parent_id, image_url, display_order, is_active)
                VALUES (?, ?, ?, ?, ?, ?, ?, TRUE)
            `
            : `
                INSERT INTO categories (name, slug, description, parent_id, image_url, display_order)
                VALUES (?, ?, ?, ?, ?, ?)
            `;

        const params = explicitId
            ? [
                explicitId,
                name,
                slug,
                description || null,
                parent_id || null,
                image_url || null,
                display_order || 0
            ]
            : [
                name,
                slug,
                description || null,
                parent_id || null,
                image_url || null,
                display_order || 0
            ];

        const [result] = await pool.execute(query, params);

        return { id: explicitId || result.insertId, ...categoryData, is_active: true };
    }

    // Cập nhật bản ghi hiện có.
    static async update(id, categoryData) {
        const {
            name,
            slug,
            description,
            parent_id,
            image_url,
            display_order
        } = categoryData;
        const hasIsActive = Object.prototype.hasOwnProperty.call(categoryData, 'is_active');
        let query = `
            UPDATE categories
            SET name = ?, slug = ?, description = ?, parent_id = ?, image_url = ?, display_order = ?
        `;
        const params = [
            name,
            slug,
            description || null,
            parent_id || null,
            image_url || null,
            display_order || 0
        ];

        if (hasIsActive) {
            query += ', is_active = ?';
            params.push(Boolean(categoryData.is_active));
        }

        query += ' WHERE id = ?';
        params.push(id);

        await pool.execute(query, params);

        return this.findById(id);
    }

    // Xóa bản ghi theo điều kiện truyền vào.
    static async delete(id) {
        const query = 'UPDATE categories SET is_active = FALSE WHERE id = ?';
        await pool.execute(query, [id]);
    }

    // Xóa tất cả permanently.
    static async deleteAllPermanently() {
        const connection = await pool.getConnection();

        try {
            await connection.beginTransaction();

            const [[summary]] = await connection.query(`
                SELECT
                    COUNT(DISTINCT c.id) AS total_categories,
                    COUNT(DISTINCT CASE WHEN blocked.category_id IS NOT NULL THEN c.id END) AS blocked_categories,
                    COUNT(DISTINCT CASE WHEN blocked.category_id IS NULL THEN c.id END) AS deletable_categories,
                    COUNT(DISTINCT CASE WHEN blocked.category_id IS NULL THEN p.id END) AS deletable_products
                FROM categories c
                LEFT JOIN products p ON p.category_id = c.id
                LEFT JOIN (
                    SELECT DISTINCT c2.id AS category_id
                    FROM categories c2
                    INNER JOIN products p2 ON p2.category_id = c2.id
                    INNER JOIN order_items oi ON oi.product_id = p2.id
                ) blocked ON blocked.category_id = c.id
            `);

            const [deleteResult] = await connection.query(`
                DELETE c
                FROM categories c
                LEFT JOIN (
                    SELECT DISTINCT c2.id AS category_id
                    FROM categories c2
                    INNER JOIN products p2 ON p2.category_id = c2.id
                    INNER JOIN order_items oi ON oi.product_id = p2.id
                ) blocked ON blocked.category_id = c.id
                WHERE blocked.category_id IS NULL
            `);

            await connection.commit();

            return {
                totalCategories: Number(summary?.total_categories || 0),
                deletedCategories: Number(deleteResult?.affectedRows || 0),
                blockedCategories: Number(summary?.blocked_categories || 0),
                deletedProducts: Number(summary?.deletable_products || 0)
            };
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    // Lấy usage stats.
    static async getUsageStats(id) {
        const query = `
            SELECT
                (
                    SELECT COUNT(*)
                    FROM products p
                    WHERE p.category_id = ? AND p.is_active = TRUE
                ) AS product_count,
                (
                    SELECT COUNT(*)
                    FROM categories child
                    WHERE child.parent_id = ? AND child.is_active = TRUE
                ) AS child_count
        `;

        const [rows] = await pool.execute(query, [id, id]);
        return rows[0] || { product_count: 0, child_count: 0 };
    }

    // Thao tác với creates circular reference.
    static async createsCircularReference(categoryId, parentId) {
        if (!parentId) {
            return false;
        }

        let currentId = Number(parentId);
        const targetId = Number(categoryId);

        while (Number.isInteger(currentId) && currentId > 0) {
            if (currentId === targetId) {
                return true;
            }

            const currentCategory = await this.findByIdAny(currentId);
            if (!currentCategory || !currentCategory.parent_id) {
                return false;
            }

            currentId = Number(currentCategory.parent_id);
        }

        return false;
    }

    // Lấy top danh mục.
    static async getTopCategories(limit = 3) {
        const safeLimit = Number.parseInt(limit, 10) || 3;
        return this.findRootCategories(safeLimit);
    }

    // Tạo dữ liệu tree.
    static buildTree(categories = []) {
        const normalizedCategories = Array.isArray(categories)
            ? categories.map((category) => ({
                ...category,
                children: []
            }))
            : [];
        const categoryMap = new Map(normalizedCategories.map((category) => [Number(category.id), category]));
        const roots = [];

        normalizedCategories.forEach((category) => {
            if (category.parent_id) {
                const parentCategory = categoryMap.get(Number(category.parent_id));
                if (parentCategory) {
                    parentCategory.children.push(category);
                    return;
                }
            }

            roots.push(category);
        });

        return roots;
    }
}

module.exports = Category;
