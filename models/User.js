/**
 * =============================================================================
 * USER MODEL - Model Người dùng
 * =============================================================================
 * File này chứa các phương thức tương tác với bảng users trong database:
 * - Đăng ký người dùng mới
 * - Tìm kiếm người dùng theo email, ID
 * - Xác thực mật khẩu
 * - Cập nhật thông tin cá nhân, avatar
 * - Đổi mật khẩu
 * - Quản lý đồng ý nhận email marketing
 * - Quản lý trạng thái và quyền người dùng (Admin)
 * =============================================================================
 */

const pool = require('../config/database');
const bcrypt = require('bcryptjs');

class User {
    // =============================================================================
    // ĐĂNG KÝ NGƯỜI DÙNG - CREATE USER
    // =============================================================================

    /**
     * Tạo người dùng mới với mật khẩu được mã hóa
     *
     * @description Đăng ký tài khoản mới:
     *              - Mã hóa mật khẩu bằng bcrypt (10 rounds)
     *              - Lưu vào database
     *              - Kiểm tra trùng email
     *
     * @param {Object} userData - Dữ liệu người dùng
     * @param {string} userData.email - Email đăng nhập (unique)
     * @param {string} userData.password - Mật khẩu gốc (sẽ được hash)
     * @param {string} userData.full_name - Họ và tên
     * @param {string} [userData.phone] - Số điện thoại
     * @param {boolean} [userData.marketing_consent=false] - Đồng ý nhận email marketing
     *
     * @returns {Promise<Object>} Thông tin người dùng vừa tạo (không bao gồm password)
     * @throws {Error} Nếu email đã tồn tại
     */
    static async create(userData) {
        const { email, password, full_name, phone, marketing_consent } = userData;

        // Mã hóa mật khẩu với bcrypt (10 salt rounds)
        const password_hash = await bcrypt.hash(password, 10);

        const query = `
            INSERT INTO users (email, password_hash, full_name, phone, marketing_consent)
            VALUES (?, ?, ?, ?, ?)
        `;

        try {
            const [result] = await pool.execute(query, [
                email,
                password_hash,
                full_name,
                phone || null,
                marketing_consent || false
            ]);

            return { id: result.insertId, email, full_name };
        } catch (error) {
            // Xử lý lỗi email trùng lặp
            if (error.code === 'ER_DUP_ENTRY') {
                throw new Error('Email already exists');
            }
            throw error;
        }
    }

    // =============================================================================
    // TÌM NGƯỜI DÙNG THEO EMAIL - FIND BY EMAIL
    // =============================================================================

    /**
     * Tìm người dùng theo email (cho đăng nhập)
     *
     * @description Tìm người dùng bằng email, bao gồm cả tài khoản bị khóa.
     *              Sử dụng cho chức năng đăng nhập để kiểm tra mật khẩu.
     *
     * @param {string} email - Email cần tìm
     *
     * @returns {Promise<Object|null>} Thông tin người dùng hoặc null
     */
    static async findByEmail(email) {
        const query = 'SELECT * FROM users WHERE email = ?';
        const [rows] = await pool.execute(query, [email]);
        return rows[0] || null;
    }

    // =============================================================================
    // TÌM NGƯỜI DÙNG THEO ID - FIND BY ID
    // =============================================================================

    /**
     * Tìm người dùng theo ID
     *
     * @description Tìm người dùng đang hoạt động (is_active = TRUE).
     *              Không trả về password_hash để bảo mật.
     *
     * @param {number} id - ID người dùng
     *
     * @returns {Promise<Object|null>} Thông tin người dùng (không có password) hoặc null
     */
    static async findById(id) {
        const query = 'SELECT id, email, full_name, phone, avatar_url, birthday, role, email_verified, email_verified_at, phone_verified, marketing_consent, created_at FROM users WHERE id = ? AND is_active = TRUE';
        const [rows] = await pool.execute(query, [id]);
        return rows[0] || null;
    }

    // =============================================================================
    // XÁC THỰC MẬT KHẨU - VERIFY PASSWORD
    // =============================================================================

