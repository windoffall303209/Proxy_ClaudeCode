// Model truy vấn và chuẩn hóa dữ liệu address trong MySQL.
const pool = require('../config/database');

class Address {
    // Tạo bản ghi mới.
    static async create(userId, addressData) {
        const { full_name, phone, address_line, ward, district, city, is_default } = addressData;
        const connection = await pool.getConnection();

        try {
            await connection.beginTransaction();

            if (is_default) {
                await connection.execute(
                    'UPDATE addresses SET is_default = FALSE WHERE user_id = ?',
                    [userId]
                );
            }

            const [result] = await connection.execute(
                `INSERT INTO addresses (
                    user_id, full_name, phone, address_line, ward, district, city, is_default
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    userId,
                    full_name,
                    phone,
                    address_line,
                    ward || null,
                    district || null,
                    city,
                    Boolean(is_default)
                ]
            );

            await connection.commit();
            return { id: result.insertId, ...addressData };
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    // Tìm theo người dùng.
    static async findByUser(userId) {
        const [rows] = await pool.execute(
            'SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC',
            [userId]
        );
        return rows;
    }

    // Tìm theo ID.
    static async findById(id) {
        const [rows] = await pool.execute(
            'SELECT * FROM addresses WHERE id = ?',
            [id]
        );
        return rows[0] || null;
    }

    // Lấy bản ghi mặc định.
    static async getDefault(userId) {
        const [rows] = await pool.execute(
            'SELECT * FROM addresses WHERE user_id = ? AND is_default = TRUE LIMIT 1',
            [userId]
        );
        return rows[0] || null;
    }

    // Cập nhật bản ghi hiện có.
    static async update(id, userId, addressData) {
        const { full_name, phone, address_line, ward, district, city, is_default } = addressData;
        const connection = await pool.getConnection();

        try {
            await connection.beginTransaction();

            if (is_default) {
                await connection.execute(
                    'UPDATE addresses SET is_default = FALSE WHERE user_id = ?',
                    [userId]
                );
            }

            const [result] = await connection.execute(
                `UPDATE addresses
                 SET full_name = ?, phone = ?, address_line = ?, ward = ?, district = ?, city = ?, is_default = ?
                 WHERE id = ? AND user_id = ?`,
                [
                    full_name,
                    phone,
                    address_line,
                    ward || null,
                    district || null,
                    city,
                    Boolean(is_default),
                    id,
                    userId
                ]
            );

            if (result.affectedRows === 0) {
                throw new Error('Không tìm thấy địa chỉ cần cập nhật');
            }

            await connection.commit();
            return this.findById(id);
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    // Xóa bản ghi theo điều kiện truyền vào.
    static async delete(id, userId) {
        const connection = await pool.getConnection();

        try {
            await connection.beginTransaction();

            const [addresses] = await connection.execute(
                'SELECT * FROM addresses WHERE id = ? AND user_id = ? LIMIT 1 FOR UPDATE',
                [id, userId]
            );

            const address = addresses[0];
            if (!address) {
                throw new Error('Không tìm thấy địa chỉ cần xóa');
            }

            await connection.execute(
                'DELETE FROM addresses WHERE id = ? AND user_id = ?',
                [id, userId]
            );

            if (address.is_default) {
                const [remaining] = await connection.execute(
                    'SELECT id FROM addresses WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
                    [userId]
                );

                if (remaining[0]?.id) {
                    await connection.execute(
                        'UPDATE addresses SET is_default = TRUE WHERE id = ?',
                        [remaining[0].id]
                    );
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
}

module.exports = Address;
