const pool = require('../config/database');

class Category {
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

    static async findById(id) {
        const query = 'SELECT * FROM categories WHERE id = ? AND is_active = TRUE';
        const [rows] = await pool.execute(query, [id]);
        return rows[0] || null;
    }

    static async findByIdAny(id) {
        const query = 'SELECT * FROM categories WHERE id = ?';
        const [rows] = await pool.execute(query, [id]);
        return rows[0] || null;
    }

    static async findBySlug(slug) {
        const query = 'SELECT * FROM categories WHERE slug = ? AND is_active = TRUE';
        const [rows] = await pool.execute(query, [slug]);
        return rows[0] || null;
    }

    static async findBySlugAny(slug) {
        const query = 'SELECT * FROM categories WHERE slug = ?';
        const [rows] = await pool.execute(query, [slug]);
        return rows[0] || null;
    }

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

        return this.findById(id);
    }

    static async delete(id) {
        const query = 'UPDATE categories SET is_active = FALSE WHERE id = ?';
        await pool.execute(query, [id]);
    }

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

    static async getTopCategories(limit = 3) {
        const safeLimit = Number.parseInt(limit, 10) || 3;
        return this.findRootCategories(safeLimit);
    }
}

module.exports = Category;
