const User = require('../models/User');
const { generateToken } = require('../middleware/auth');
const crypto = require('crypto');
const axios = require('axios');

const ADMIN_LOGIN_PATH = '/admin/login';
const ADMIN_HOME_PATH = '/admin/dashboard';
const ADMIN_GOOGLE_STATE_COOKIE = 'admin_google_oauth_state';
const ADMIN_GOOGLE_REDIRECT_COOKIE = 'admin_post_auth_redirect';

/**
 * Tạo cấu hình cookie xác thực cho phiên admin.
 * Cookie dùng httpOnly để token không bị đọc trực tiếp từ JavaScript phía trình duyệt.
 */
function getAuthCookieOptions() {
    return {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000
    };
}

/**
 * Lấy lại cấu hình cookie khi cần xóa token.
 * Thuộc tính maxAge bị bỏ đi để clearCookie khớp đúng metadata của cookie đã set.
 */
function getClearCookieOptions() {
    const { maxAge, ...cookieOptions } = getAuthCookieOptions();
    return cookieOptions;
}

/**
 * Kiểm tra cấu hình Google OAuth dùng chung cho cả storefront và admin.
 */
function isGoogleAuthConfigured() {
    return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

/**
 * Kiểm tra trạng thái tài khoản theo cả giá trị boolean và số từ MySQL.
 */
function isActiveUser(user) {
    return user && user.is_active !== false && user.is_active !== 0;
}

/**
 * Chuẩn hóa trạng thái xác thực email vì database có thể trả về boolean hoặc tinyint.
 */
function hasVerifiedEmail(user) {
    return user?.email_verified === true || user?.email_verified === 1;
}

/**
 * Lấy email từ Google profile ở dạng chuẩn hóa để so với tài khoản admin hiện có.
 */
function getGoogleProfileEmail(profile) {
    return String(profile?.email || '').trim().toLowerCase();
}

/**
 * Chỉ cho phép redirect tới các trang admin hợp lệ sau khi đăng nhập.
 * Hàm này chặn open redirect, redirect vòng về login/logout và URL ngoài hệ thống.
 */
function getSafeAdminRedirectPath(value, fallback = ADMIN_HOME_PATH) {
    if (typeof value !== 'string') {
        return fallback;
    }

    const trimmed = value.trim();
    if (!trimmed || !trimmed.startsWith('/') || trimmed.startsWith('//')) {
        return fallback;
    }

    if (trimmed === ADMIN_LOGIN_PATH || trimmed.startsWith(`${ADMIN_LOGIN_PATH}?`) || trimmed === '/admin/logout') {
        return fallback;
    }

    if (trimmed === '/admin' || trimmed.startsWith('/admin/') || trimmed === '/chat/admin' || trimmed.startsWith('/chat/admin/')) {
        return trimmed;
    }

    return fallback;
}

/**
 * Callback riêng cho admin để khi OAuth lỗi sẽ quay về đúng trang đăng nhập quản trị.
 */
function getAdminGoogleCallbackUrl(req) {
    return process.env.GOOGLE_ADMIN_CALLBACK_URL
        || `${req.protocol}://${req.get('host')}/admin/google/callback`;
}

/**
 * Tạo URL Google OAuth cho luồng đăng nhập admin.
 */
function getAdminGoogleAuthUrl(req, state) {
    const params = new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        redirect_uri: getAdminGoogleCallbackUrl(req),
        response_type: 'code',
        scope: 'openid email profile',
        access_type: 'online',
        prompt: 'select_account',
        state
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Đổi authorization code của Google thành profile để đối chiếu với tài khoản admin.
 */
async function exchangeAdminGoogleCodeForProfile(req, code) {
    const tokenResponse = await axios.post(
        'https://oauth2.googleapis.com/token',
        new URLSearchParams({
            code,
            client_id: process.env.GOOGLE_CLIENT_ID,
            client_secret: process.env.GOOGLE_CLIENT_SECRET,
            redirect_uri: getAdminGoogleCallbackUrl(req),
            grant_type: 'authorization_code'
        }).toString(),
        {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        }
    );

    const accessToken = tokenResponse.data?.access_token;
    if (!accessToken) {
        throw new Error('Không lấy được access token từ Google.');
    }

    const profileResponse = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
            Authorization: `Bearer ${accessToken}`
        }
    });

    const profile = profileResponse.data || {};
    if (!getGoogleProfileEmail(profile)) {
        throw new Error('Tài khoản Google không cung cấp email hợp lệ.');
    }

    return profile;
}

