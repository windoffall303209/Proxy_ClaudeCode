// Model truy vấn và chuẩn hóa dữ liệu mã giảm giá trong MySQL.
const pool = require('../config/database');

class Voucher {
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
            throw new Error('Giá trị voucher phải lớn hơn 0');
        }

        if (type === 'percentage' && normalizedValue >= 100) {
            throw new Error('Voucher phần trăm phải nhỏ hơn 100%');
        }

        return normalizedValue;
    }

    // Tìm tất cả.
    static async findAll(filters = {}) {
        let query = 'SELECT * FROM vouchers WHERE 1=1';
        const params = [];

        if (filters.is_active !== undefined) {
            query += ' AND is_active = ?';
            params.push(filters.is_active);
        }

        if (filters.search) {
            query += ' AND (code LIKE ? OR name LIKE ? OR COALESCE(description, \'\') LIKE ?)';
            params.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`);
        }

        query += ' ORDER BY created_at DESC';

        if (filters.limit) {
            query += ` LIMIT ${Number.parseInt(filters.limit, 10)} OFFSET ${Number.parseInt(filters.offset, 10) || 0}`;
        }

        const [rows] = await pool.query(query, params);
        return rows;
    }

    // Tìm theo ID.
    static async findById(id) {
        const [rows] = await pool.execute('SELECT * FROM vouchers WHERE id = ?', [id]);
        return rows[0] || null;
    }

    // Tìm theo mã.
    static async findByCode(code) {
        const [rows] = await pool.execute('SELECT * FROM vouchers WHERE code = ?', [String(code || '').toUpperCase()]);
        return rows[0] || null;
    }

    // Tạo bản ghi mới.
    static async create(data) {
        const {
            code, name, description, type, value,
            min_order_amount, max_discount_amount, usage_limit,
            user_limit, start_date, end_date, is_active, product_ids
        } = data;
        const normalizedValue = this.normalizeDiscountValue(type, value);

        const [result] = await pool.execute(
            `INSERT INTO vouchers (
                code, name, description, type, value,
                min_order_amount, max_discount_amount, usage_limit,
                user_limit, start_date, end_date, is_active
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            RETURNING id`,
            [
                String(code || '').toUpperCase(),
                name,
                description || null,
                type,
                normalizedValue,
                min_order_amount || 0,
                max_discount_amount || null,
                usage_limit || null,
                user_limit || 1,
                start_date,
                end_date,
                is_active !== false
            ]
        );

        const voucherId = result.insertId;
        await this.setApplicableProducts(voucherId, product_ids || []);

        return {
            id: voucherId,
            code: String(code || '').toUpperCase()
        };
    }

    // Cập nhật bản ghi hiện có.
    static async update(id, data) {
        const {
            code, name, description, type, value,
            min_order_amount, max_discount_amount, usage_limit,
            user_limit, start_date, end_date, is_active, product_ids
        } = data;
        const normalizedValue = this.normalizeDiscountValue(type, value);

        await pool.execute(
            `UPDATE vouchers SET
                code = ?, name = ?, description = ?, type = ?, value = ?,
                min_order_amount = ?, max_discount_amount = ?, usage_limit = ?,
                user_limit = ?, start_date = ?, end_date = ?, is_active = ?
             WHERE id = ?`,
            [
                String(code || '').toUpperCase(),
                name,
                description || null,
                type,
                normalizedValue,
                min_order_amount || 0,
                max_discount_amount || null,
                usage_limit || null,
                user_limit || 1,
                start_date,
                end_date,
                is_active !== false,
                id
            ]
        );

        if (product_ids !== undefined) {
            await this.setApplicableProducts(id, product_ids || []);
        }

        return this.findById(id);
    }

    // Thao tác với set applicable sản phẩm.
    static async setApplicableProducts(voucherId, productIds = [], connection = pool) {
        const normalizedProductIds = this.normalizeProductIds(productIds);

        await connection.execute(
            'DELETE FROM voucher_products WHERE voucher_id = ?',
            [voucherId]
        );

        if (normalizedProductIds.length === 0) {
            return;
        }

        const values = normalizedProductIds.map(() => '(?, ?)').join(', ');
        const params = normalizedProductIds.flatMap((productId) => [voucherId, productId]);

        await connection.execute(
            `INSERT INTO voucher_products (voucher_id, product_id) VALUES ${values}`,
            params
        );
    }

    // Lấy applicable sản phẩm ID.
    static async getApplicableProductIds(voucherId) {
        const [rows] = await pool.execute(
            'SELECT product_id FROM voucher_products WHERE voucher_id = ? ORDER BY product_id ASC',
            [voucherId]
        );

        return rows.map((row) => row.product_id);
    }

    // Lấy applicable sản phẩm map.
    static async getApplicableProductsMap(voucherIds = []) {
        if (!Array.isArray(voucherIds) || voucherIds.length === 0) {
            return new Map();
        }

        const placeholders = voucherIds.map(() => '?').join(', ');
        const [rows] = await pool.execute(
            `SELECT vp.voucher_id,
                    p.id,
                    p.name,
                    p.slug,
                    p.sku
             FROM voucher_products vp
             JOIN products p ON p.id = vp.product_id
             WHERE vp.voucher_id IN (${placeholders})
               AND p.is_active = TRUE
             ORDER BY p.name ASC`,
            voucherIds
        );

        const assignments = new Map();
        rows.forEach((row) => {
            if (!assignments.has(row.voucher_id)) {
                assignments.set(row.voucher_id, []);
            }

            assignments.get(row.voucher_id).push({
                id: row.id,
                name: row.name,
                slug: row.slug,
                sku: row.sku
            });
        });

        return assignments;
    }

    // Tính eligible subtotal.
    static calculateEligibleSubtotal(voucherProductIds, cartItems = [], orderAmount = 0) {
        if (!Array.isArray(voucherProductIds) || voucherProductIds.length === 0) {
            return Number(orderAmount) || 0;
        }

        const eligibleSet = new Set(voucherProductIds.map((value) => Number.parseInt(value, 10)));

        return cartItems.reduce((sum, item) => {
            const productId = Number.parseInt(item.product_id, 10);
            if (!eligibleSet.has(productId)) {
                return sum;
            }

            return sum + Number(item.subtotal || 0);
        }, 0);
    }

    // Xóa bản ghi theo điều kiện truyền vào.
    static async delete(id) {
        await pool.execute('DELETE FROM vouchers WHERE id = ?', [id]);
    }

    // Cập nhật trạng thái.
    static async updateStatus(id, isActive) {
        await pool.execute('UPDATE vouchers SET is_active = ? WHERE id = ?', [isActive, id]);
    }

    // Kiểm tra hợp lệ validate.
    static async validate(code, userId, orderAmount, cartItems = []) {
        const voucher = await this.findByCode(code);

        if (!voucher) {
            return { valid: false, message: 'Mã giảm giá không tồn tại' };
        }

        if (!voucher.is_active) {
            return { valid: false, message: 'Mã giảm giá đã hết hiệu lực' };
        }

        const now = new Date();
        if (now < new Date(voucher.start_date) || now > new Date(voucher.end_date)) {
            return { valid: false, message: 'Mã giảm giá không trong thời gian hiệu lực' };
        }

        if (voucher.usage_limit && voucher.used_count >= voucher.usage_limit) {
            return { valid: false, message: 'Mã giảm giá đã hết lượt sử dụng' };
        }

        const applicableProductIds = await this.getApplicableProductIds(voucher.id);
        const hasScopedProducts = applicableProductIds.length > 0;
        const eligibleSubtotal = this.calculateEligibleSubtotal(applicableProductIds, cartItems, orderAmount);

        if (hasScopedProducts && eligibleSubtotal <= 0) {
            return {
                valid: false,
                message: 'Mã voucher này không áp dụng cho các sản phẩm hiện có trong đơn hàng'
            };
        }

        if (eligibleSubtotal < voucher.min_order_amount) {
            return {
                valid: false,
                message: hasScopedProducts
                    ? `Tổng tiền các sản phẩm áp dụng phải từ ${voucher.min_order_amount.toLocaleString('vi-VN')}đ`
                    : `Đơn hàng tối thiểu ${voucher.min_order_amount.toLocaleString('vi-VN')}đ để sử dụng mã này`
            };
        }

        if (userId && voucher.user_limit) {
            const [usage] = await pool.execute(
                'SELECT COUNT(*) as count FROM voucher_usage WHERE voucher_id = ? AND user_id = ?',
                [voucher.id, userId]
            );
            if (usage[0].count >= voucher.user_limit) {
                return { valid: false, message: 'Bạn đã sử dụng hết lượt cho mã này' };
            }
        }

        const payableAmount = Math.max(0, Number(orderAmount) || 0);
        let discountAmount = 0;
        if (voucher.type === 'percentage') {
            if (Number(voucher.value) >= 100) {
                return { valid: false, message: 'Voucher phần trăm không hợp lệ' };
            }

            discountAmount = eligibleSubtotal * (voucher.value / 100);
            if (voucher.max_discount_amount && discountAmount > voucher.max_discount_amount) {
                discountAmount = voucher.max_discount_amount;
            }
        } else {
            discountAmount = voucher.value;
        }

        discountAmount = Math.max(0, Math.min(discountAmount, payableAmount));

        return {
            valid: true,
            voucher: {
                ...voucher,
                applicable_product_ids: applicableProductIds
            },
            discountAmount: Math.floor(discountAmount),
            eligibleSubtotal
        };
    }

    // Thao tác với record usage.
    static async recordUsage(voucherId, userId, orderId, discountAmount) {
        await pool.execute(
            'INSERT INTO voucher_usage (voucher_id, user_id, order_id, discount_amount) VALUES (?, ?, ?, ?)',
            [voucherId, userId, orderId, discountAmount]
        );

        await pool.execute(
            'UPDATE vouchers SET used_count = used_count + 1 WHERE id = ?',
            [voucherId]
        );
    }

    // Đếm tổng số bản ghi.
    static async count(filters = {}) {
        let query = 'SELECT COUNT(*) as total FROM vouchers WHERE 1=1';
        const params = [];

        if (filters.is_active !== undefined) {
            query += ' AND is_active = ?';
            params.push(filters.is_active);
        }

        const [rows] = await pool.query(query, params);
        return rows[0].total;
    }
}

module.exports = Voucher;
