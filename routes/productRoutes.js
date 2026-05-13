// Khai báo route productroutes và nối middleware/controller tương ứng.
const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { optionalAuth, verifyToken } = require('../middleware/auth');
const { handleReviewMediaUpload } = require('../middleware/reviewUpload');
const suggestProducts = productController.suggestProducts || ((req, res) => res.json([]));

// Khai báo các route sản phẩm, phần xử lý nghiệp vụ nằm trong controller/service.
router.get('/suggest', suggestProducts);
router.get('/', optionalAuth, productController.getProducts);
router.get('/for-you', optionalAuth, productController.getForYou);
router.get('/search', optionalAuth, productController.searchProducts);
router.get('/category/:slug', optionalAuth, productController.getProductsByCategory);
router.post('/:slug/reviews', verifyToken, handleReviewMediaUpload, productController.createProductReview);
router.post('/:slug/reviews/:reviewId/edit', verifyToken, handleReviewMediaUpload, productController.updateProductReview);
router.get('/:slug', optionalAuth, productController.getProductDetail);

module.exports = router;
