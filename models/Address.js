/**
 * =============================================================================
 * ADDRESS MODEL - Model Địa chỉ giao hàng
 * =============================================================================
 * File này chứa các phương thức tương tác với bảng addresses trong database:
 * - Tạo địa chỉ mới
 * - Lấy danh sách địa chỉ của người dùng
 * - Tìm địa chỉ theo ID
 * - Lấy địa chỉ mặc định
 * - Cập nhật địa chỉ
 * - Xóa địa chỉ
 * =============================================================================
 */

const pool = require('../config/database');

class Address {
    // =============================================================================
    // TẠO ĐỊA CHỈ MỚI - CREATE ADDRESS
    // =============================================================================

    /**
     * Tạo địa chỉ giao hàng mới
     *
     * @description Thêm một địa chỉ mới cho người dùng.
     *              Sử dụng transaction để đảm bảo:
     *              - Nếu đặt làm địa chỉ mặc định, bỏ flag của các địa chỉ khác
     *              - Rollback nếu có lỗi xảy ra
     *
     * @param {number} userId - ID người dùng
     * @param {Object} addressData - Dữ liệu địa chỉ
     * @param {string} addressData.full_name - Họ và tên người nhận
     * @param {string} addressData.phone - Số điện thoại người nhận
     * @param {string} addressData.address_line - Địa chỉ chi tiết (số nhà, đường)
     * @param {string} [addressData.ward] - Phường/Xã
     * @param {string} [addressData.district] - Quận/Huyện
     * @param {string} addressData.city - Tỉnh/Thành phố
     * @param {boolean} [addressData.is_default=false] - Đặt làm địa chỉ mặc định
     *
     * @returns {Promise<Object>} Địa chỉ vừa tạo với ID
     * @throws {Error} Nếu có lỗi trong quá trình tạo
     */
    static async create(userId, addressData) {
        const { full_name, phone, address_line, ward, district, city, is_default } = addressData;

        // Lấy connection từ pool để sử dụng transaction
        const connection = await pool.getConnection();

        try {
            // Bắt đầu transaction
            await connection.beginTransaction();

            // Nếu đặt làm mặc định, bỏ flag của các địa chỉ khác
            if (is_default) {
                await connection.execute(
                    'UPDATE addresses SET is_default = FALSE WHERE user_id = ?',
                    [userId]
                );
            }

            // Thêm địa chỉ mới
            const query = `
                INSERT INTO addresses (user_id, full_name, phone, address_line, ward, district, city, is_default)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `;

            const [result] = await connection.execute(query, [
                userId,
                full_name,
                phone,
                address_line,
                ward || null,
                district || null,
                city,
                is_default || false
            ]);

            // Commit transaction
            await connection.commit();
            return { id: result.insertId, ...addressData };
        } catch (error) {
            // Rollback nếu có lỗi
            await connection.rollback();
            throw error;
        } finally {
            // Trả connection về pool
            connection.release();
        }
    }

    // =============================================================================
    // LẤY DANH SÁCH ĐỊA CHỈ - FIND BY USER
    // =============================================================================

    /**
     * Lấy tất cả địa chỉ của người dùng
     *
     * @description Lấy danh sách địa chỉ, địa chỉ mặc định lên đầu.
     *              Sắp xếp theo: is_default DESC, created_at DESC
     *
     * @param {number} userId - ID người dùng
     *
     * @returns {Promise<Array>} Mảng địa chỉ của người dùng
     */
    static async findByUser(userId) {
        const query = 'SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC';
        const [rows] = await pool.execute(query, [userId]);
        return rows;
    }

    // =============================================================================
    // TÌM ĐỊA CHỈ THEO ID - FIND BY ID
    // =============================================================================

