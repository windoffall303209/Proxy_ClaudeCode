/**
 * =============================================================================
 * NEWSLETTER ROUTES - Routes đăng ký nhận tin khuyến mãi
 * =============================================================================
 */

const express = require('express');
const router = express.Router();
const newsletterController = require('../controllers/newsletterController');
const { optionalAuth } = require('../middleware/auth');

// Đăng ký nhận tin (có thể đăng nhập hoặc không)
router.post('/subscribe', optionalAuth, newsletterController.subscribe);

// Hủy đăng ký
router.post('/unsubscribe', newsletterController.unsubscribe);

// Kiểm tra trạng thái (cần đăng nhập)
router.get('/status', optionalAuth, newsletterController.checkStatus);

module.exports = router;