    /**
     * So sánh mật khẩu với hash trong database
     *
     * @description Sử dụng bcrypt.compare để so sánh an toàn.
     *              Tránh timing attack.
     *
     * @param {string} plainPassword - Mật khẩu người dùng nhập
     * @param {string} hashedPassword - Password hash từ database
     *
     * @returns {Promise<boolean>} true nếu khớp, false nếu không khớp
     */
    static async verifyPassword(plainPassword, hashedPassword) {
        return await bcrypt.compare(plainPassword, hashedPassword);
    }

    // =============================================================================
    // CẬP NHẬT PROFILE CƠ BẢN - UPDATE PROFILE
    // =============================================================================

    /**
     * Cập nhật thông tin cá nhân cơ bản
     *
     * @description Cập nhật họ tên và số điện thoại
     *
     * @param {number} id - ID người dùng
     * @param {Object} data - Dữ liệu cập nhật
     * @param {string} data.full_name - Họ và tên mới
     * @param {string} [data.phone] - Số điện thoại mới
     *
     * @returns {Promise<Object>} Thông tin người dùng sau cập nhật
     */
    static async updateProfile(id, data) {
        const { full_name, phone } = data;
        const query = 'UPDATE users SET full_name = ?, phone = ? WHERE id = ?';
        await pool.execute(query, [full_name, phone, id]);
        return await this.findById(id);
    }

    // =============================================================================
    // CẬP NHẬT PROFILE ĐẦY ĐỦ - UPDATE FULL PROFILE
    // =============================================================================

    /**
     * Cập nhật đầy đủ thông tin cá nhân
     *
     * @description Cập nhật họ tên, số điện thoại và ngày sinh
     *
     * @param {number} id - ID người dùng
     * @param {Object} data - Dữ liệu cập nhật
     * @param {string} data.full_name - Họ và tên
     * @param {string} [data.phone] - Số điện thoại
     * @param {string} [data.birthday] - Ngày sinh (YYYY-MM-DD)
     *
     * @returns {Promise<Object>} Thông tin người dùng sau cập nhật
     */
    static async updateFullProfile(id, data) {
        const { full_name, phone, birthday } = data;
        const query = 'UPDATE users SET full_name = ?, phone = ?, birthday = ? WHERE id = ?';
        await pool.execute(query, [full_name, phone || null, birthday || null, id]);
        return await this.findById(id);
    }

    // =============================================================================
    // CẬP NHẬT AVATAR - UPDATE AVATAR
    // =============================================================================

    /**
     * Cập nhật ảnh đại diện người dùng
     *
     * @description Lưu URL ảnh avatar mới
     *
     * @param {number} id - ID người dùng
     * @param {string} avatarUrl - URL ảnh avatar mới
     *
     * @returns {Promise<Object>} Thông tin người dùng sau cập nhật
     */
    static async updateAvatar(id, avatarUrl) {
        const query = 'UPDATE users SET avatar_url = ? WHERE id = ?';
        await pool.execute(query, [avatarUrl, id]);
        return await this.findById(id);
    }

    // =============================================================================
    // ĐỔI MẬT KHẨU - CHANGE PASSWORD
    // =============================================================================

    /**
     * Đổi mật khẩu người dùng
     *
     * @description Quy trình đổi mật khẩu:
     *              1. Xác thực mật khẩu cũ
     *              2. Mã hóa mật khẩu mới
     *              3. Lưu vào database
     *
     * @param {number} id - ID người dùng
     * @param {string} oldPassword - Mật khẩu hiện tại
     * @param {string} newPassword - Mật khẩu mới
     *
     * @returns {Promise<boolean>} true nếu thành công
     * @throws {Error} Nếu mật khẩu cũ không đúng hoặc user không tồn tại
     */
    static async changePassword(id, oldPassword, newPassword) {
        // Lấy password hash hiện tại
        const [rows] = await pool.execute('SELECT password_hash FROM users WHERE id = ?', [id]);
        if (!rows[0]) {
            throw new Error('User not found');
        }

        // Xác thực mật khẩu cũ
        const isValid = await bcrypt.compare(oldPassword, rows[0].password_hash);
        if (!isValid) {
            throw new Error('Mật khẩu hiện tại không đúng');
        }

        // Mã hóa mật khẩu mới
        const newPasswordHash = await bcrypt.hash(newPassword, 10);

        // Cập nhật mật khẩu
        await pool.execute('UPDATE users SET password_hash = ? WHERE id = ?', [newPasswordHash, id]);
        return true;
    }

