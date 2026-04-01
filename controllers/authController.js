/**
 * =============================================================================
 * AUTH CONTROLLER - Điều khiển xác thực người dùng
 * =============================================================================
 * File này chứa các hàm xử lý logic liên quan đến xác thực:
 * - Đăng ký tài khoản mới
 * - Đăng nhập / Đăng xuất
 * - Quản lý profile người dùng
 * - Upload avatar
 * - Đổi mật khẩu
 * - Quản lý địa chỉ giao hàng
 * =============================================================================
 */

const User = require('../models/User');
const { generateToken } = require('../middleware/auth');
const emailService = require('../services/emailService');
const multer = require('multer');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { uploadToCloudinary } = require('../config/cloudinary');

function getAuthCookieOptions() {
    return {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000
    };
}

// =============================================================================
// CẤU HÌNH UPLOAD AVATAR
// =============================================================================

/**
 * Cấu hình lưu trữ file avatar
 *
 * @description Định nghĩa thư mục lưu và cách đặt tên file avatar
 */
// Cấu hình lưu trữ tạm trước khi upload lên Cloudinary
const avatarTempDir = path.join(os.tmpdir(), 'tmdt_avatars');
if (!fs.existsSync(avatarTempDir)) {
    fs.mkdirSync(avatarTempDir, { recursive: true });
}

const avatarStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, avatarTempDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = `avatar_${req.user.id}_${Date.now()}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

/**
 * Middleware upload avatar với các ràng buộc
 * - Giới hạn dung lượng: 5MB
 * - Chỉ chấp nhận file ảnh: jpeg, jpg, png, gif, webp
 * - Upload lên Cloudinary, xóa file tạm sau khi upload
 */
const uploadAvatar = multer({
    storage: avatarStorage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (extname && mimetype) {
            return cb(null, true);
        }
        cb(new Error('Chỉ chấp nhận file ảnh (jpeg, jpg, png, gif, webp)'));
    }
}).single('avatar');

// =============================================================================
// ĐĂNG KÝ / ĐĂNG NHẬP / ĐĂNG XUẤT
// =============================================================================

/**
 * Đăng ký tài khoản mới
 *
 * @description Tạo tài khoản người dùng mới, gửi email chào mừng,
 *              tạo token JWT và đăng nhập tự động
 *
 * @param {Object} req - Request object từ Express
 * @param {Object} req.body - Dữ liệu đăng ký
 * @param {string} req.body.email - Email đăng ký (bắt buộc)
 * @param {string} req.body.password - Mật khẩu (bắt buộc)
 * @param {string} req.body.full_name - Họ tên (bắt buộc)
 * @param {string} [req.body.phone] - Số điện thoại
 * @param {string} [req.body.marketing_consent] - Đồng ý nhận email marketing
 * @param {Object} res - Response object từ Express
 *
 * @returns {Redirect|JSON} Redirect về trang chủ hoặc trả về JSON với token
 */
exports.register = async (req, res) => {
    try {
        // Lấy dữ liệu từ form đăng ký
        const { email, password, confirm_password, full_name, phone, marketing_consent } = req.body;

        // =====================================================================
        // VALIDATION
        // =====================================================================
        const errors = [];

        // --- Họ và tên ---
        const trimmedName = (full_name || '').trim();
        if (!trimmedName) {
            errors.push('Họ và tên là bắt buộc');
        } else if (trimmedName.length < 2) {
            errors.push('Họ và tên phải có ít nhất 2 ký tự');
        } else if (trimmedName.length > 100) {
            errors.push('Họ và tên không được vượt quá 100 ký tự');
        } else if (!/^[\p{L}\s]+$/u.test(trimmedName)) {
            errors.push('Họ và tên chỉ được chứa chữ cái và khoảng trắng');
        }

        // --- Email ---
        const trimmedEmail = (email || '').trim().toLowerCase();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!trimmedEmail) {
            errors.push('Email là bắt buộc');
        } else if (trimmedEmail.length > 255) {
            errors.push('Email không được vượt quá 255 ký tự');
        } else if (!emailRegex.test(trimmedEmail)) {
            errors.push('Email không đúng định dạng');
        }

        // --- Mật khẩu ---
        if (!password) {
            errors.push('Mật khẩu là bắt buộc');
        } else if (password.length < 6) {
            errors.push('Mật khẩu phải có ít nhất 6 ký tự');
        } else if (password.length > 50) {
            errors.push('Mật khẩu không được vượt quá 50 ký tự');
        } else {
            if (!/[A-Z]/.test(password)) {
                errors.push('Mật khẩu phải chứa ít nhất 1 chữ cái viết hoa');
            }
            if (!/[a-z]/.test(password)) {
                errors.push('Mật khẩu phải chứa ít nhất 1 chữ cái viết thường');
            }
            if (!/[0-9]/.test(password)) {
                errors.push('Mật khẩu phải chứa ít nhất 1 chữ số');
            }
        }

        // --- Xác nhận mật khẩu ---
        if (!confirm_password) {
            errors.push('Xác nhận mật khẩu là bắt buộc');
        } else if (password && password !== confirm_password) {
            errors.push('Xác nhận mật khẩu không khớp');
        }

        // --- Số điện thoại (không bắt buộc) ---
        const trimmedPhone = (phone || '').trim();
        if (trimmedPhone) {
            const phoneRegex = /^(0[2-9])\d{8}$/;
            if (!phoneRegex.test(trimmedPhone)) {
                errors.push('Số điện thoại không hợp lệ (VD: 0912345678)');
            }
        }

        // Nếu có lỗi, trả về
        if (errors.length > 0) {
            if (req.accepts('html')) {
                return res.render('auth/register', {
                    error: errors.join('. '),
                    formData: req.body
                });
            }
            return res.status(400).json({ message: errors.join('. '), errors });
        }

        // Tạo user mới trong database
        const user = await User.create({
            email: trimmedEmail,
            password,
            full_name: trimmedName,
            phone: trimmedPhone || null,
            marketing_consent: marketing_consent === 'on' || marketing_consent === true
        });

        // Gửi email chào mừng (async, không chờ kết quả)
        emailService.sendWelcomeEmail(user).catch(err => console.error('Email error:', err));

        // Tạo JWT token cho user
        const token = generateToken(user);

        // Lưu token vào cookie (httpOnly để bảo mật)
        res.cookie('token', token, getAuthCookieOptions());

        // Redirect về trang chủ nếu là request HTML
        if (req.accepts('html')) {
            return res.redirect('/');
        }

        // Trả về JSON cho API request
        res.status(201).json({
            message: 'Registration successful',
            user: { id: user.id, email: user.email, full_name: user.full_name },
            token
        });
    } catch (error) {
        console.error('Registration error:', error);

        // Hiển thị lại form đăng ký với lỗi
        if (req.accepts('html')) {
            return res.render('auth/register', {
                error: error.message,
                formData: req.body
            });
        }

        res.status(400).json({ message: error.message });
    }
};

/**
 * Đăng nhập
 *
 * @description Xác thực email/password, tạo JWT token,
 *              merge giỏ hàng khách vào tài khoản
 *
 * @param {Object} req - Request object từ Express
 * @param {Object} req.body - Thông tin đăng nhập
 * @param {string} req.body.email - Email đăng nhập
 * @param {string} req.body.password - Mật khẩu
 * @param {Object} res - Response object từ Express
 *
 * @returns {Redirect|JSON} Redirect về trang chủ hoặc trả về JSON với token
 */
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate dữ liệu bắt buộc
        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }

        // Tìm user theo email
        const user = await User.findByEmail(email);
        if (!user) {
            throw new Error('Email hoặc mật khẩu không đúng');
        }

        // Kiểm tra mật khẩu
        const isValid = await User.verifyPassword(password, user.password_hash);
        if (!isValid) {
            throw new Error('Email hoặc mật khẩu không đúng');
        }

        // Kiểm tra tài khoản có bị khóa không
        if (user.is_active === false || user.is_active === 0) {
            throw new Error('Tài khoản của bạn đã bị khóa do vi phạm điều khoản sử dụng. Vui lòng liên hệ hỗ trợ.');
        }

        // Tạo JWT token
        const token = generateToken(user);

        // Lưu token vào cookie
        res.cookie('token', token, getAuthCookieOptions());

        // Merge giỏ hàng của khách (session) vào tài khoản đã đăng nhập
        if (req.sessionID) {
            const Cart = require('../models/Cart');
            await Cart.mergeGuestCart(user.id, req.sessionID).catch(err => {
                console.error('Cart merge error:', err);
            });
        }

        // Redirect về trang chủ
        if (req.accepts('html')) {
            return res.redirect('/');
        }

        // Trả về JSON cho API
        res.json({
            message: 'Login successful',
            user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role },
            token
        });
    } catch (error) {
        console.error('Login error:', error);

        // Hiển thị lại form đăng nhập với lỗi
        if (req.accepts('html')) {
            return res.render('auth/login', {
                error: error.message,
                email: req.body.email
            });
        }

        res.status(401).json({ message: error.message });
    }
};

/**
 * Đăng xuất
 *
 * @description Xóa cookie token để đăng xuất người dùng
 *
 * @param {Object} req - Request object từ Express
 * @param {Object} res - Response object từ Express
 *
 * @returns {Redirect|JSON} Redirect về trang chủ hoặc trả về JSON
 */
exports.logout = (req, res) => {
    // Xóa cookie chứa token
    const { maxAge, ...cookieOptions } = getAuthCookieOptions();
    res.clearCookie('token', cookieOptions);

    if (req.accepts('html')) {
        return res.redirect('/');
    }

    res.json({ message: 'Logout successful' });
};

// =============================================================================
// QUẢN LÝ PROFILE
// =============================================================================

/**
 * Lấy thông tin profile người dùng
 *
 * @description Hiển thị trang profile với thông tin user hiện tại
 *
 * @param {Object} req - Request object từ Express
 * @param {Object} res - Response object từ Express
 *
 * @returns {Render|JSON} Render trang profile hoặc trả về JSON
 */
exports.getProfile = async (req, res) => {
    try {
        // Lấy thông tin user từ database (mới nhất)
        const user = await User.findById(req.user.id);

        if (!user) {
            // User không tồn tại - redirect về login
            return res.redirect('/auth/login');
        }

        if (req.accepts('html')) {
            return res.render('user/profile', {
                user,
                category: null,
                path: '/auth/profile'
            });
        }

        res.json({ user });
    } catch (error) {
        console.error('Profile Error:', error);
        if (req.accepts('html')) {
            return res.redirect('/auth/login');
        }
        res.status(500).json({ message: error.message });
    }
};

/**
 * Cập nhật thông tin profile cơ bản
 *
 * @description Cập nhật họ tên và số điện thoại
 *
 * @param {Object} req - Request object từ Express
 * @param {Object} req.body.full_name - Họ tên mới
 * @param {Object} req.body.phone - Số điện thoại mới
 * @param {Object} res - Response object từ Express
 *
 * @returns {Redirect|JSON} Redirect về trang profile hoặc trả về JSON
 */
exports.updateProfile = async (req, res) => {
    try {
        const { full_name, phone } = req.body;

        // Cập nhật profile trong database
        const updatedUser = await User.updateProfile(req.user.id, {
            full_name,
            phone
        });

        if (req.accepts('html')) {
            return res.redirect('/user/profile');
        }

        res.json({
            message: 'Profile updated successfully',
            user: updatedUser
        });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

/**
 * Hiển thị trang đăng ký
 *
 * @param {Object} req - Request object từ Express
 * @param {Object} res - Response object từ Express
 */
exports.showRegister = (req, res) => {
    res.render('auth/register', { error: null, formData: {} });
};

/**
 * Hiển thị trang đăng nhập
 *
 * @param {Object} req - Request object từ Express
 * @param {Object} res - Response object từ Express
 */
exports.showLogin = (req, res) => {
    res.render('auth/login', { error: null, email: '' });
};

// =============================================================================
// QUẢN LÝ ĐỊA CHỈ
// =============================================================================

/**
 * Tạo địa chỉ giao hàng mới
 *
 * @description Thêm địa chỉ giao hàng mới cho người dùng
 *
 * @param {Object} req - Request object từ Express
 * @param {Object} req.body - Thông tin địa chỉ
 * @param {string} req.body.full_name - Họ tên người nhận
 * @param {string} req.body.phone - Số điện thoại
 * @param {string} req.body.address_line - Địa chỉ chi tiết
 * @param {string} [req.body.ward] - Phường/Xã
 * @param {string} [req.body.district] - Quận/Huyện
 * @param {string} req.body.city - Tỉnh/Thành phố
 * @param {boolean} [req.body.is_default] - Đặt làm địa chỉ mặc định
 * @param {Object} res - Response object từ Express
 *
 * @returns {JSON} Trả về JSON với địa chỉ vừa tạo
 */
exports.createAddress = async (req, res) => {
    try {
        const Address = require('../models/Address');
        const { full_name, phone, address_line, ward, district, city, is_default } = req.body;

        // Validate dữ liệu bắt buộc
        if (!full_name || !phone || !address_line || !city) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng điền đầy đủ thông tin bắt buộc'
            });
        }

        // Tạo địa chỉ mới
        const address = await Address.create(req.user.id, {
            full_name,
            phone,
            address_line,
            ward,
            district,
            city,
            is_default: is_default === true || is_default === 'true' || is_default === 'on'
        });

        res.json({
            success: true,
            message: 'Đã lưu địa chỉ thành công',
            address
        });
    } catch (error) {
        console.error('Create address error:', error);
        res.status(400).json({ success: false, message: error.message });
    }
};

/**
 * Cập nhật đầy đủ thông tin profile
 *
 * @description Cập nhật họ tên, số điện thoại và ngày sinh
 *
 * @param {Object} req - Request object từ Express
 * @param {Object} req.body - Thông tin cập nhật
 * @param {string} req.body.full_name - Họ tên (tối thiểu 2 ký tự)
 * @param {string} [req.body.phone] - Số điện thoại
 * @param {string} [req.body.birthday] - Ngày sinh (YYYY-MM-DD)
 * @param {Object} res - Response object từ Express
 *
 * @returns {JSON} Trả về JSON với thông tin user đã cập nhật
 */
exports.updateFullProfile = async (req, res) => {
    try {
        const { full_name, phone, birthday } = req.body;

        // Validate họ tên
        if (!full_name || full_name.trim().length < 2) {
            return res.status(400).json({
                success: false,
                message: 'Họ tên phải có ít nhất 2 ký tự'
            });
        }

        // Cập nhật profile
        const updatedUser = await User.updateFullProfile(req.user.id, {
            full_name: full_name.trim(),
            phone: phone?.trim() || null,
            birthday: birthday || null
        });

        res.json({
            success: true,
            message: 'Cập nhật thông tin thành công',
            user: updatedUser
        });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(400).json({ success: false, message: error.message });
    }
};

// =============================================================================
// ĐỔI MẬT KHẨU
// =============================================================================

/**
 * Đổi mật khẩu
 *
 * @description Thay đổi mật khẩu của người dùng đã đăng nhập
 *
 * @param {Object} req - Request object từ Express
 * @param {Object} req.body - Thông tin đổi mật khẩu
 * @param {string} req.body.current_password - Mật khẩu hiện tại
 * @param {string} req.body.new_password - Mật khẩu mới (tối thiểu 6 ký tự)
 * @param {string} req.body.confirm_password - Xác nhận mật khẩu mới
 * @param {Object} res - Response object từ Express
 *
 * @returns {JSON} Trả về JSON với thông báo thành công/thất bại
 */
exports.changePassword = async (req, res) => {
    try {
        const { current_password, new_password, confirm_password } = req.body;

        // Validate dữ liệu bắt buộc
        if (!current_password || !new_password || !confirm_password) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng điền đầy đủ thông tin'
            });
        }

        // Validate độ dài mật khẩu mới
        if (new_password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Mật khẩu mới phải có ít nhất 6 ký tự'
            });
        }

        // Kiểm tra xác nhận mật khẩu
        if (new_password !== confirm_password) {
            return res.status(400).json({
                success: false,
                message: 'Xác nhận mật khẩu không khớp'
            });
        }

        // Thực hiện đổi mật khẩu
        await User.changePassword(req.user.id, current_password, new_password);

        res.json({
            success: true,
            message: 'Đổi mật khẩu thành công'
        });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(400).json({ success: false, message: error.message });
    }
};

// =============================================================================
// UPLOAD AVATAR
// =============================================================================

/**
 * Xử lý upload avatar
 *
 * @description Upload và cập nhật ảnh đại diện của người dùng
 *
 * @param {Object} req - Request object từ Express
 * @param {Object} req.file - File ảnh upload (từ multer)
 * @param {Object} res - Response object từ Express
 *
 * @returns {JSON} Trả về JSON với URL avatar mới
 */
exports.handleAvatarUpload = (req, res) => {
    // Sử dụng middleware uploadAvatar để xử lý file
    uploadAvatar(req, res, async (err) => {
        // Xử lý lỗi upload
        if (err) {
            console.error('Avatar upload error:', err);
            return res.status(400).json({
                success: false,
                message: err.message || 'Lỗi upload ảnh'
            });
        }

        // Kiểm tra có file được upload không
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng chọn file ảnh'
            });
        }

        try {
            // Upload lên Cloudinary
            const cloudResult = await uploadToCloudinary(req.file.path, {
                folder: 'tmdt_ecommerce/avatars'
            });

            // Xóa file tạm
            try {
                if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            } catch (e) { /* ignore */ }

            if (!cloudResult.success) {
                return res.status(500).json({
                    success: false,
                    message: 'Lỗi upload ảnh lên cloud: ' + cloudResult.error
                });
            }

            // Lưu Cloudinary URL vào database
            const avatarUrl = cloudResult.url;
            const updatedUser = await User.updateAvatar(req.user.id, avatarUrl);

            res.json({
                success: true,
                message: 'Cập nhật ảnh đại diện thành công',
                avatar_url: avatarUrl,
                user: updatedUser
            });
        } catch (error) {
            console.error('Update avatar error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    });
};

// =============================================================================
// XÁC NHẬN EMAIL - EMAIL VERIFICATION
// =============================================================================

/**
 * Hiển thị trang xác nhận email
 *
 * @description Render trang nhập mã xác nhận 6 số
 *
 * @param {Object} req - Request object từ Express
 * @param {Object} res - Response object từ Express
 */
exports.showVerifyEmail = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.redirect('/auth/login');
        }

        // Nếu email đã xác nhận, redirect về profile
        if (user.email_verified) {
            return res.redirect('/user/profile');
        }

        res.render('auth/verify-email', {
            user,
            error: null,
            success: null
        });
    } catch (error) {
        console.error('Show verify email error:', error);
        res.redirect('/user/profile');
    }
};

/**
 * Gửi mã xác nhận email
 *
 * @description Tạo mã 6 số và gửi qua email
 *
 * @param {Object} req - Request object từ Express
 * @param {Object} res - Response object từ Express
 *
 * @returns {JSON} Trả về JSON với thông báo thành công/thất bại
 */
exports.sendVerificationCode = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Người dùng không tồn tại'
            });
        }

        // Kiểm tra email đã xác nhận chưa
        if (user.email_verified) {
            return res.status(400).json({
                success: false,
                message: 'Email đã được xác nhận trước đó'
            });
        }

        // Tạo mã xác nhận 6 số
        const verificationCode = await User.generateVerificationCode(req.user.id);

        // Gửi email xác nhận
        const emailSent = await emailService.sendVerificationEmail(user, verificationCode);

        if (!emailSent) {
            return res.status(500).json({
                success: false,
                message: 'Không thể gửi email. Vui lòng thử lại sau.'
            });
        }

        res.json({
            success: true,
            message: 'Mã xác nhận đã được gửi đến email của bạn. Mã có hiệu lực trong 10 phút.'
        });
    } catch (error) {
        console.error('Send verification code error:', error);
        res.status(500).json({
            success: false,
            message: 'Đã xảy ra lỗi. Vui lòng thử lại sau.'
        });
    }
};

/**
 * Xác nhận mã email
 *
 * @description Kiểm tra mã 6 số và đánh dấu email đã xác nhận
 *
 * @param {Object} req - Request object từ Express
 * @param {Object} req.body.code - Mã xác nhận 6 số
 * @param {Object} res - Response object từ Express
 *
 * @returns {JSON} Trả về JSON với thông báo thành công/thất bại
 */
exports.verifyEmailCode = async (req, res) => {
    try {
        const { code } = req.body;

        // Validate mã xác nhận
        if (!code || code.length !== 6) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng nhập mã xác nhận 6 số'
            });
        }

        // Xác nhận mã
        const result = await User.verifyEmailCode(req.user.id, code);

        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: result.message
            });
        }

        res.json({
            success: true,
            message: result.message
        });
    } catch (error) {
        console.error('Verify email code error:', error);
        res.status(500).json({
            success: false,
            message: 'Đã xảy ra lỗi. Vui lòng thử lại sau.'
        });
    }
};

// =============================================================================
// QUÊN MẬT KHẨU - FORGOT PASSWORD
// =============================================================================

/**
 * Hiển thị trang quên mật khẩu
 */
exports.showForgotPassword = (req, res) => {
    res.render('auth/forgot-password', {
        error: null,
        success: null,
        email: ''
    });
};

/**
 * Gửi mã đặt lại mật khẩu
 */
exports.sendResetCode = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng nhập email'
            });
        }

        // Tạo mã reset
        const result = await User.generateResetCode(email);

        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: result.message
            });
        }

        // Gửi email
        const emailSent = await emailService.sendPasswordResetCode(result.user, result.code);

        if (!emailSent) {
            return res.status(500).json({
                success: false,
                message: 'Không thể gửi email. Vui lòng thử lại sau.'
            });
        }

        res.json({
            success: true,
            message: 'Mã đặt lại mật khẩu đã được gửi đến email của bạn. Mã có hiệu lực trong 10 phút.'
        });
    } catch (error) {
        console.error('Send reset code error:', error);
        res.status(500).json({
            success: false,
            message: 'Đã xảy ra lỗi. Vui lòng thử lại sau.'
        });
    }
};

/**
 * Xác nhận mã và hiển thị form đặt mật khẩu mới
 */
exports.verifyResetCode = async (req, res) => {
    try {
        const { email, code } = req.body;

        if (!email || !code || code.length !== 6) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng nhập đầy đủ email và mã 6 số'
            });
        }

        const result = await User.verifyResetCode(email, code);

        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: result.message
            });
        }

        res.json({
            success: true,
            message: 'Mã xác nhận hợp lệ'
        });
    } catch (error) {
        console.error('Verify reset code error:', error);
        res.status(500).json({
            success: false,
            message: 'Đã xảy ra lỗi. Vui lòng thử lại sau.'
        });
    }
};

/**
 * Đặt lại mật khẩu mới
 */
exports.resetPassword = async (req, res) => {
    try {
        const { email, code, new_password, confirm_password } = req.body;

        // Validate
        if (!email || !code || !new_password || !confirm_password) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng điền đầy đủ thông tin'
            });
        }

        if (new_password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Mật khẩu mới phải có ít nhất 6 ký tự'
            });
        }

        if (new_password !== confirm_password) {
            return res.status(400).json({
                success: false,
                message: 'Xác nhận mật khẩu không khớp'
            });
        }

        // Đặt lại mật khẩu
        const result = await User.resetPassword(email, code, new_password);

        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: result.message
            });
        }

        res.json({
            success: true,
            message: 'Đặt lại mật khẩu thành công! Bạn có thể đăng nhập với mật khẩu mới.'
        });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({
            success: false,
            message: 'Đã xảy ra lỗi. Vui lòng thử lại sau.'
        });
    }
};
