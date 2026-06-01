// Kiểm thử tự động cho tests routesecurity.test để giữ ổn định hành vi quan trọng.
process.env.NODE_ENV = 'test';

jest.mock('../controllers/authController', () => ({
    showRegister: jest.fn(),
    showLogin: jest.fn(),
    startGoogleLogin: jest.fn(),
    handleGoogleCallback: jest.fn(),
    register: jest.fn(),
    login: jest.fn(),
    logout: jest.fn(),
    getProfile: jest.fn(),
    updateProfile: jest.fn(),
    createAddress: jest.fn(),
    updateAddress: jest.fn(),
    deleteAddress: jest.fn(),
    updateFullProfile: jest.fn(),
    changePassword: jest.fn(),
    updateNotificationSettings: jest.fn(),
    handleAvatarUpload: jest.fn(),
    requestAccountDeletion: jest.fn(),
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
    showOrderTracking: jest.fn(),
    retryPayment: jest.fn(),
    cancelOrder: jest.fn(),
    confirmReceived: jest.fn(),
    showReturnRequest: jest.fn(),
    preValidateReturnRequest: jest.fn(),
    createReturnRequest: jest.fn(),
    orderConfirmation: jest.fn(),
    vnpayIpn: jest.fn(),
    vnpayReturn: jest.fn(),
    momoReturn: jest.fn(),
    validateVoucher: jest.fn()
}));

jest.mock('../controllers/productController', () => ({
    getProducts: jest.fn(),
    getForYou: jest.fn(),
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

jest.mock('../middleware/returnUpload', () => ({
    handleReturnMediaUpload: jest.fn((req, res, next) => next()),
    cleanupUploadedReturnMedia: jest.fn()
}));

const authController = require('../controllers/authController');
const orderController = require('../controllers/orderController');
const productController = require('../controllers/productController');
const { verifyToken, optionalAuth } = require('../middleware/auth');
const { handleReviewMediaUpload } = require('../middleware/reviewUpload');
const { handleReturnMediaUpload } = require('../middleware/returnUpload');
const { sameOrigin } = require('../middleware/sameOrigin');
const authRoutes = require('../routes/authRoutes');
const orderRoutes = require('../routes/orderRoutes');
const productRoutes = require('../routes/productRoutes');

// Tìm route.
function findRoute(router, path, method) {
    return router.stack.find((layer) => layer.route &&
        layer.route.path === path &&
        layer.route.methods[method]);
}

function createSameOriginReq(headers = {}) {
    const normalizedHeaders = Object.fromEntries(
        Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value])
    );

    return {
        method: 'POST',
        headers: normalizedHeaders,
        get: jest.fn((name) => normalizedHeaders[String(name).toLowerCase()] || '')
    };
}

function createSameOriginRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.render = jest.fn().mockReturnValue(res);
    return res;
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

    it('validates return request ownership before uploading media', () => {
        const returnRoute = findRoute(orderRoutes, '/:orderCode/return-request', 'post');

        expect(returnRoute).toBeTruthy();
        expect(returnRoute.route.stack.map((layer) => layer.handle)).toEqual([
            verifyToken,
            orderController.preValidateReturnRequest,
            handleReturnMediaUpload,
            orderController.createReturnRequest
        ]);
    });

    it('protects order cancellation with verifyToken', () => {
        const cancelRoute = findRoute(orderRoutes, '/:orderCode/cancel', 'post');

        expect(cancelRoute).toBeTruthy();
        expect(cancelRoute.route.stack.map((layer) => layer.handle)).toEqual([
            verifyToken,
            orderController.cancelOrder
        ]);
    });

    it('protects notification settings updates with verifyToken', () => {
        const notificationRoute = findRoute(authRoutes, '/notifications', 'put');

        expect(notificationRoute).toBeTruthy();
        expect(notificationRoute.route.stack.map((layer) => layer.handle)).toEqual([
            verifyToken,
            authController.updateNotificationSettings
        ]);
    });

    it('allows same-origin form posts when browsers provide Fetch Metadata but no Origin or Referer', () => {
        const req = createSameOriginReq({
            host: 'localhost:3000',
            'sec-fetch-site': 'same-origin'
        });
        const res = createSameOriginRes();
        const next = jest.fn();

        sameOrigin(req, res, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(res.status).not.toHaveBeenCalled();
    });

    it('rejects cross-site form posts', () => {
        const req = createSameOriginReq({
            host: 'localhost:3000',
            origin: 'https://attacker.test'
        });
        const res = createSameOriginRes();
        const next = jest.fn();

        sameOrigin(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(403);
    });
});
