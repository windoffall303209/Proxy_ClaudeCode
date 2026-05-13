// Kiểm thử tự động cho tests authcontroller.test để giữ ổn định hành vi quan trọng.
process.env.NODE_ENV = 'test';

jest.mock('../models/User', () => ({
    create: jest.fn(),
    findByEmail: jest.fn(),
    findById: jest.fn(),
    verifyPassword: jest.fn(),
    syncGoogleProfile: jest.fn(),
    generateVerificationCode: jest.fn(),
    verifyEmailCode: jest.fn()
}));

jest.mock('../models/Cart', () => ({
    mergeGuestCart: jest.fn()
}));

jest.mock('../models/Address', () => ({
    create: jest.fn()
}));

jest.mock('../middleware/auth', () => ({
    generateToken: jest.fn(() => 'test-token')
}));

jest.mock('../services/emailService', () => ({
    sendWelcomeEmail: jest.fn(() => Promise.resolve()),
    sendVerificationEmail: jest.fn(() => Promise.resolve(true))
}));

jest.mock('../config/cloudinary', () => ({
    uploadToCloudinary: jest.fn()
}));

jest.mock('axios', () => ({
    post: jest.fn(),
    get: jest.fn()
}));

jest.mock('multer', () => {
    const multer = jest.fn(() => ({
        single: jest.fn(() => (req, res, next) => {
            if (typeof next === 'function') {
                next();
            }
        })
    }));
    multer.diskStorage = jest.fn(() => ({}));
    return multer;
});

const User = require('../models/User');
const Cart = require('../models/Cart');
const Address = require('../models/Address');
const emailService = require('../services/emailService');
const axios = require('axios');
const authController = require('../controllers/authController');
const adminAuthController = require('../controllers/adminAuthController');

// Tạo response giả lập cho test.
function createRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.render = jest.fn().mockReturnValue(res);
    res.redirect = jest.fn().mockReturnValue(res);
    res.cookie = jest.fn().mockReturnValue(res);
    res.clearCookie = jest.fn().mockReturnValue(res);
    return res;
}

describe('authController', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('sets hardened auth cookie options during registration', async () => {
        User.create.mockResolvedValue({
            id: 1,
            email: 'user@example.com',
            full_name: 'Test User',
            email_verified: false
        });
        User.findByEmail.mockResolvedValue(null);
        User.generateVerificationCode.mockResolvedValue('123456');

        const req = {
            body: {
                email: 'user@example.com',
                password: 'Secret123',
                confirm_password: 'Secret123',
                full_name: 'Test User'
            },
            accepts: jest.fn().mockReturnValue(false)
        };
        const res = createRes();

        await authController.register(req, res);

        expect(res.cookie).toHaveBeenCalledWith('token', 'test-token', expect.objectContaining({
            httpOnly: true,
            sameSite: 'lax',
            secure: false,
            maxAge: 24 * 60 * 60 * 1000
        }));
        expect(emailService.sendVerificationEmail).toHaveBeenCalled();
    });

    it('uses sessionID when merging a guest cart on login', async () => {
        User.findByEmail.mockResolvedValue({
            id: 7,
            email: 'user@example.com',
            password_hash: 'hash',
            role: 'user',
            is_active: true,
            email_verified: true
        });
        User.verifyPassword.mockResolvedValue(true);
        Cart.mergeGuestCart.mockResolvedValue();

        const req = {
            body: {
                email: 'user@example.com',
                password: 'secret123'
            },
            sessionID: 'session-123',
            accepts: jest.fn().mockReturnValue(false)
        };
        const res = createRes();

        await authController.login(req, res);

        expect(Cart.mergeGuestCart).toHaveBeenCalledWith(7, 'session-123');
        expect(res.cookie).toHaveBeenCalledWith('token', 'test-token', expect.objectContaining({
            sameSite: 'lax',
            secure: false
        }));
    });

    it('keeps unverified accounts out of the app and redirects them to verification on login', async () => {
        User.findByEmail.mockResolvedValue({
            id: 8,
            email: 'pending@example.com',
            password_hash: 'hash',
            role: 'customer',
            is_active: true,
            email_verified: false
        });
        User.verifyPassword.mockResolvedValue(true);
        User.generateVerificationCode.mockResolvedValue('654321');

        const req = {
            body: {
                email: 'pending@example.com',
                password: 'secret123'
            },
            sessionID: 'session-456',
            accepts: jest.fn().mockReturnValue(true)
        };
        const res = createRes();

        await authController.login(req, res);

        expect(res.cookie).toHaveBeenCalledWith('token', 'test-token', expect.any(Object));
        expect(emailService.sendVerificationEmail).toHaveBeenCalledWith(
            expect.objectContaining({ email: 'pending@example.com' }),
            '654321'
        );
        expect(Cart.mergeGuestCart).not.toHaveBeenCalled();
        expect(res.redirect).toHaveBeenCalledWith('/auth/verify-email?sent=1');
    });

    it('does not force new addresses to become default', async () => {
        Address.create.mockResolvedValue({ id: 3 });

        const req = {
            user: { id: 9 },
            body: {
                full_name: 'Receiver',
                phone: '0123456789',
                address_line: '123 Street',
                city: 'HCM'
            }
        };
        const res = createRes();

        await authController.createAddress(req, res);

        expect(Address.create).toHaveBeenCalledWith(9, expect.objectContaining({
            is_default: false
        }));
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: true
        }));
    });
});

