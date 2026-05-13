// Khai báo route khu vực admin và gắn middleware bảo vệ sau route đăng nhập riêng.
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin');
const adminAuthController = require('../controllers/adminAuthController');
const { verifyToken, isAdmin } = require('../middleware/auth');
const upload = require('../middleware/upload');
const productImportUpload = require('../middleware/productImportUpload');
const { uploadToCloud } = require('../middleware/upload');

router.get('/login', adminAuthController.showLogin);
router.post('/login', adminAuthController.login);
router.get('/auth/login', adminAuthController.showLogin);
router.post('/auth/login', adminAuthController.login);
router.get('/google', adminAuthController.startGoogleLogin);
router.get('/google/callback', adminAuthController.handleGoogleCallback);
router.post('/logout', adminAuthController.logout);

// Từ đây trở xuống chỉ admin đã xác thực mới được vào khu quản trị.
router.use(verifyToken, isAdmin);

// Nhóm route tổng quan vận hành.
router.get('/dashboard', adminController.getDashboard);
router.get('/', (req, res) => res.redirect('/admin/dashboard'));

// Nhóm route cấu hình storefront.
router.get('/storefront', adminController.getStorefrontSettings);
router.post('/storefront', adminController.updateStorefrontSettings);
router.post('/storefront/draft', adminController.saveStorefrontSettingsDraft);
router.post('/storefront/publish', adminController.publishStorefrontSettings);
router.post('/storefront/discard', adminController.discardStorefrontSettingsDraft);
router.post('/storefront/reset', adminController.resetStorefrontSettingsDraft);
router.post('/storefront/assets', upload.single('asset'), uploadToCloud, adminController.uploadStorefrontAsset);
router.post('/bulk-actions/verification-code', adminController.requestBulkDeleteVerification);

// Nhóm route quản lý danh mục và import/export danh mục.
router.get('/categories', adminController.getCategories);
router.get('/categories/export', adminController.exportCategories);
router.get('/categories/import-template', adminController.downloadCategoryImportTemplate);
router.post('/categories/import', productImportUpload.single('import_file'), adminController.importCategories);
router.post('/categories/delete-all', adminController.deleteAllCategories);
router.post('/categories', upload.single('image'), uploadToCloud, adminController.createCategory);
router.put('/categories/:id', upload.single('image'), uploadToCloud, adminController.updateCategory);
router.delete('/categories/:id', adminController.deleteCategory);

// Nhóm route quản lý sản phẩm và import/export sản phẩm.
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

// Nhóm route quản lý ảnh sản phẩm.
router.get('/products/:id/images', adminController.getProductImages);
router.post('/products/:id/images', adminController.addProductImageUrl);
router.post('/products/:id/images/upload', upload.array('images', 20), uploadToCloud, adminController.uploadProductImage);
router.delete('/products/images/:imageId', adminController.deleteProductImage);
router.put('/products/images/:imageId/primary', adminController.setPrimaryImage);

// Nhóm route quản lý biến thể sản phẩm.
router.get('/products/:id/variants', adminController.getProductVariants);
router.post('/products/:id/variants', adminController.addProductVariant);
router.delete('/products/variants/:variantId', adminController.deleteProductVariant);

// Nhóm route xử lý đơn hàng.
router.get('/orders', adminController.getOrders);
router.get('/orders/:id', adminController.getOrderDetail);
router.put('/orders/:id/status', adminController.updateOrderStatus);

// Nhóm route duyệt yêu cầu đổi trả.
router.get('/returns', adminController.getReturnRequests);
router.put('/returns/:id/status', adminController.updateReturnRequestStatus);
router.get('/returns/:id', adminController.getReturnRequestDetail);

// Nhóm route quản lý người dùng.
router.get('/users', adminController.getUsers);
router.get('/users/:id', adminController.getUserDetail);
router.put('/users/:id/status', adminController.updateUserStatus);

// Nhóm route quản lý banner hiển thị trên storefront.
router.get('/banners', adminController.getBanners);
router.post('/banners', upload.single('image'), uploadToCloud, adminController.createBanner);
router.put('/banners/reorder', adminController.reorderBanners);
router.put('/banners/:id/toggle', adminController.toggleBannerActive);
router.put('/banners/:id', upload.single('image'), uploadToCloud, adminController.updateBanner);
router.delete('/banners/:id', adminController.deleteBanner);

// Nhóm route quản lý chương trình khuyến mãi.
router.get('/sales', adminController.getSales);
router.post('/sales', adminController.createSale);
router.put('/sales/:id', adminController.updateSale);
router.delete('/sales/:id', adminController.deleteSale);
router.post('/sales/:id/email', adminController.sendSaleAnnouncementEmail);

// Nhóm route quản lý mã giảm giá và bật/tắt trạng thái phát hành.
router.get('/vouchers', adminController.getVouchers);
router.post('/vouchers', adminController.createVoucher);
router.put('/vouchers/:id', adminController.updateVoucher);
router.delete('/vouchers/:id', adminController.deleteVoucher);
router.put('/vouchers/:id/status', adminController.updateVoucherStatus);
router.post('/vouchers/:id/email', adminController.sendVoucherAnnouncementEmail);

// Route gửi email marketing thủ công từ khu quản trị.
router.post('/email/send', adminController.sendMarketingEmail);

module.exports = router;