    /**
     * Tìm địa chỉ theo ID
     *
     * @description Lấy thông tin chi tiết của một địa chỉ
     *
     * @param {number} id - ID địa chỉ
     *
     * @returns {Promise<Object|null>} Thông tin địa chỉ hoặc null
     */
    static async findById(id) {
        const query = 'SELECT * FROM addresses WHERE id = ?';
        const [rows] = await pool.execute(query, [id]);
        return rows[0] || null;
    }

    // =============================================================================
    // LẤY ĐỊA CHỈ MẶC ĐỊNH - GET DEFAULT ADDRESS
    // =============================================================================

    /**
     * Lấy địa chỉ mặc định của người dùng
     *
     * @description Lấy địa chỉ có is_default = TRUE.
     *              Thường dùng để điền sẵn khi checkout.
     *
     * @param {number} userId - ID người dùng
     *
     * @returns {Promise<Object|null>} Địa chỉ mặc định hoặc null
     */
    static async getDefault(userId) {
        const query = 'SELECT * FROM addresses WHERE user_id = ? AND is_default = TRUE LIMIT 1';
        const [rows] = await pool.execute(query, [userId]);
        return rows[0] || null;
    }

    // =============================================================================
    // CẬP NHẬT ĐỊA CHỈ - UPDATE ADDRESS
    // =============================================================================

    /**
     * Cập nhật thông tin địa chỉ
     *
     * @description Cập nhật địa chỉ của người dùng.
     *              Sử dụng transaction để xử lý flag is_default an toàn.
     *              Chỉ cho phép cập nhật địa chỉ của chính user đó (user_id).
     *
     * @param {number} id - ID địa chỉ cần cập nhật
     * @param {number} userId - ID người dùng (để xác thực quyền sở hữu)
     * @param {Object} addressData - Dữ liệu cập nhật
     *
     * @returns {Promise<Object>} Địa chỉ sau khi cập nhật
     * @throws {Error} Nếu có lỗi trong quá trình cập nhật
     */
    static async update(id, userId, addressData) {
        const { full_name, phone, address_line, ward, district, city, is_default } = addressData;

        // Lấy connection để sử dụng transaction
        const connection = await pool.getConnection();

        try {
            // Bắt đầu transaction
            await connection.beginTransaction();

            // Nếu đặt làm mặc định, bỏ flag của các địa chỉ khác
            if (is_default) {
                await connection.execute(
                    'UPDATE addresses SET is_default = FALSE WHERE user_id = ?',
                    [userId]
                );
            }

            // Cập nhật địa chỉ (kiểm tra user_id để đảm bảo quyền sở hữu)
            const query = `
                UPDATE addresses
                SET full_name = ?, phone = ?, address_line = ?, ward = ?, district = ?, city = ?, is_default = ?
                WHERE id = ? AND user_id = ?
            `;

            await connection.execute(query, [
                full_name,
                phone,
                address_line,
                ward || null,
                district || null,
                city,
                is_default || false,
                id,
                userId
            ]);

            // Commit transaction
            await connection.commit();
            return await this.findById(id);
        } catch (error) {
            // Rollback nếu có lỗi
            await connection.rollback();
            throw error;
        } finally {
            // Trả connection về pool
            connection.release();
        }
    }

    // =============================================================================
    // XÓA ĐỊA CHỈ - DELETE ADDRESS
    // =============================================================================

    /**
     * Xóa địa chỉ
     *
     * @description Xóa vĩnh viễn địa chỉ khỏi database.
     *              Chỉ cho phép xóa địa chỉ của chính user đó (user_id).
     *
     * @param {number} id - ID địa chỉ cần xóa
     * @param {number} userId - ID người dùng (để xác thực quyền sở hữu)
     *
     * @returns {Promise<void>}
     */
    static async delete(id, userId) {
        // Xóa với điều kiện user_id để đảm bảo an toàn
        const query = 'DELETE FROM addresses WHERE id = ? AND user_id = ?';
        await pool.execute(query, [id, userId]);
    }
}

module.exports = Address;