    // =============================================================================
    // CẬP NHẬT ĐỒNG Ý MARKETING - UPDATE MARKETING CONSENT
    // =============================================================================

    /**
     * Cập nhật trạng thái đồng ý nhận email marketing
     *
     * @description Người dùng có thể bật/tắt việc nhận email quảng cáo
     *
     * @param {number} userId - ID người dùng
     * @param {boolean} consent - true = đồng ý, false = từ chối
     *
     * @returns {Promise<void>}
     */
    static async updateMarketingConsent(userId, consent) {
        const query = 'UPDATE users SET marketing_consent = ? WHERE id = ?';
        await pool.execute(query, [consent, userId]);
    }

    // =============================================================================
    // XÁC THỰC EMAIL - VERIFY EMAIL
    // =============================================================================

    /**
     * Đánh dấu email đã được xác thực
     *
     * @description Cập nhật khi người dùng click link xác thực trong email
     *
     * @param {number} userId - ID người dùng
     *
     * @returns {Promise<void>}
     */
    static async verifyEmail(userId) {
        const query = 'UPDATE users SET email_verified = TRUE WHERE id = ?';
        await pool.execute(query, [userId]);
    }

    // =============================================================================
    // LẤY DANH SÁCH MARKETING - GET MARKETING LIST
    // =============================================================================

    /**
     * Lấy danh sách người dùng đã đồng ý nhận email marketing
     *
     * @description Lấy người dùng thỏa mãn:
     *              - marketing_consent = TRUE
     *              - email_verified = TRUE (tránh spam)
     *              - is_active = TRUE (tài khoản đang hoạt động)
     *
     * @returns {Promise<Array>} Mảng người dùng với id, email, full_name
     */
    static async getMarketingList() {
        const query = 'SELECT id, email, full_name FROM users WHERE marketing_consent = TRUE AND email_verified = TRUE AND is_active = TRUE';
        const [rows] = await pool.execute(query);
        return rows;
    }

    // =============================================================================
    // LẤY TẤT CẢ NGƯỜI DÙNG (ADMIN) - FIND ALL USERS
    // =============================================================================

    /**
     * Lấy danh sách tất cả người dùng (Admin)
     *
     * @description Lấy danh sách người dùng với bộ lọc:
     *              - Theo role (admin, customer)
     *              - Theo từ khóa tìm kiếm (email, tên)
     *              - Phân trang
     *
     * @param {Object} filters - Các điều kiện lọc
     * @param {string} [filters.role] - Lọc theo quyền
     * @param {string} [filters.search] - Từ khóa tìm kiếm
     * @param {number} [filters.limit] - Số kết quả tối đa
     * @param {number} [filters.offset=0] - Bỏ qua bao nhiêu kết quả
     *
     * @returns {Promise<Array>} Mảng thông tin người dùng
     */
    static async findAll(filters = {}) {
        let query = 'SELECT id, email, full_name, phone, role, email_verified, marketing_consent, is_active, created_at FROM users WHERE 1=1';
        const params = [];

        // Lọc theo role
        if (filters.role) {
            query += ' AND role = ?';
            params.push(filters.role);
        }

        // Tìm kiếm theo email hoặc tên
        if (filters.search) {
            query += ' AND (email LIKE ? OR full_name LIKE ?)';
            params.push(`%${filters.search}%`, `%${filters.search}%`);
        }

        // Sắp xếp theo ngày đăng ký mới nhất
        query += ' ORDER BY created_at DESC';

        // Phân trang
        if (filters.limit) {
            const limit = parseInt(filters.limit) || 50;
            const offset = parseInt(filters.offset) || 0;
            query += ` LIMIT ${limit} OFFSET ${offset}`;
        }

        const [rows] = await pool.query(query, params);
        return rows;
    }

