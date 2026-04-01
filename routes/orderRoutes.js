const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { verifyToken, optionalAuth } = require('../middleware/auth');

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

// Order confirmation (requires login and owner access)
router.get('/:orderCode/confirmation', verifyToken, orderController.orderConfirmation);

// Payment callbacks
router.get('/payment/vnpay/ipn', orderController.vnpayIpn);
router.get('/payment/vnpay/callback', orderController.vnpayReturn);
router.post('/payment/momo/callback', orderController.momoReturn);

module.exports = router;
