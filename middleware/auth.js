// Xác thực JWT, kiểm tra quyền admin và điều hướng đăng nhập theo từng khu vực.
const jwt = require('jsonwebtoken');
const pool = require('../config/database');
const StorefrontSetting = require('../models/StorefrontSetting');
require('dotenv').config();

function getRequestPath(req) {
    return (req.originalUrl || req.path || '').split('?')[0];
}

/**
 * Nhận diện request thuộc khu admin để middleware điều hướng về trang đăng nhập admin riêng.
 */
function isAdminAreaRequest(req) {
    const path = getRequestPath(req);
    return path === '/admin'
        || path.startsWith('/admin/')
        || path === '/chat/admin'
        || path.startsWith('/chat/admin/');
}

/**
 * Tạo URL đăng nhập admin kèm redirect hiện tại và thông báo lỗi nếu có.
 */
function buildAdminLoginRedirect(req, message = '') {
    const redirectTarget = req.originalUrl || req.path || '/admin/dashboard';
    const params = new URLSearchParams({ redirect: redirectTarget });

    if (message) {
        params.set('error', message);
    }

    return `/admin/login?${params.toString()}`;
}

/**
 * Bỏ qua bước chặn email chưa xác thực cho chính các route xác thực email.
 */
function isEmailVerificationRoute(req) {
    const path = getRequestPath(req);
    return path === '/auth/verify-email' || path === '/auth/send-verification';
}

/**
 * Chọn trang đăng nhập phù hợp với khu vực người dùng đang truy cập.
 */
function buildLoginRedirect(req) {
    if (isAdminAreaRequest(req)) {
        return buildAdminLoginRedirect(req);
    }

    const redirectTarget = req.originalUrl || req.path || '/';
    return `/auth/login?redirect=${encodeURIComponent(redirectTarget)}`;
}

/**
 * Tạo URL xác thực email, riêng khu admin sẽ quay về login admin với thông báo rõ ràng.
 */
function buildVerifyEmailRedirect(req) {
    if (isAdminAreaRequest(req)) {
        return buildAdminLoginRedirect(req, 'Tai khoan quan tri chua xac thuc email.');
    }

    const redirectTarget = req.originalUrl || req.path || '/';
    return `/auth/verify-email?redirect=${encodeURIComponent(redirectTarget)}`;
}

/**
 * Ghép payload JWT với dữ liệu mới nhất trong database để tránh dùng role/trạng thái cũ.
 */
function normalizeAuthenticatedUser(decoded, userRow) {
    return {
        ...decoded,
        id: userRow.id,
        email: userRow.email,
        role: userRow.role || decoded.role || 'customer',
        email_verified: userRow.email_verified === true || userRow.email_verified === 1
    };
}

/**
 * Lấy người dùng còn hoạt động từ database trước khi cho request đi tiếp.
 */
async function findActiveAuthUser(userId) {
    const [rows] = await pool.execute(
        'SELECT id, email, role, email_verified, is_active FROM users WHERE id = ? LIMIT 1',
        [userId]
    );

    const user = rows[0];
    if (!user || user.is_active === false || user.is_active === 0) {
        return null;
    }

    return user;
}

/**
 * Middleware bắt buộc đăng nhập: lấy JWT, kiểm tra tài khoản còn hoạt động và chặn email chưa xác thực.
 */
const verifyToken = async (req, res, next) => {
    try {
        // Cookie là nguồn chính cho web, Authorization header hỗ trợ các request API.
        let token = req.cookies?.token;

        if (!token) {
            const authHeader = req.headers['authorization'];
            if (authHeader && authHeader.startsWith('Bearer ')) {
                token = authHeader.substring(7);
            }
        }

        if (!token) {
            if (req.accepts('html')) {
                return res.redirect(buildLoginRedirect(req));
            }
            return res.status(401).json({ message: 'Access denied. No token provided.' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const activeUser = await findActiveAuthUser(decoded.id);

        if (!activeUser) {
            const { maxAge, ...cookieOptions } = {
                httpOnly: true,
                sameSite: 'lax',
                secure: process.env.NODE_ENV === 'production'
            };
            res.clearCookie('token', cookieOptions);

            if (req.accepts('html')) {
                return res.redirect(buildLoginRedirect(req));
            }

            return res.status(401).json({ message: 'Account is inactive or no longer exists.' });
        }

        req.user = normalizeAuthenticatedUser(decoded, activeUser);

        if (!req.user.email_verified && !isEmailVerificationRoute(req)) {
            if (req.accepts('html')) {
                return res.redirect(buildVerifyEmailRedirect(req));
            }

            return res.status(403).json({
                message: 'Email verification is required before using this account.',
                code: 'EMAIL_NOT_VERIFIED',
                redirect: buildVerifyEmailRedirect(req)
            });
        }

        next();
    } catch (error) {
        // Token lỗi hoặc hết hạn thì xóa cookie để trình duyệt không lặp request sai.
        res.clearCookie('token');

        if (req.accepts('html')) {
            return res.redirect(buildLoginRedirect(req));
        }

        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Token expired' });
        }
        return res.status(401).json({ message: 'Invalid token' });
    }
};

/**
 * Middleware phân quyền admin; HTML request bị đưa về login admin thay vì nhận JSON 403.
 */
const isAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        if (req.accepts('html') && isAdminAreaRequest(req)) {
            return res.redirect(buildAdminLoginRedirect(req, 'Tai khoan nay khong co quyen truy cap admin.'));
        }

        res.status(403).json({ message: 'Access denied. Admin only.' });
    }
};

/**
 * Xác thực tùy chọn cho các trang vừa cho khách vãng lai vừa cá nhân hóa khi có token.
 */
const optionalAuth = async (req, res, next) => {
    try {
        let token = req.cookies?.token;
        
        if (!token) {
            const authHeader = req.headers['authorization'];
            if (authHeader && authHeader.startsWith('Bearer ')) {
                token = authHeader.substring(7);
            }
        }

        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = decoded;
        }
    } catch (error) {
        // Token sai vẫn cho đi tiếp như khách vãng lai.
        req.user = null;
    }
    next();
};

/**
 * Sinh JWT thống nhất cho cả storefront và admin.
 */
async function getJwtExpiresIn() {
    try {
        const settings = await StorefrontSetting.getAll();
        const minutes = Number.parseInt(settings.jwt_expire_minutes, 10);
        if (Number.isInteger(minutes) && minutes > 0) {
            return `${minutes}m`;
        }
    } catch (error) {
        console.error('Unable to load JWT expiry setting:', error.message || error);
    }

    return process.env.JWT_EXPIRE || '1h';
}

const generateToken = async (user) => {
    const expiresIn = await getJwtExpiresIn();
    return jwt.sign(
        {
            id: user.id,
            email: user.email,
            role: user.role || 'customer',
            email_verified: user.email_verified === true || user.email_verified === 1
        },
        process.env.JWT_SECRET,
        {
            expiresIn
        }
    );
};

module.exports = {
    verifyToken,
    isAdmin,
    optionalAuth,
    generateToken
};
