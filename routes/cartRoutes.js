const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');
const { optionalAuth } = require('../middleware/auth');

// All cart routes support both logged-in users and guests
router.get('/', optionalAuth, cartController.viewCart);
router.post('/add', optionalAuth, cartController.addToCart);
router.post('/update', optionalAuth, cartController.updateCart);
router.post('/remove', optionalAuth, cartController.removeFromCart);
router.get('/count', optionalAuth, cartController.getCartCount);

module.exports = router;
