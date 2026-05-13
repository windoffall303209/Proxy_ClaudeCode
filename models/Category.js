// Model truy vấn và chuẩn hóa dữ liệu danh mục trong MySQL.
const pool = require('../config/database');

class Category {
    static normalizeParentId(parentId) {
        const parsed = Number.parseInt(parentId, 10);
        return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
    }

    static normalizeDisplayOrder(displayOrder) {
        const parsed = Number.parseInt(displayOrder, 10);
        return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
    }

    static sortSiblings(categories = []) {
        return [...categories].sort((a, b) => {
            const aOrder = Number(a.display_order || 0) > 0 ? Number(a.display_order) : Number.MAX_SAFE_INTEGER;
            const bOrder = Number(b.display_order || 0) > 0 ? Number(b.display_order) : Number.MAX_SAFE_INTEGER;
            const orderDiff = aOrder - bOrder;
            if (orderDiff !== 0) {
                return orderDiff;
            }

            const nameDiff = String(a.name || '').localeCompare(String(b.name || ''), 'vi');
            if (nameDiff !== 0) {
                return nameDiff;
            }

            const idDiff = Number(a.id || 0) - Number(b.id || 0);
            if (idDiff !== 0) {
                return idDiff;
            }

            return 0;
        });
    }

    static getParentCondition(parentId, tableAlias = '') {
        const column = `${tableAlias ? `${tableAlias}.` : ''}parent_id`;
        return parentId ? { sql: `${column} = ?`, params: [parentId] } : { sql: `${column} IS NULL`, params: [] };
    }

    static async getNextDisplayOrder(connection, parentId, excludeId = null) {
        const condition = this.getParentCondition(parentId);
        let query = `
            SELECT COALESCE(MAX(display_order), 0) + 1 AS next_order
            FROM categories
            WHERE is_active = TRUE AND ${condition.sql}
        `;
        const params = [...condition.params];

        if (excludeId) {
            query += ' AND id <> ?';
            params.push(excludeId);
        }

        const [[row]] = await connection.execute(query, params);
        return Number(row?.next_order || 1);
    }

    static async shiftDisplayOrders(connection, parentId, targetOrder, excludeId = null) {
        const condition = this.getParentCondition(parentId);
        let query = `
            UPDATE categories
            SET display_order = display_order + 1
            WHERE is_active = TRUE
              AND display_order >= ?
              AND ${condition.sql}
        `;
        const params = [targetOrder, ...condition.params];

        if (excludeId) {
            query += ' AND id <> ?';
            params.push(excludeId);
        }

        await connection.execute(query, params);
    }

    static async closeDisplayOrderGap(connection, parentId, oldOrder, excludeId = null) {
        if (!oldOrder || oldOrder < 1) {
            return;
        }

        const condition = this.getParentCondition(parentId);
        let query = `
            UPDATE categories
            SET display_order = GREATEST(display_order - 1, 1)
            WHERE is_active = TRUE
              AND display_order > ?
              AND ${condition.sql}
        `;
        const params = [oldOrder, ...condition.params];

        if (excludeId) {
            query += ' AND id <> ?';
            params.push(excludeId);
        }

        await connection.execute(query, params);
    }

