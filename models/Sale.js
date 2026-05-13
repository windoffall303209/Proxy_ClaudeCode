// Model truy vấn và chuẩn hóa dữ liệu khuyến mãi trong MySQL.
const pool = require('../config/database');

class Sale {
    // Chuẩn hóa sản phẩm ID.
    static normalizeProductIds(productIds = []) {
        if (!Array.isArray(productIds)) {
            return [];
        }

        return [...new Set(
            productIds
                .map((value) => Number.parseInt(value, 10))
                .filter((value) => Number.isInteger(value) && value > 0)
        )];
    }

    // Chuẩn hóa discount giá trị.
    static normalizeDiscountValue(type, value) {
        const normalizedValue = Number(value);

        if (!Number.isFinite(normalizedValue) || normalizedValue <= 0) {
            throw new Error('Giá trị khuyến mãi phải lớn hơn 0');
        }

        if (type === 'percentage' && normalizedValue >= 100) {
            throw new Error('Khuyến mãi phần trăm phải nhỏ hơn 100%');
        }

        return normalizedValue;
    }

    // Tìm tất cả.
    static async findAll(filters = {}) {
        const normalizedFilters = typeof filters === 'boolean'
            ? { activeOnly: filters }
            : (filters || {});
        let query = 'SELECT * FROM sales WHERE 1=1';
        const params = [];

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

    // Tìm theo ID.
    static async findById(id) {
        const [rows] = await pool.execute('SELECT * FROM sales WHERE id = ?', [id]);
        return rows[0] || null;
    }

    // Lấy đang bật sales.
    static async getActiveSales() {
        return this.findAll({ activeOnly: true });
    }

    // Tạo bản ghi mới.
    static async create(saleData) {
        const { name, description, type, value, start_date, end_date } = saleData;
        const normalizedValue = this.normalizeDiscountValue(type, value);

        const [result] = await pool.execute(
            `INSERT INTO sales (name, description, type, value, start_date, end_date)
             VALUES (?, ?, ?, ?, ?, ?)
             RETURNING id`,
            [
                name,
                description || null,
                type,
                normalizedValue,
                start_date,
                end_date
            ]
        );

        return { id: result.insertId, ...saleData };
    }

    // Thao tác với assign sản phẩm.
    static async assignProducts(saleId, productIds = [], connection = pool) {
        const normalizedProductIds = this.normalizeProductIds(productIds);

        await connection.execute(
            'UPDATE products SET sale_id = NULL WHERE sale_id = ?',
            [saleId]
        );

        if (normalizedProductIds.length === 0) {
            await connection.execute(
                'UPDATE products SET sale_id = ? WHERE is_active = TRUE',
                [saleId]
            );
            return;
        }

        const placeholders = normalizedProductIds.map(() => '?').join(', ');
        await connection.execute(
            `UPDATE products SET sale_id = ? WHERE id IN (${placeholders})`,
            [saleId, ...normalizedProductIds]
        );
    }

    // Thao tác với clear assigned sản phẩm.
    static async clearAssignedProducts(saleId, connection = pool) {
        await connection.execute(
            'UPDATE products SET sale_id = NULL WHERE sale_id = ?',
            [saleId]
        );
    }

    // Lấy assigned sản phẩm map.
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

    // Cập nhật bản ghi hiện có.
    static async update(id, saleData) {
        const { name, description, type, value, start_date, end_date, is_active } = saleData;
        const normalizedValue = this.normalizeDiscountValue(type, value);

        await pool.execute(
            `UPDATE sales
             SET name = ?, description = ?, type = ?, value = ?, start_date = ?, end_date = ?, is_active = ?
             WHERE id = ?`,
            [
                name,
                description || null,
                type,
                normalizedValue,
                start_date,
                end_date,
                is_active !== undefined ? is_active : true,
                id
            ]
        );

        return this.findById(id);
    }

    // Xóa bản ghi theo điều kiện truyền vào.
    static async delete(id) {
        await pool.execute('UPDATE sales SET is_active = FALSE WHERE id = ?', [id]);
    }

    // Thao tác với activate scheduled sales.
    static async activateScheduledSales() {
        const [result] = await pool.execute(
            `UPDATE sales
             SET is_active = TRUE
             WHERE is_active = FALSE AND NOW() >= start_date AND NOW() <= end_date`
        );
        return result.affectedRows;
    }

    // Thao tác với deactivate expired sales.
    static async deactivateExpiredSales() {
        const [result] = await pool.execute(
            `UPDATE sales
             SET is_active = FALSE
             WHERE is_active = TRUE AND NOW() > end_date`
        );
        return result.affectedRows;
    }
}

module.exports = Sale;