    // =============================================================================
    // CẬP NHẬT TRẠNG THÁI (ADMIN) - UPDATE STATUS
    // =============================================================================

    /**
     * Khóa hoặc mở khóa tài khoản người dùng (Admin)
     *
     * @description Admin có thể khóa tài khoản vi phạm chính sách
     *
     * @param {number} id - ID người dùng
     * @param {boolean} isActive - true = hoạt động, false = bị khóa
     *
     * @returns {Promise<void>}
     */
    static async updateStatus(id, isActive) {
        const query = 'UPDATE users SET is_active = ? WHERE id = ?';
        await pool.execute(query, [isActive, id]);
    }

    // =============================================================================
    // CẬP NHẬT QUYỀN (ADMIN) - UPDATE ROLE
    // =============================================================================

    /**
     * Thay đổi quyền người dùng (Admin)
     *
     * @description Thay đổi quyền: 'customer' hoặc 'admin'
     *
     * @param {number} id - ID người dùng
     * @param {string} role - Quyền mới ('customer' hoặc 'admin')
     *
     * @returns {Promise<void>}
     */
    static async updateRole(id, role) {
        const query = 'UPDATE users SET role = ? WHERE id = ?';
        await pool.execute(query, [role, id]);
    }

    // =============================================================================
    // XÁC NHẬN EMAIL - EMAIL VERIFICATION
    // =============================================================================

    /**
     * Tạo mã xác nhận email 6 số
     *
     * @description Tạo mã ngẫu nhiên 6 chữ số và lưu vào database
     *              Mã có thời hạn 10 phút
     *
     * @param {number} userId - ID người dùng
     *
     * @returns {Promise<string>} Mã xác nhận 6 số
     */
    static async generateVerificationCode(userId) {
        // Tạo mã 6 số ngẫu nhiên
        const code = Math.floor(100000 + Math.random() * 900000).toString();

        // Thời gian hết hạn: 10 phút
        const expires = new Date(Date.now() + 10 * 60 * 1000);

        const query = 'UPDATE users SET verification_code = ?, verification_expires = ? WHERE id = ?';
        await pool.execute(query, [code, expires, userId]);

        return code;
    }

    /**
     * Xác nhận mã email
     *
     * @description Kiểm tra mã xác nhận có đúng và còn hạn không
     *              Nếu đúng, đánh dấu email đã xác nhận
     *
     * @param {number} userId - ID người dùng
     * @param {string} code - Mã xác nhận 6 số
     *
     * @returns {Promise<Object>} { success: boolean, message: string }
     */
    static async verifyEmailCode(userId, code) {
        const query = 'SELECT verification_code, verification_expires, email_verified FROM users WHERE id = ?';
        const [rows] = await pool.execute(query, [userId]);

        if (!rows[0]) {
            return { success: false, message: 'Người dùng không tồn tại' };
        }

        const user = rows[0];

        // Đã xác nhận rồi
        if (user.email_verified) {
            return { success: false, message: 'Email đã được xác nhận trước đó' };
        }

        // Chưa có mã xác nhận
        if (!user.verification_code) {
            return { success: false, message: 'Chưa có mã xác nhận. Vui lòng yêu cầu gửi lại mã.' };
        }

        // Mã đã hết hạn
        if (new Date() > new Date(user.verification_expires)) {
            return { success: false, message: 'Mã xác nhận đã hết hạn. Vui lòng yêu cầu gửi lại mã.' };
        }

        // Mã không đúng
        if (user.verification_code !== code) {
            return { success: false, message: 'Mã xác nhận không đúng' };
        }

        // Xác nhận thành công - cập nhật database
        const updateQuery = `
            UPDATE users
            SET email_verified = TRUE,
                email_verified_at = NOW(),
                verification_code = NULL,
                verification_expires = NULL
            WHERE id = ?
        `;
        await pool.execute(updateQuery, [userId]);

        return { success: true, message: 'Xác nhận email thành công!' };
    }