/**
 * Chỉ cho phép Google đăng nhập khi email đã tồn tại và có quyền admin.
 * Luồng admin không tự tạo tài khoản mới để tránh cấp nhầm đường vào back office.
 */
async function findAdminByGoogleProfile(profile) {
    const email = getGoogleProfileEmail(profile);
    const user = await User.findByEmail(email);

    if (!user) {
        throw new Error('Tài khoản Google này chưa được cấp quyền quản trị.');
    }

    if (!isActiveUser(user)) {
        throw new Error('Tài khoản quản trị đang bị khóa.');
    }

    if (user.role !== 'admin') {
        throw new Error('Tài khoản Google này không có quyền truy cập admin.');
    }

    if (typeof User.syncGoogleProfile === 'function') {
        const syncedUser = await User.syncGoogleProfile(user.id, {
            full_name: String(profile.name || profile.full_name || '').trim() || user.full_name,
            avatar_url: String(profile.picture || profile.avatar_url || '').trim() || null
        });

        return {
            ...syncedUser,
            email_verified: true
        };
    }

    if (!hasVerifiedEmail(user) && profile.verified_email !== true) {
        throw new Error('Email Google của tài khoản quản trị chưa được xác thực.');
    }

    return {
        ...user,
        email_verified: hasVerifiedEmail(user) || profile.verified_email === true
    };
}

/**
 * Render trang đăng nhập admin độc lập với layout storefront.
 */
function renderAdminLogin(res, options = {}) {
    return res.render('admin/login', {
        error: options.error || null,
        email: options.email || '',
        redirect: getSafeAdminRedirectPath(options.redirect, ADMIN_HOME_PATH),
        googleAuthEnabled: isGoogleAuthConfigured(),
        user: null
    });
}

/**
 * Hiển thị form đăng nhập admin hoặc đưa admin đã đăng nhập về trang đích an toàn.
 */
exports.showLogin = (req, res) => {
    const redirect = getSafeAdminRedirectPath(req.query.redirect, ADMIN_HOME_PATH);

    if (req.user?.role === 'admin' && hasVerifiedEmail(req.user)) {
        return res.redirect(redirect);
    }

    return renderAdminLogin(res, {
        error: typeof req.query.error === 'string' ? req.query.error.trim() : null,
        email: typeof req.query.email === 'string' ? req.query.email.trim() : '',
        redirect
    });
};

/**
 * Xác thực tài khoản admin, set JWT cookie và trả về HTML redirect hoặc JSON theo request.
 */
exports.login = async (req, res) => {
    const { email, password, redirect } = req.body;
    const trimmedEmail = (email || '').trim().toLowerCase();
    const redirectPath = getSafeAdminRedirectPath(redirect, ADMIN_HOME_PATH);

    try {
        if (!trimmedEmail || !password) {
            throw new Error('Vui lòng nhập email và mật khẩu quản trị.');
        }

        const user = await User.findByEmail(trimmedEmail);
        if (!user) {
            throw new Error('Email hoặc mật khẩu quản trị không đúng.');
        }

        const isValidPassword = await User.verifyPassword(password, user.password_hash);
        if (!isValidPassword) {
            throw new Error('Email hoặc mật khẩu quản trị không đúng.');
        }

        if (!isActiveUser(user)) {
            throw new Error('Tài khoản quản trị đang bị khóa.');
        }

        if (user.role !== 'admin') {
            throw new Error('Tài khoản này không có quyền truy cập admin.');
        }

        if (!hasVerifiedEmail(user)) {
            throw new Error('Tài khoản quản trị chưa xác thực email.');
        }

        const token = await generateToken(user);
        res.cookie('token', token, getAuthCookieOptions());

        if (req.accepts('html')) {
            return res.redirect(redirectPath);
        }

        return res.json({
            message: 'Admin login successful',
            redirect: redirectPath,
            user: {
                id: user.id,
                email: user.email,
                full_name: user.full_name,
                role: user.role
            },
            token
        });
    } catch (error) {
        console.error('Admin login error:', error);

        if (req.accepts('html')) {
            res.status(401);
            return renderAdminLogin(res, {
                error: error.message,
                email: trimmedEmail,
                redirect: redirectPath
            });
        }

        return res.status(401).json({ message: error.message });
    }
};

