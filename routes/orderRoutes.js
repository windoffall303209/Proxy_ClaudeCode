// Khai báo route orderroutes và nối middleware/controller tương ứng.
const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { verifyToken, optionalAuth } = require('../middleware/auth');
const { handleReturnMediaUpload } = require('../middleware/returnUpload');

// Checkout (requires login)
router.get('/checkout', verifyToken, orderController.showCheckout);
router.post('/create', verifyToken, orderController.createOrder);

// Voucher validation
router.post('/validate-voucher', optionalAuth, orderController.validateVoucher);

// Buy now - single product checkout (requires login)
router.get('/buy-now/:productId', verifyToken, orderController.showBuyNow);
router.post('/buy-now/create', verifyToken, orderController.createBuyNowOrder);

// Order history (requires login) - must be before :orderCode route
router.get('/history', verifyToken, orderController.getOrderHistory);

// Order tracking (requires login and owner access)
router.get('/:orderCode/tracking', verifyToken, orderController.showOrderTracking);
router.get('/:orderCode/pay', verifyToken, orderController.retryPayment);
router.post('/:orderCode/cancel', verifyToken, orderController.cancelOrder);
router.post('/:orderCode/confirm-received', verifyToken, orderController.confirmReceived);
router.get('/:orderCode/return-request', verifyToken, orderController.showReturnRequest);
router.post('/:orderCode/return-request', verifyToken, orderController.preValidateReturnRequest, handleReturnMediaUpload, orderController.createReturnRequest);

// Order confirmation (requires login and owner access)
router.get('/:orderCode/confirmation', verifyToken, orderController.orderConfirmation);

// Payment callbacks
router.get('/payment/vnpay/ipn', orderController.vnpayIpn);
router.get('/payment/vnpay/callback', orderController.vnpayReturn);
router.get('/payment/momo/callback', orderController.momoReturn);
router.post('/payment/momo/callback', orderController.momoReturn);

module.exports = router;
