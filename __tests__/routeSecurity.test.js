process.env.NODE_ENV = 'test';

jest.mock('../controllers/authController', () => ({
    showRegister: jest.fn(),
    showLogin: jest.fn(),
    register: jest.fn(),
    login: jest.fn(),
    logout: jest.fn(),
    getProfile: jest.fn(),
    updateProfile: jest.fn(),
    createAddress: jest.fn(),
    updateFullProfile: jest.fn(),
    changePassword: jest.fn(),
    handleAvatarUpload: jest.fn(),
    showVerifyEmail: jest.fn(),
    sendVerificationCode: jest.fn(),
    verifyEmailCode: jest.fn(),
    showForgotPassword: jest.fn(),
    sendResetCode: jest.fn(),
    verifyResetCode: jest.fn(),
    resetPassword: jest.fn()
}));

jest.mock('../controllers/orderController', () => ({
    showCheckout: jest.fn(),
    createOrder: jest.fn(),
    showBuyNow: jest.fn(),
    createBuyNowOrder: jest.fn(),
    getOrderHistory: jest.fn(),
    orderConfirmation: jest.fn(),
    vnpayReturn: jest.fn(),
    momoReturn: jest.fn(),
    validateVoucher: jest.fn()
}));

jest.mock('../middleware/auth', () => ({
    verifyToken: jest.fn((req, res, next) => next()),
    optionalAuth: jest.fn((req, res, next) => next())
}));

const authController = require('../controllers/authController');
const orderController = require('../controllers/orderController');
const { verifyToken, optionalAuth } = require('../middleware/auth');
const authRoutes = require('../routes/authRoutes');
const orderRoutes = require('../routes/orderRoutes');

function findRoute(router, path, method) {
    return router.stack.find((layer) => layer.route &&
        layer.route.path === path &&
        layer.route.methods[method]);
}

describe('security-sensitive routes', () => {
    it('exposes logout only as POST', () => {
        const logoutPostRoute = findRoute(authRoutes, '/logout', 'post');
        const logoutGetRoute = findRoute(authRoutes, '/logout', 'get');

        expect(logoutPostRoute).toBeTruthy();
        expect(logoutPostRoute.route.stack.map((layer) => layer.handle)).toEqual([authController.logout]);
        expect(logoutGetRoute).toBeUndefined();
    });

    it('protects order confirmation with verifyToken instead of optionalAuth', () => {
        const confirmationRoute = findRoute(orderRoutes, '/:orderCode/confirmation', 'get');

        expect(confirmationRoute).toBeTruthy();
        expect(confirmationRoute.route.stack.map((layer) => layer.handle)).toEqual([
            verifyToken,
            orderController.orderConfirmation
        ]);
        expect(confirmationRoute.route.stack.map((layer) => layer.handle)).not.toContain(optionalAuth);
    });
});
