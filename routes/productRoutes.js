const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { optionalAuth } = require('../middleware/auth');

// Product routes - all with optionalAuth to pass user info to views
router.get('/', optionalAuth, productController.getProducts);
router.get('/search', optionalAuth, productController.searchProducts);
router.get('/category/:slug', optionalAuth, productController.getProductsByCategory);
router.get('/:slug', optionalAuth, productController.getProductDetail);

module.exports = router;
