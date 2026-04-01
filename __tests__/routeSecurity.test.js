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
    vnpayIpn: jest.fn(),
    vnpayReturn: jest.fn(),
    momoReturn: jest.fn(),
    validateVoucher: jest.fn()
}));

jest.mock('../controllers/productController', () => ({
    getProducts: jest.fn(),
    searchProducts: jest.fn(),
    getProductsByCategory: jest.fn(),
    getProductDetail: jest.fn(),
    createProductReview: jest.fn(),
    updateProductReview: jest.fn()
}));

jest.mock('../middleware/auth', () => ({
    verifyToken: jest.fn((req, res, next) => next()),
    optionalAuth: jest.fn((req, res, next) => next())
}));

jest.mock('../middleware/reviewUpload', () => ({
    handleReviewMediaUpload: jest.fn((req, res, next) => next())
}));

const authController = require('../controllers/authController');
const orderController = require('../controllers/orderController');
const productController = require('../controllers/productController');
const { verifyToken, optionalAuth } = require('../middleware/auth');
const { handleReviewMediaUpload } = require('../middleware/reviewUpload');
const authRoutes = require('../routes/authRoutes');
const orderRoutes = require('../routes/orderRoutes');
const productRoutes = require('../routes/productRoutes');

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

    it('protects product review submission with verifyToken', () => {
        const reviewRoute = findRoute(productRoutes, '/:slug/reviews', 'post');

        expect(reviewRoute).toBeTruthy();
        expect(reviewRoute.route.stack.map((layer) => layer.handle)).toEqual([
            verifyToken,
            handleReviewMediaUpload,
            productController.createProductReview
        ]);
        expect(reviewRoute.route.stack.map((layer) => layer.handle)).not.toContain(optionalAuth);
    });

    it('protects product review editing with verifyToken', () => {
        const reviewEditRoute = findRoute(productRoutes, '/:slug/reviews/:reviewId/edit', 'post');

        expect(reviewEditRoute).toBeTruthy();
        expect(reviewEditRoute.route.stack.map((layer) => layer.handle)).toEqual([
            verifyToken,
            handleReviewMediaUpload,
            productController.updateProductReview
        ]);
        expect(reviewEditRoute.route.stack.map((layer) => layer.handle)).not.toContain(optionalAuth);
    });
});
