/**
 * =============================================================================
 * CART MODEL - Mô hình giỏ hàng
 * =============================================================================
 * File này chứa các phương thức xử lý giỏ hàng:
 * - Tạo/lấy giỏ hàng cho user hoặc khách
 * - Gộp giỏ hàng khách khi đăng nhập
 * - Thêm/sửa/xóa sản phẩm trong giỏ
 * - Tính tổng tiền giỏ hàng
 * =============================================================================
 */

const pool = require('../config/database');

class Cart {
    // =========================================================================
    // LẤY HOẶC TẠO GIỎ HÀNG
    // =========================================================================

    /**
     * Lấy hoặc tạo giỏ hàng cho người dùng/khách
     *
     * @description Tìm giỏ hàng hiện có theo userId hoặc sessionId.
     *              Nếu chưa có, tạo giỏ hàng mới (giống cơ chế của Shopee)
     *
     * @param {number|null} userId - ID người dùng (null nếu là khách)
     * @param {string|null} sessionId - ID phiên làm việc (cho khách chưa đăng nhập)
     *
     * @returns {Object} Giỏ hàng: { id, user_id, session_id }
     * @throws {Error} Nếu không có userId hoặc sessionId
     */
    static async getOrCreate(userId, sessionId = null) {
        // Xây dựng query tìm giỏ hàng
        let query = 'SELECT * FROM cart WHERE ';
        let params = [];

        if (userId) {
            // Tìm theo userId nếu đã đăng nhập
            query += 'user_id = ?';
            params = [userId];
        } else if (sessionId) {
            // Tìm theo sessionId nếu là khách
            query += 'session_id = ?';
            params = [sessionId];
        } else {
            throw new Error('Either userId or sessionId must be provided');
        }

        // Thực hiện tìm kiếm
        const [carts] = await pool.execute(query, params);

        // Trả về giỏ hàng nếu đã tồn tại
        if (carts.length > 0) {
            return carts[0];
        }

        // Tạo giỏ hàng mới nếu chưa có
        const insertQuery = 'INSERT INTO cart (user_id, session_id) VALUES (?, ?)';
        const [result] = await pool.execute(insertQuery, [userId || null, sessionId || null]);

        return { id: result.insertId, user_id: userId, session_id: sessionId };
    }

    /**
     * Gộp giỏ hàng khách vào giỏ hàng user khi đăng nhập
     *
     * @description Khi khách đăng nhập, các sản phẩm trong giỏ hàng khách (session)
     *              sẽ được chuyển vào giỏ hàng của tài khoản, sau đó xóa giỏ khách
     *
     * @param {number} userId - ID người dùng đã đăng nhập
     * @param {string} sessionId - ID phiên của khách
     *
     * @returns {void}
     */
    static async mergeGuestCart(userId, sessionId) {
        // Tìm giỏ hàng của khách (chưa có user_id)
        const [guestCarts] = await pool.execute(
            'SELECT id FROM cart WHERE session_id = ? AND user_id IS NULL',
            [sessionId]
        );

        // Không có giỏ hàng khách thì thoát
        if (guestCarts.length === 0) return;

        const guestCartId = guestCarts[0].id;

        // Lấy hoặc tạo giỏ hàng cho user
        const userCart = await this.getOrCreate(userId);

        // Lấy tất cả sản phẩm trong giỏ khách
        const [guestItems] = await pool.execute(
            'SELECT * FROM cart_items WHERE cart_id = ?',
            [guestCartId]
        );

        // Chuyển từng sản phẩm vào giỏ user
        for (const item of guestItems) {
            await this.addItem(userCart.id, item.product_id, item.quantity, item.variant_id);
        }

        // Xóa giỏ hàng khách
        await pool.execute('DELETE FROM cart WHERE id = ?', [guestCartId]);
    }

    // =========================================================================
    // QUẢN LÝ SẢN PHẨM TRONG GIỎ
    // =========================================================================