    /**
     * Kiểm tra email đã xác nhận chưa
     *
     * @param {number} userId - ID người dùng
     *
     * @returns {Promise<boolean>} true nếu đã xác nhận
     */
    static async isEmailVerified(userId) {
        const query = 'SELECT email_verified FROM users WHERE id = ?';
        const [rows] = await pool.execute(query, [userId]);
        return rows[0]?.email_verified || false;
    }

    // =============================================================================
    // QUÊN MẬT KHẨU - PASSWORD RESET
    // =============================================================================

    /**
     * Tạo mã đặt lại mật khẩu 6 số
     *
     * @description Tạo mã ngẫu nhiên 6 chữ số và lưu vào database
     *              Mã có thời hạn 10 phút
     *
     * @param {string} email - Email người dùng
     *
     * @returns {Promise<Object>} { success, code, user } hoặc { success: false, message }
     */
    static async generateResetCode(email) {
        // Tìm user theo email
        const user = await this.findByEmail(email);

        if (!user) {
            return { success: false, message: 'Email không tồn tại trong hệ thống' };
        }

        // Kiểm tra tài khoản có bị khóa không
        if (!user.is_active) {
            return { success: false, message: 'Tài khoản đã bị khóa' };
        }

        // Tạo mã 6 số ngẫu nhiên
        const code = Math.floor(100000 + Math.random() * 900000).toString();

        // Thời gian hết hạn: 10 phút
        const expires = new Date(Date.now() + 10 * 60 * 1000);

        const query = 'UPDATE users SET reset_code = ?, reset_code_expires = ? WHERE id = ?';
        await pool.execute(query, [code, expires, user.id]);

        return { success: true, code, user: { id: user.id, email: user.email, full_name: user.full_name } };
    }

    /**
     * Xác nhận mã đặt lại mật khẩu
     *
     * @description Kiểm tra mã có đúng và còn hạn không
     *
     * @param {string} email - Email người dùng
     * @param {string} code - Mã xác nhận 6 số
     *
     * @returns {Promise<Object>} { success: boolean, userId, message }
     */
    static async verifyResetCode(email, code) {
        const query = 'SELECT id, reset_code, reset_code_expires FROM users WHERE email = ?';
        const [rows] = await pool.execute(query, [email]);

        if (!rows[0]) {
            return { success: false, message: 'Email không tồn tại' };
        }

        const user = rows[0];

        // Chưa có mã reset
        if (!user.reset_code) {
            return { success: false, message: 'Chưa có mã đặt lại mật khẩu. Vui lòng yêu cầu gửi lại mã.' };
        }

        // Mã đã hết hạn
        if (new Date() > new Date(user.reset_code_expires)) {
            return { success: false, message: 'Mã đã hết hạn. Vui lòng yêu cầu gửi lại mã.' };
        }

        // Mã không đúng
        if (user.reset_code !== code) {
            return { success: false, message: 'Mã xác nhận không đúng' };
        }

        return { success: true, userId: user.id, message: 'Mã xác nhận hợp lệ' };
    }

    /**
     * Đặt lại mật khẩu mới
     *
     * @description Cập nhật mật khẩu mới sau khi xác nhận mã thành công
     *
     * @param {string} email - Email người dùng
     * @param {string} code - Mã xác nhận 6 số
     * @param {string} newPassword - Mật khẩu mới
     *
     * @returns {Promise<Object>} { success: boolean, message }
     */
    static async resetPassword(email, code, newPassword) {
        // Xác nhận mã trước
        const verifyResult = await this.verifyResetCode(email, code);

        if (!verifyResult.success) {
            return verifyResult;
        }

        // Mã hóa mật khẩu mới
        const newPasswordHash = await bcrypt.hash(newPassword, 10);

        // Cập nhật mật khẩu và xóa mã reset
        const query = `
            UPDATE users
            SET password_hash = ?,
                reset_code = NULL,
                reset_code_expires = NULL
            WHERE id = ?
        `;
        await pool.execute(query, [newPasswordHash, verifyResult.userId]);

        return { success: true, message: 'Đặt lại mật khẩu thành công!' };
    }
}

module.exports = User;