    static async resequenceDisplayOrders() {
        const connection = await pool.getConnection();

        try {
            await connection.beginTransaction();
            const [rows] = await connection.execute(`
                SELECT id, name, parent_id, display_order
                FROM categories
                WHERE is_active = TRUE
                ORDER BY parent_id ASC, display_order ASC, name ASC, id ASC
                FOR UPDATE
            `);

            const groups = new Map();
            rows.forEach((category) => {
                const key = category.parent_id ? String(category.parent_id) : 'root';
                const group = groups.get(key) || [];
                group.push(category);
                groups.set(key, group);
            });

            for (const group of groups.values()) {
                const sortedGroup = this.sortSiblings(group);
                for (let index = 0; index < sortedGroup.length; index += 1) {
                    const nextOrder = index + 1;
                    if (Number(sortedGroup[index].display_order || 0) !== nextOrder) {
                        await connection.execute(
                            'UPDATE categories SET display_order = ? WHERE id = ?',
                            [nextOrder, sortedGroup[index].id]
                        );
                    }
                }
            }

            await connection.commit();
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    static sortHierarchically(categories = []) {
        const normalizedCategories = Array.isArray(categories)
            ? categories.map((category) => ({
                ...category,
                tree_depth: 0,
                tree_path: ''
            }))
            : [];

        const categoryMap = new Map(normalizedCategories.map((category) => [Number(category.id), category]));
        const childrenByParent = new Map();
        const roots = [];

        normalizedCategories.forEach((category) => {
            const parentId = category.parent_id ? Number(category.parent_id) : null;

            if (parentId && categoryMap.has(parentId)) {
                const children = childrenByParent.get(parentId) || [];
                children.push(category);
                childrenByParent.set(parentId, children);
                return;
            }

            roots.push(category);
        });

        const result = [];
        const visit = (category, depth = 0, pathParts = []) => {
            const idPart = String(category.id || 0).padStart(10, '0');
            const nextPathParts = [...pathParts, idPart];

            category.tree_depth = depth;
            category.tree_path = nextPathParts.join('/');
            result.push(category);

            const children = this.sortSiblings(childrenByParent.get(Number(category.id)) || []);
            children.forEach((child) => visit(child, depth + 1, nextPathParts));
        };

        this.sortSiblings(roots).forEach((category) => visit(category));

        return result;
    }

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
            ORDER BY c.id ASC
        `;

        const [rows] = await pool.query(query);
        return this.sortHierarchically(rows);
    }

    // Tìm tất cả any.
    static async findAllAny() {
        const query = `
            SELECT *
            FROM categories
            ORDER BY id ASC
        `;

        const [rows] = await pool.query(query);
        return this.sortHierarchically(rows);
    }

    // Tìm root danh mục.
    static async findRootCategories(limit = null, options = {}) {
        const parsedLimit = Number.parseInt(limit, 10);
        const hasLimit = Number.isInteger(parsedLimit) && parsedLimit > 0;
        const sortMode = options.sort === 'id' ? 'id' : 'display';
        const orderBy = sortMode === 'id'
            ? 'c.id ASC'
            : 'CASE WHEN c.display_order > 0 THEN c.display_order ELSE 999999 END ASC, c.name ASC, c.id ASC';

        let query = `
            SELECT c.*,
                   (
                       SELECT COUNT(*)
                       FROM products p
                       WHERE p.category_id = c.id AND p.is_active = TRUE
                   ) AS product_count
            FROM categories c
            WHERE c.is_active = TRUE AND c.parent_id IS NULL
            ORDER BY ${orderBy}
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

        query += ' ORDER BY c.id ASC';

        const [rows] = await pool.execute(query, params);
        return this.sortHierarchically(rows);
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
        const parentId = this.normalizeParentId(parent_id);
        const connection = await pool.getConnection();

        const query = explicitId
            ? `
                INSERT INTO categories (id, name, slug, description, parent_id, image_url, display_order, is_active)
                VALUES (?, ?, ?, ?, ?, ?, ?, TRUE)
                RETURNING id
            `
            : `
                INSERT INTO categories (name, slug, description, parent_id, image_url, display_order)
                VALUES (?, ?, ?, ?, ?, ?)
                RETURNING id
            `;

        try {
            await connection.beginTransaction();

            const targetOrder = this.normalizeDisplayOrder(display_order)
                || await this.getNextDisplayOrder(connection, parentId);
            await this.shiftDisplayOrders(connection, parentId, targetOrder);

            const params = explicitId
                ? [
                    explicitId,
                    name,
                    slug,
                    description || null,
                    parentId,
                    image_url || null,
                    targetOrder
                ]
                : [
                    name,
                    slug,
                    description || null,
                    parentId,
                    image_url || null,
                    targetOrder
                ];

            const [result] = await connection.execute(query, params);
            await connection.commit();

            return { id: explicitId || result.insertId, ...categoryData, parent_id: parentId, display_order: targetOrder, is_active: true };
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
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
        const categoryId = Number.parseInt(id, 10);
        const connection = await pool.getConnection();

        try {
            await connection.beginTransaction();

            const [[existing]] = await connection.execute('SELECT * FROM categories WHERE id = ? FOR UPDATE', [categoryId]);
            if (!existing) {
                throw new Error('Danh mục không tồn tại');
            }

            const oldParentId = this.normalizeParentId(existing.parent_id);
            const newParentId = this.normalizeParentId(parent_id);
            const oldOrder = this.normalizeDisplayOrder(existing.display_order);
            const requestedOrder = this.normalizeDisplayOrder(display_order);
            const sameParent = oldParentId === newParentId;
            const targetOrder = requestedOrder || (sameParent && oldOrder
                ? oldOrder
                : await this.getNextDisplayOrder(connection, newParentId, categoryId));

            if (sameParent) {
                if (!oldOrder) {
                    await this.shiftDisplayOrders(connection, newParentId, targetOrder, categoryId);
                } else if (targetOrder < oldOrder) {
                    const condition = this.getParentCondition(newParentId);
                    await connection.execute(
                        `
                            UPDATE categories
                            SET display_order = display_order + 1
                            WHERE is_active = TRUE
                              AND display_order >= ?
                              AND display_order < ?
                              AND ${condition.sql}
                              AND id <> ?
                        `,
                        [targetOrder, oldOrder, ...condition.params, categoryId]
                    );
                } else if (targetOrder > oldOrder) {
                    const condition = this.getParentCondition(newParentId);
                    await connection.execute(
                        `
                            UPDATE categories
                            SET display_order = GREATEST(display_order - 1, 1)
                            WHERE is_active = TRUE
                              AND display_order <= ?
                              AND display_order > ?
                              AND ${condition.sql}
                              AND id <> ?
                        `,
                        [targetOrder, oldOrder, ...condition.params, categoryId]
                    );
                }
            } else {
                await this.closeDisplayOrderGap(connection, oldParentId, oldOrder, categoryId);
                await this.shiftDisplayOrders(connection, newParentId, targetOrder, categoryId);
            }

            let query = `
                UPDATE categories
                SET name = ?, slug = ?, description = ?, parent_id = ?, image_url = ?, display_order = ?
            `;
            const params = [
                name,
                slug,
                description || null,
                newParentId,
                image_url || null,
                targetOrder
            ];

            if (hasIsActive) {
                query += ', is_active = ?';
                params.push(Boolean(categoryData.is_active));
            }

            query += ' WHERE id = ?';
            params.push(categoryId);

            await connection.execute(query, params);
            await connection.commit();
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }

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
                DELETE FROM categories c
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM products p2
                    INNER JOIN order_items oi ON oi.product_id = p2.id
                    WHERE p2.category_id = c.id
                )
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
        const sortedCategories = this.sortHierarchically(categories);
        const normalizedCategories = Array.isArray(sortedCategories)
            ? sortedCategories.map((category) => ({
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
