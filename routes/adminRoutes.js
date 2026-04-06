const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { verifyToken, isAdmin } = require('../middleware/auth');
const upload = require('../middleware/upload');
const productImportUpload = require('../middleware/productImportUpload');
const { uploadToCloud } = require('../middleware/upload');

// All admin routes require authentication and admin role
router.use(verifyToken, isAdmin);

// Dashboard
router.get('/dashboard', adminController.getDashboard);
router.get('/', (req, res) => res.redirect('/admin/dashboard'));

// Categories
router.get('/categories', adminController.getCategories);
router.post('/categories', adminController.createCategory);
router.put('/categories/:id', adminController.updateCategory);
router.delete('/categories/:id', adminController.deleteCategory);

// Products
router.get('/products', adminController.getProducts);
router.get('/products/export', adminController.exportProducts);
router.get('/products/import-template', adminController.downloadProductImportTemplate);
router.post('/products/delete-all', adminController.deleteAllProducts);
router.post('/products/import', productImportUpload.fields([
    { name: 'import_file', maxCount: 1 },
    { name: 'images_zip', maxCount: 1 }
]), adminController.importProducts);
router.post('/products', upload.any(), uploadToCloud, adminController.createProduct);
router.put('/products/:id', upload.any(), uploadToCloud, adminController.updateProduct);
router.delete('/products/:id', adminController.deleteProduct);

// Product Images
router.get('/products/:id/images', adminController.getProductImages);
router.post('/products/:id/images', adminController.addProductImageUrl);
router.post('/products/:id/images/upload', upload.array('images', 20), uploadToCloud, adminController.uploadProductImage);
router.delete('/products/images/:imageId', adminController.deleteProductImage);
router.put('/products/images/:imageId/primary', adminController.setPrimaryImage);

// Product Variants
router.get('/products/:id/variants', adminController.getProductVariants);
router.post('/products/:id/variants', adminController.addProductVariant);
router.delete('/products/variants/:variantId', adminController.deleteProductVariant);

// Orders
router.get('/orders', adminController.getOrders);
router.get('/orders/:id', adminController.getOrderDetail);
router.put('/orders/:id/status', adminController.updateOrderStatus);

// Users
router.get('/users', adminController.getUsers);
router.get('/users/:id', adminController.getUserDetail);
router.put('/users/:id/status', adminController.updateUserStatus);

// Banners
router.get('/banners', adminController.getBanners);
router.post('/banners', upload.single('image'), uploadToCloud, adminController.createBanner);
router.put('/banners/reorder', adminController.reorderBanners);
router.put('/banners/:id/toggle', adminController.toggleBannerActive);
router.put('/banners/:id', upload.single('image'), uploadToCloud, adminController.updateBanner);
router.delete('/banners/:id', adminController.deleteBanner);

// Sales
router.get('/sales', adminController.getSales);
router.post('/sales', adminController.createSale);
router.put('/sales/:id', adminController.updateSale);
router.delete('/sales/:id', adminController.deleteSale);
router.post('/sales/:id/email', adminController.sendSaleAnnouncementEmail);

// Vouchers
router.get('/vouchers', adminController.getVouchers);
router.post('/vouchers', adminController.createVoucher);
router.put('/vouchers/:id', adminController.updateVoucher);
router.delete('/vouchers/:id', adminController.deleteVoucher);
router.put('/vouchers/:id/status', adminController.updateVoucherStatus);
router.post('/vouchers/:id/email', adminController.sendVoucherAnnouncementEmail);

// Email Marketing
router.post('/email/send', adminController.sendMarketingEmail);

module.exports = router;