    /**
     * Thêm sản phẩm vào giỏ hàng
     *
     * @description Thêm sản phẩm mới hoặc tăng số lượng nếu đã có trong giỏ
     *
     * @param {number} cartId - ID giỏ hàng
     * @param {number} productId - ID sản phẩm
     * @param {number} quantity - Số lượng thêm vào (mặc định: 1)
     * @param {number|null} variantId - ID biến thể (size, màu...) nếu có
     *
     * @returns {Object} { id: cart_item_id, updated: true/false }
     *                   updated = true nếu cập nhật số lượng, false nếu thêm mới
     */
    static async addItem(cartId, productId, quantity = 1, variantId = null) {
        // Kiểm tra sản phẩm đã có trong giỏ chưa
        const checkQuery = `
            SELECT * FROM cart_items
            WHERE cart_id = ? AND product_id = ? AND (variant_id = ? OR (variant_id IS NULL AND ? IS NULL))
        `;
        const [existing] = await pool.execute(checkQuery, [cartId, productId, variantId ?? null, variantId ?? null]);

        if (existing.length > 0) {
            // Đã có: cập nhật số lượng (cộng thêm)
            const updateQuery = 'UPDATE cart_items SET quantity = quantity + ? WHERE id = ?';
            await pool.execute(updateQuery, [quantity, existing[0].id]);
            return { id: existing[0].id, updated: true };
        } else {
            // Chưa có: thêm mới
            const insertQuery = `
                INSERT INTO cart_items (cart_id, product_id, variant_id, quantity)
                VALUES (?, ?, ?, ?)
            `;
            const [result] = await pool.execute(insertQuery, [cartId, productId, variantId ?? null, quantity]);

            // Cập nhật thời gian giỏ hàng
            await pool.execute('UPDATE cart SET updated_at = NOW() WHERE id = ?', [cartId]);

            return { id: result.insertId, updated: false };
        }
    }

    static async findItemByProduct(cartId, productId, variantId = null) {
        const query = `
            SELECT *
            FROM cart_items
            WHERE cart_id = ? AND product_id = ? AND (variant_id = ? OR (variant_id IS NULL AND ? IS NULL))
            LIMIT 1
        `;
        const [items] = await pool.execute(query, [cartId, productId, variantId ?? null, variantId ?? null]);
        return items[0] || null;
    }

    static async getScopedItem(cartId, cartItemId) {
        const query = `
            SELECT *
            FROM cart_items
            WHERE id = ? AND cart_id = ?
            LIMIT 1
        `;
        const [items] = await pool.execute(query, [cartItemId, cartId]);
        return items[0] || null;
    }

    /**
     * Lấy danh sách sản phẩm trong giỏ hàng
     *
     * @description Lấy tất cả sản phẩm trong giỏ kèm thông tin chi tiết:
     *              tên, giá, ảnh, khuyến mãi, biến thể
     *
     * @param {number} cartId - ID giỏ hàng
     *
     * @returns {Array} Danh sách sản phẩm với đầy đủ thông tin và giá sau sale
     */
    static async getItems(cartId) {
        // Query lấy sản phẩm kèm thông tin liên quan
        const query = `
            SELECT ci.*,
                   p.name as product_name,
                   p.price as product_price,
                   p.slug as product_slug,
                   p.stock_quantity,
                   (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = TRUE LIMIT 1) as product_image,
                   s.type as sale_type,
                   s.value as sale_value,
                   pv.size,
                   pv.color,
                   pv.additional_price
            FROM cart_items ci
            JOIN products p ON ci.product_id = p.id
            LEFT JOIN sales s ON p.sale_id = s.id AND s.is_active = TRUE
                AND NOW() BETWEEN s.start_date AND s.end_date
            LEFT JOIN product_variants pv ON ci.variant_id = pv.id
            WHERE ci.cart_id = ? AND p.is_active = TRUE
            ORDER BY ci.added_at DESC
        `;

        const [items] = await pool.execute(query, [cartId]);

        // Tính giá cuối cùng cho từng sản phẩm (sau khi áp dụng sale)
        const Product = require('./Product');
        items.forEach(item => {
            let basePrice = item.product_price + (item.additional_price || 0);
            item.unit_price = Product.calculateFinalPrice(basePrice, item.sale_type, item.sale_value);
            item.subtotal = item.unit_price * item.quantity;
        });

        return items;
    }

    /**
     * Cập nhật số lượng sản phẩm trong giỏ
     *
     * @description Thay đổi số lượng của một item. Nếu quantity <= 0, item sẽ bị xóa
     *
     * @param {number} cartItemId - ID của item trong giỏ hàng
     * @param {number} quantity - Số lượng mới
     *
     * @returns {void}
     */
    static async updateQuantity(cartId, cartItemId, quantity) {
        // Xóa nếu số lượng <= 0
        if (quantity <= 0) {
            return await this.removeItem(cartId, cartItemId);
        }

        // Cập nhật số lượng
        const query = 'UPDATE cart_items SET quantity = ? WHERE id = ? AND cart_id = ?';
        await pool.execute(query, [quantity, cartItemId, cartId]);

        // Cập nhật thời gian giỏ hàng
        await pool.execute('UPDATE cart SET updated_at = NOW() WHERE id = ?', [cartId]);
    }