/**
 * Bắt đầu luồng Google OAuth dành riêng cho admin.
 */
exports.startGoogleLogin = (req, res) => {
    try {
        if (!isGoogleAuthConfigured()) {
            return res.redirect(`${ADMIN_LOGIN_PATH}?error=${encodeURIComponent('Đăng nhập Google chưa được cấu hình.')}`);
        }

        const state = crypto.randomBytes(24).toString('hex');
        const redirectPath = getSafeAdminRedirectPath(req.query.redirect, ADMIN_HOME_PATH);
        res.cookie(ADMIN_GOOGLE_STATE_COOKIE, state, {
            ...getAuthCookieOptions(),
            maxAge: 10 * 60 * 1000
        });
        res.cookie(ADMIN_GOOGLE_REDIRECT_COOKIE, redirectPath, {
            ...getAuthCookieOptions(),
            maxAge: 10 * 60 * 1000
        });

        return res.redirect(getAdminGoogleAuthUrl(req, state));
    } catch (error) {
        console.error('Admin Google auth start error:', error);
        return res.redirect(`${ADMIN_LOGIN_PATH}?error=${encodeURIComponent('Không thể bắt đầu đăng nhập Google.')}`);
    }
};

/**
 * Hoàn tất Google OAuth, kiểm tra quyền admin rồi set JWT cookie.
 */
exports.handleGoogleCallback = async (req, res) => {
    const cookieOptions = getClearCookieOptions();

    try {
        if (!isGoogleAuthConfigured()) {
            return res.redirect(`${ADMIN_LOGIN_PATH}?error=${encodeURIComponent('Đăng nhập Google chưa được cấu hình.')}`);
        }

        const { code, state, error } = req.query;
        const expectedState = req.cookies?.[ADMIN_GOOGLE_STATE_COOKIE];
        const redirectPath = getSafeAdminRedirectPath(req.cookies?.[ADMIN_GOOGLE_REDIRECT_COOKIE], ADMIN_HOME_PATH);

        res.clearCookie(ADMIN_GOOGLE_STATE_COOKIE, cookieOptions);
        res.clearCookie(ADMIN_GOOGLE_REDIRECT_COOKIE, cookieOptions);

        if (error) {
            return res.redirect(`${ADMIN_LOGIN_PATH}?error=${encodeURIComponent('Đăng nhập Google đã bị hủy.')}`);
        }

        if (!code || !state || !expectedState || state !== expectedState) {
            return res.redirect(`${ADMIN_LOGIN_PATH}?error=${encodeURIComponent('Phiên đăng nhập Google không hợp lệ.')}`);
        }

        const profile = await exchangeAdminGoogleCodeForProfile(req, code);
        const user = await findAdminByGoogleProfile(profile);
        const token = await generateToken(user);

        res.cookie('token', token, getAuthCookieOptions());
        return res.redirect(redirectPath);
    } catch (error) {
        console.error('Admin Google auth callback error:', error);
        return res.redirect(`${ADMIN_LOGIN_PATH}?error=${encodeURIComponent(error.message || 'Không thể đăng nhập admin bằng Google.')}`);
    }
};

/**
 * Xóa token admin và đưa người dùng về trang đăng nhập riêng của admin.
 */
exports.logout = (req, res) => {
    res.clearCookie('token', getClearCookieOptions());

    if (req.accepts('html')) {
        return res.redirect(ADMIN_LOGIN_PATH);
    }

    return res.json({ message: 'Admin logout successful' });
};