describe('adminAuthController', () => {
    let consoleErrorSpy;

    beforeEach(() => {
        jest.clearAllMocks();
        delete process.env.GOOGLE_CLIENT_ID;
        delete process.env.GOOGLE_CLIENT_SECRET;
        delete process.env.GOOGLE_ADMIN_CALLBACK_URL;
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleErrorSpy?.mockRestore();
    });

    it('renders the standalone admin login page', () => {
        const req = {
            query: {
                redirect: '/admin/products'
            }
        };
        const res = createRes();

        adminAuthController.showLogin(req, res);

        expect(res.render).toHaveBeenCalledWith('admin/login', expect.objectContaining({
            error: null,
            email: '',
            redirect: '/admin/products',
            user: null
        }));
    });

    it('rejects valid customer credentials from the admin login page', async () => {
        User.findByEmail.mockResolvedValue({
            id: 10,
            email: 'customer@example.com',
            password_hash: 'hash',
            role: 'customer',
            is_active: true,
            email_verified: true
        });
        User.verifyPassword.mockResolvedValue(true);

        const req = {
            body: {
                email: 'customer@example.com',
                password: 'Secret123',
                redirect: '/admin/dashboard'
            },
            accepts: jest.fn(() => true)
        };
        const res = createRes();

        await adminAuthController.login(req, res);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.cookie).not.toHaveBeenCalled();
        expect(res.render).toHaveBeenCalledWith('admin/login', expect.objectContaining({
            error: 'Tài khoản này không có quyền truy cập admin.'
        }));
    });

    it('logs in an active verified admin and redirects inside the admin area', async () => {
        User.findByEmail.mockResolvedValue({
            id: 1,
            email: 'admin@example.com',
            full_name: 'Admin User',
            password_hash: 'hash',
            role: 'admin',
            is_active: true,
            email_verified: true
        });
        User.verifyPassword.mockResolvedValue(true);

        const req = {
            body: {
                email: 'admin@example.com',
                password: 'Secret123',
                redirect: '/admin/orders'
            },
            accepts: jest.fn(() => true)
        };
        const res = createRes();

        await adminAuthController.login(req, res);

        expect(res.cookie).toHaveBeenCalledWith('token', 'test-token', expect.objectContaining({
            httpOnly: true,
            sameSite: 'lax',
            secure: false
        }));
        expect(res.redirect).toHaveBeenCalledWith('/admin/orders');
    });

    it('starts the dedicated admin Google login flow', () => {
        process.env.GOOGLE_CLIENT_ID = 'google-client';
        process.env.GOOGLE_CLIENT_SECRET = 'google-secret';

        const req = {
            query: {
                redirect: '/admin/orders'
            },
            protocol: 'http',
            get: jest.fn(() => 'localhost:3000')
        };
        const res = createRes();

        adminAuthController.startGoogleLogin(req, res);

        expect(res.cookie).toHaveBeenCalledWith('admin_google_oauth_state', expect.any(String), expect.objectContaining({
            httpOnly: true,
            maxAge: 10 * 60 * 1000
        }));
        expect(res.cookie).toHaveBeenCalledWith('admin_post_auth_redirect', '/admin/orders', expect.objectContaining({
            httpOnly: true,
            maxAge: 10 * 60 * 1000
        }));
        expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('https://accounts.google.com/o/oauth2/v2/auth?'));
        expect(res.redirect.mock.calls[0][0]).toContain(encodeURIComponent('http://localhost:3000/admin/google/callback'));
    });

    it('accepts Google login only for an existing admin account', async () => {
        process.env.GOOGLE_CLIENT_ID = 'google-client';
        process.env.GOOGLE_CLIENT_SECRET = 'google-secret';
        axios.post.mockResolvedValue({
            data: {
                access_token: 'google-token'
            }
        });
        axios.get.mockResolvedValue({
            data: {
                email: 'admin@example.com',
                name: 'Admin User',
                picture: 'https://example.com/avatar.png',
                verified_email: true
            }
        });
        User.findByEmail.mockResolvedValue({
            id: 1,
            email: 'admin@example.com',
            full_name: 'Admin User',
            role: 'admin',
            is_active: true,
            email_verified: true
        });
        User.syncGoogleProfile.mockResolvedValue({
            id: 1,
            email: 'admin@example.com',
            full_name: 'Admin User',
            role: 'admin',
            is_active: true,
            email_verified: true
        });

        const req = {
            query: {
                code: 'oauth-code',
                state: 'state-token'
            },
            cookies: {
                admin_google_oauth_state: 'state-token',
                admin_post_auth_redirect: '/admin/dashboard'
            },
            protocol: 'https',
            get: jest.fn(() => 'shop.example.com')
        };
        const res = createRes();

        await adminAuthController.handleGoogleCallback(req, res);

        expect(User.findByEmail).toHaveBeenCalledWith('admin@example.com');
        expect(User.syncGoogleProfile).toHaveBeenCalledWith(1, expect.objectContaining({
            full_name: 'Admin User',
            avatar_url: 'https://example.com/avatar.png'
        }));
        expect(res.cookie).toHaveBeenCalledWith('token', 'test-token', expect.objectContaining({
            httpOnly: true
        }));
        expect(res.redirect).toHaveBeenCalledWith('/admin/dashboard');
    });

    it('clears the auth cookie and returns to admin login on logout', () => {
        const req = {
            accepts: jest.fn(() => true)
        };
        const res = createRes();

        adminAuthController.logout(req, res);

        expect(res.clearCookie).toHaveBeenCalledWith('token', expect.objectContaining({
            httpOnly: true,
            sameSite: 'lax',
            secure: false
        }));
        expect(res.redirect).toHaveBeenCalledWith('/admin/login');
    });
});