    /**
     * Lấy thông tin một item trong giỏ hàng theo ID
     *
     * @param {number} cartItemId - ID của item
     * @returns {Object} Thông tin item với giá đã tính
     */
    static async getItemById(cartItemId, cartId = null) {
        const query = `
            SELECT ci.*,
                   p.name as product_name,
                   p.price as product_price,
                   p.slug as product_slug,
                   s.type as sale_type,
                   s.value as sale_value,
                   pv.additional_price
            FROM cart_items ci
            JOIN products p ON ci.product_id = p.id
            LEFT JOIN sales s ON p.sale_id = s.id AND s.is_active = TRUE
                AND NOW() BETWEEN s.start_date AND s.end_date
            LEFT JOIN product_variants pv ON ci.variant_id = pv.id
            WHERE ci.id = ?
              ${cartId ? 'AND ci.cart_id = ?' : ''}
        `;
        const params = cartId ? [cartItemId, cartId] : [cartItemId];
        const [items] = await pool.execute(query, params);

        if (items.length === 0) return null;

        const item = items[0];
        const Product = require('./Product');
        let basePrice = item.product_price + (item.additional_price || 0);
        item.unit_price = Product.calculateFinalPrice(basePrice, item.sale_type, item.sale_value);
        item.subtotal = item.unit_price * item.quantity;

        return item;
    }

    /**
     * Xóa sản phẩm khỏi giỏ hàng
     *
     * @description Xóa hoàn toàn một item khỏi giỏ hàng
     *
     * @param {number} cartItemId - ID của item cần xóa
     *
     * @returns {void}
     */
    static async removeItem(cartId, cartItemId) {
        // Xóa item
        const query = 'DELETE FROM cart_items WHERE id = ? AND cart_id = ?';
        await pool.execute(query, [cartItemId, cartId]);

        // Cập nhật thời gian giỏ hàng
        await pool.execute('UPDATE cart SET updated_at = NOW() WHERE id = ?', [cartId]);
    }

    /**
     * Xóa toàn bộ giỏ hàng
     *
     * @description Xóa tất cả sản phẩm trong giỏ (thường dùng sau khi đặt hàng)
     *
     * @param {number} cartId - ID giỏ hàng cần xóa
     *
     * @returns {void}
     */
    static async clear(cartId) {
        const query = 'DELETE FROM cart_items WHERE cart_id = ?';
        await pool.execute(query, [cartId]);

        await pool.execute('UPDATE cart SET updated_at = NOW() WHERE id = ?', [cartId]);
    }

    // =========================================================================
    // TÍNH TOÁN
    // =========================================================================

    /**
     * Tính tổng tiền giỏ hàng
     *
     * @description Tính tổng giá trị và số lượng sản phẩm trong giỏ
     *
     * @param {number} cartId - ID giỏ hàng
     *
     * @returns {Object} { subtotal: tổng tiền, itemCount: tổng số lượng, items: danh sách }
     */
    static async calculateTotal(cartId) {
        // Lấy danh sách sản phẩm (đã tính giá)
        const items = await this.getItems(cartId);

        // Tính tổng tiền
        const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
        // Tính tổng số lượng
        const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

        return {
            subtotal,
            itemCount,
            items
        };
    }

    /**
     * Đếm số lượng sản phẩm trong giỏ (cho icon header)
     *
     * @description Đếm tổng số lượng sản phẩm (chỉ đếm sản phẩm còn active)
     *
     * @param {number} cartId - ID giỏ hàng
     *
     * @returns {number} Tổng số lượng sản phẩm
     */
    static async getCartCount(cartId) {
        const query = `
            SELECT COALESCE(SUM(ci.quantity), 0) as count
            FROM cart_items ci
            JOIN products p ON ci.product_id = p.id
            WHERE ci.cart_id = ? AND p.is_active = TRUE
        `;
        const [result] = await pool.execute(query, [cartId]);
        return result[0].count;
    }
}

module.exports = Cart;
