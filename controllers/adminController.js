/**
 * =============================================================================
 * ADMIN CONTROLLER - Điều khiển trang quản trị
 * =============================================================================
 * File này chứa các hàm xử lý logic cho trang Admin:
 * - Dashboard: Thống kê tổng quan
 * - Quản lý sản phẩm: CRUD sản phẩm, quản lý ảnh
 * - Quản lý đơn hàng: Xem, cập nhật trạng thái
 * - Quản lý người dùng: Xem, khóa/mở khóa tài khoản
 * - Quản lý banner: CRUD banner quảng cáo
 * - Quản lý khuyến mãi: CRUD chương trình sale
 * - Email marketing: Gửi email hàng loạt
 * =============================================================================
 */

const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const Category = require('../models/Category');
const Banner = require('../models/Banner');
const Sale = require('../models/Sale');
const Voucher = require('../models/Voucher');
const emailService = require('../services/emailService');
const { attachUploadedImagesToProduct, parseVariantsPayload, syncVariants, validateVariants } = require('../services/adminProductVariantService');
const upload = require('../middleware/upload');

function parseSelectedProductIds(body) {
    const rawValues = body.product_ids ?? body['product_ids[]'] ?? [];
    const normalized = Array.isArray(rawValues) ? rawValues : [rawValues];

    return [...new Set(
        normalized
            .flatMap((value) => String(value).split(','))
            .map((value) => parseInt(value, 10))
            .filter((value) => Number.isInteger(value) && value > 0)
    )];
}

async function attachSaleAssignments(sales) {
    const saleIds = Array.isArray(sales) ? sales.map((sale) => sale.id) : [];
    const assignments = await Sale.getAssignedProductsMap(saleIds);

    return (sales || []).map((sale) => ({
        ...sale,
        assigned_products: assignments.get(sale.id) || [],
        assigned_product_count: (assignments.get(sale.id) || []).length
    }));
}

async function attachVoucherAssignments(vouchers) {
    const voucherIds = Array.isArray(vouchers) ? vouchers.map((voucher) => voucher.id) : [];
    const assignments = await Voucher.getApplicableProductsMap(voucherIds);

    return (vouchers || []).map((voucher) => ({
        ...voucher,
        applicable_products: assignments.get(voucher.id) || [],
        applicable_product_count: (assignments.get(voucher.id) || []).length
    }));
}

// =============================================================================
// DASHBOARD - Trang tổng quan
// =============================================================================

/**
 * Hiển thị trang Dashboard (Tổng quan)
 *
 * @description Lấy các thống kê tổng quan về đơn hàng, doanh thu
 *              và danh sách đơn hàng gần đây để hiển thị trên dashboard
 *
 * @param {Object} req - Request object từ Express
 * @param {Object} res - Response object từ Express
 *
 * @returns {void} Render trang admin/dashboard với dữ liệu thống kê
 */
exports.getDashboard = async (req, res) => {
    try {
        // Khởi tạo object thống kê với giá trị mặc định
        let stats = {
            total_orders: 0,        // Tổng số đơn hàng
            pending_orders: 0,      // Đơn hàng chờ xử lý
            delivered_orders: 0,    // Đơn hàng đã giao
            cancelled_orders: 0,    // Đơn hàng đã hủy
            total_revenue: 0,       // Tổng doanh thu
            today_revenue: 0,       // Doanh thu hôm nay
            month_revenue: 0        // Doanh thu tháng này
        };
        let recentOrders = [];      // Danh sách đơn hàng gần đây

        try {
            // Lấy thống kê từ database
            stats = await Order.getStatistics() || stats;
            // Lấy 10 đơn hàng gần nhất
            recentOrders = await Order.findAll({ limit: 10, offset: 0 }) || [];
        } catch (err) {
            console.error('Dashboard data error:', err);
            // Sử dụng giá trị mặc định nếu lỗi
        }

        // Render trang dashboard với dữ liệu
        res.render('admin/dashboard', {
            stats,
            recentOrders,
            user: req.user,
            currentPage: 'dashboard'
        });
    } catch (error) {
        console.error('Lỗi trang quản trị:', error);
        res.status(500).render('error', { message: 'Lỗi tải dashboard: ' + error.message, user: req.user });
    }
};

// =============================================================================
// QUẢN LÝ DANH MỤC - Categories Management
// =============================================================================

exports.getCategories = async (req, res) => {
    try {
        const searchQuery = typeof req.query.search === 'string' ? req.query.search.trim() : '';
        const categories = await Category.findAllForAdmin(searchQuery ? { search: searchQuery } : {});
        const parentCategories = await Category.findRootCategories();

        // Compute stats from loaded categories
        const totalProducts = categories.reduce((sum, c) => sum + (c.product_count || 0), 0);
        const rootCount = categories.filter(c => !c.parent_id).length;
        const childCount = categories.filter(c => !!c.parent_id).length;
        const categoryStats = {
            total: categories.length,
            root: rootCount,
            children: childCount,
            assignedProducts: totalProducts
        };

        res.render('admin/categories', {
            categories,
            parentCategories,
            categoryStats,
            searchQuery,
            user: req.user,
            currentPage: 'categories'
        });
    } catch (error) {
        res.status(500).render('error', { message: 'Lỗi tải danh mục: ' + error.message, user: req.user });
    }
};

exports.createCategory = async (req, res) => {
    try {
        const { name, description, parent_id, image_url, display_order } = req.body;
        let slug = req.body.slug;
        if (!slug || slug.trim() === '') {
            slug = name
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/\u0111/g, 'd')
                .replace(/\u0110/g, 'D')
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/(^-|-$)/g, '');
        }
        await Category.create({ name, slug, description, parent_id: parent_id || null, image_url: image_url || null, display_order: parseInt(display_order) || 0 });
        res.redirect('/admin/categories');
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.updateCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const existing = await Category.findByIdAny(id);
        if (!existing) {
            return res.status(404).json({ success: false, message: 'Danh mục không tồn tại' });
        }
        const { name, slug, description, parent_id, image_url, display_order } = req.body;
        if (parent_id && await Category.createsCircularReference(id, parent_id)) {
            return res.status(400).json({ success: false, message: 'Không thể tạo vòng lặp danh mục cha-con' });
        }
        await Category.update(id, {
            name: name || existing.name,
            slug: slug || existing.slug,
            description: description !== undefined ? description : existing.description,
            parent_id: parent_id !== undefined ? (parent_id || null) : existing.parent_id,
            image_url: image_url !== undefined ? (image_url || null) : existing.image_url,
            display_order: display_order !== undefined ? (parseInt(display_order) || 0) : existing.display_order
        });
        res.json({ success: true, message: 'Cập nhật danh mục thành công' });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const stats = await Category.getUsageStats(id);
        if (stats.product_count > 0 || stats.child_count > 0) {
            return res.status(400).json({
                success: false,
                message: `Không thể xóa: danh mục đang có ${stats.product_count} sản phẩm và ${stats.child_count} danh mục con`
            });
        }
        await Category.delete(id);
        res.json({ success: true, message: 'Đã xóa danh mục' });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// =============================================================================
// QUẢN LÝ SẢN PHẨM - Products Management
// =============================================================================

/**
 * Hiển thị danh sách sản phẩm
 *
 * @description Lấy danh sách tất cả sản phẩm và danh mục
 *              để hiển thị trên trang quản lý sản phẩm
 *
 * @param {Object} req - Request object từ Express
 * @param {Object} res - Response object từ Express
 *
 * @returns {void} Render trang admin/products với danh sách sản phẩm
 */
exports.getProducts = async (req, res) => {
    try {
        let products = [];
        let categories = [];
        let totalItems = 0;

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        const searchQuery = typeof req.query.search === 'string' ? req.query.search.trim() : '';

        try {
            const productFilters = {
                limit,
                offset,
                ...(searchQuery ? { search: searchQuery } : {})
            };

            products = await Product.findAll(productFilters);
            categories = await Category.findAll();
            totalItems = await Product.count(productFilters);
        } catch (err) {
            console.error('Products data error:', err);
        }

        const totalPages = Math.ceil(totalItems / limit);

        res.render('admin/products', {
            products,
            categories,
            user: req.user,
            currentPage: 'products',
            searchQuery,
            pagination: { totalItems, totalPages, currentPage: page, limit, searchQuery }
        });
    } catch (error) {
        res.status(500).render('error', { message: 'Lỗi tải sản phẩm: ' + error.message, user: req.user });
    }
};

/**
 * Tạo sản phẩm mới
 *
 * @description Nhận dữ liệu từ form tạo sản phẩm, tự động tạo slug nếu không có,
 *              lưu sản phẩm vào database và xử lý upload ảnh
 *
 * @param {Object} req - Request object từ Express
 * @param {Object} req.body - Dữ liệu sản phẩm từ form
 * @param {number} req.body.category_id - ID danh mục
 * @param {string} req.body.name - Tên sản phẩm
 * @param {string} [req.body.slug] - Slug URL (tự động tạo nếu không có)
 * @param {string} req.body.description - Mô tả sản phẩm
 * @param {number} req.body.price - Giá sản phẩm
 * @param {number} req.body.stock_quantity - Số lượng tồn kho
 * @param {string} req.body.sku - Mã SKU
 * @param {number} [req.body.sale_id] - ID chương trình khuyến mãi
 * @param {string} [req.body.is_featured] - Sản phẩm nổi bật ('on' = true)
 * @param {Array} [req.files] - Danh sách file ảnh upload
 * @param {Object} res - Response object từ Express
 *
 * @returns {Redirect} Redirect về trang danh sách sản phẩm
 */
exports.createProduct = async (req, res) => {
    try {
        const { category_id, name, description, price, stock_quantity, sku, sale_id, is_featured } = req.body;
        let { slug } = req.body;
        const parsedVariants = parseVariantsPayload(req.body.variants);
        validateVariants(parsedVariants);

        if (!slug || slug.trim() === '') {
            slug = name
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/\u0111/g, 'd')
                .replace(/\u0110/g, 'D')
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/(^-|-$)/g, '')
                + '-' + Date.now();
        }

        const product = await Product.create({
            category_id: parseInt(category_id, 10),
            name,
            slug,
            description,
            price: parseFloat(price),
            stock_quantity: parseInt(stock_quantity, 10) || 0,
            sku,
            sale_id: sale_id || null,
            is_featured: is_featured === 'on'
        });

        const imageKeyMap = await attachUploadedImagesToProduct(product.id, req.files);
        const productImages = await Product.getImages(product.id);

        if (productImages.length === 0) {
            await Product.addImage(
                product.id,
                'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600',
                true,
                0
            );
        }

        await syncVariants(product.id, parsedVariants, imageKeyMap);

        res.redirect('/admin/products');
    } catch (error) {
        console.error('Create product error:', error);
        res.redirect('/admin/products?error=' + encodeURIComponent(error.message));
    }
};

/**
 * Cập nhật thông tin sản phẩm
 *
 * @description Nhận dữ liệu cập nhật từ form và lưu vào database
 *
 * @param {Object} req - Request object từ Express
 * @param {Object} req.params - Tham số URL
 * @param {number} req.params.id - ID sản phẩm cần cập nhật
 * @param {Object} req.body - Dữ liệu cập nhật
 * @param {Object} res - Response object từ Express
 *
 * @returns {Redirect} Redirect về trang danh sách sản phẩm
 */
exports.updateProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const { category_id, name, description, price, stock_quantity } = req.body;
        const parsedVariants = req.body.variants !== undefined ? parseVariantsPayload(req.body.variants) : null;

        if (parsedVariants !== null) {
            validateVariants(parsedVariants);
        }

        const currentProduct = await Product.findById(id);
        if (!currentProduct) {
            return res.status(404).json({ success: false, message: 'Sản phẩm không tồn tại' });
        }

        await Product.update(id, {
            category_id: category_id || currentProduct.category_id,
            name: name || currentProduct.name,
            slug: req.body.slug || currentProduct.slug,
            description: description !== undefined ? description : currentProduct.description,
            price: price ? parseFloat(price) : currentProduct.price,
            stock_quantity: stock_quantity !== undefined ? (parseInt(stock_quantity, 10) || 0) : currentProduct.stock_quantity,
            sku: req.body.sku !== undefined ? (req.body.sku || null) : (currentProduct.sku || null),
            sale_id: req.body.sale_id !== undefined ? (req.body.sale_id || null) : (currentProduct.sale_id || null),
            is_featured: req.body.is_featured !== undefined ? (req.body.is_featured === 'on' || req.body.is_featured === true) : currentProduct.is_featured
        });

        const imageKeyMap = await attachUploadedImagesToProduct(id, req.files);

        if (parsedVariants !== null) {
            await syncVariants(id, parsedVariants, imageKeyMap);
        }

        res.json({ success: true, message: 'Cập nhật sản phẩm thành công' });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

/**
 * Xóa sản phẩm
 *
 * @description Xóa sản phẩm khỏi database dựa trên ID
 *
 * @param {Object} req - Request object từ Express
 * @param {Object} req.params - Tham số URL
 * @param {number} req.params.id - ID sản phẩm cần xóa
 * @param {Object} res - Response object từ Express
 *
 * @returns {JSON} Trả về JSON với thông báo thành công/thất bại
 */
exports.deleteProduct = async (req, res) => {
    try {
        const { id } = req.params;
        // Xóa sản phẩm (sẽ cascade xóa cả ảnh liên quan)
        await Product.delete(id);
        res.json({ message: 'Product deleted successfully' });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// =============================================================================
// QUẢN LÝ ĐƠN HÀNG - Orders Management
// =============================================================================

/**
 * Hiển thị danh sách đơn hàng
 *
 * @description Lấy danh sách tất cả đơn hàng để hiển thị trên trang quản lý
 *
 * @param {Object} req - Request object từ Express
 * @param {Object} res - Response object từ Express
 *
 * @returns {void} Render trang admin/orders với danh sách đơn hàng
 */
exports.getOrders = async (req, res) => {
    try {
        let orders = [];
        const searchQuery = typeof req.query.search === 'string' ? req.query.search.trim() : '';
        try {
            // Lấy 50 đơn hàng gần nhất
            orders = await Order.findAll({
                limit: 50,
                offset: 0,
                ...(searchQuery ? { search: searchQuery } : {})
            });
        } catch (err) {
            console.error('Orders data error:', err);
        }

        // Render trang quản lý đơn hàng
        res.render('admin/orders', {
            orders,
            searchQuery,
            user: req.user,
            currentPage: 'orders'
        });
    } catch (error) {
        res.status(500).render('error', { message: 'Lỗi tải đơn hàng: ' + error.message, user: req.user });
    }
};

/**
 * Hiển thị chi tiết đơn hàng
 *
 * @param {Object} req - Request object từ Express
 * @param {Object} res - Response object từ Express
 */
exports.getOrderDetail = async (req, res) => {
    try {
        const { id } = req.params;
        const order = await Order.findById(id);

        res.render('admin/order-detail', {
            order,
            user: req.user,
            currentPage: 'orders'
        });
    } catch (error) {
        res.status(500).render('error', { message: 'Lỗi tải đơn hàng: ' + error.message, user: req.user });
    }
};

/**
 * Cập nhật trạng thái đơn hàng
 *
 * @description Thay đổi trạng thái đơn hàng (pending, confirmed, shipping, delivered, cancelled)
 *
 * @param {Object} req - Request object từ Express
 * @param {Object} req.params.id - ID đơn hàng
 * @param {Object} req.body.status - Trạng thái mới
 * @param {Object} res - Response object từ Express
 *
 * @returns {JSON} Trả về JSON với thông báo thành công/thất bại
 */
exports.updateOrderStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        // Cập nhật trạng thái trong database
        await Order.updateStatus(id, status);
        res.json({ message: 'Order status updated successfully' });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// =============================================================================
// QUẢN LÝ NGƯỜI DÙNG - Users Management
// =============================================================================

/**
 * Hiển thị danh sách người dùng
 *
 * @description Lấy danh sách tất cả người dùng đã đăng ký
 *
 * @param {Object} req - Request object từ Express
 * @param {Object} res - Response object từ Express
 *
 * @returns {void} Render trang admin/users với danh sách người dùng
 */
exports.getUsers = async (req, res) => {
    try {
        let users = [];
        let totalItems = 0;

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;

        try {
            users = await User.findAll({ limit, offset });
            // Đếm tổng người dùng
            const pool = require('../config/database');
            const [countResult] = await pool.execute('SELECT COUNT(*) as total FROM users');
            totalItems = countResult[0].total;
        } catch (err) {
            console.error('Users data error:', err);
        }

        const totalPages = Math.ceil(totalItems / limit);

        res.render('admin/users', {
            users,
            user: req.user,
            currentPage: 'users',
            pagination: { totalItems, totalPages, currentPage: page, limit }
        });
    } catch (error) {
        res.status(500).render('error', { message: 'Lỗi tải người dùng: ' + error.message, user: req.user });
    }
};

/**
 * Xem chi tiết người dùng (API JSON)
 *
 * @param {Object} req - Request object từ Express
 * @param {Object} res - Response object từ Express
 */
exports.getUserDetail = async (req, res) => {
    try {
        const { id } = req.params;
        const pool = require('../config/database');

        // Lấy user info (bao gồm cả bị khóa)
        const [users] = await pool.execute(
            'SELECT id, email, full_name, phone, avatar_url, birthday, role, email_verified, marketing_consent, is_active, created_at FROM users WHERE id = ?',
            [id]
        );
        const userData = users[0];
        if (!userData) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
        }

        // Lấy địa chỉ
        const [addresses] = await pool.execute(
            'SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC',
            [id]
        );
        userData.addresses = addresses;

        // Lấy 5 đơn hàng gần nhất
        const [orders] = await pool.execute(
            'SELECT id, order_code, total_amount, final_amount, status, payment_status, created_at FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 5',
            [id]
        );
        userData.recent_orders = orders;

        res.json({ success: true, user: userData });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Cập nhật trạng thái người dùng (Khóa/Mở khóa)
 *
 * @description Khóa hoặc mở khóa tài khoản người dùng
 *
 * @param {Object} req - Request object từ Express
 * @param {Object} req.params.id - ID người dùng
 * @param {Object} req.body.is_active - Trạng thái mới ('true' hoặc 'false')
 * @param {Object} res - Response object từ Express
 *
 * @returns {JSON} Trả về JSON với thông báo thành công/thất bại
 */
exports.updateUserStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { is_active } = req.body;

        // Cập nhật trạng thái (chuyển string 'true'/'false' thành boolean)
        await User.updateStatus(id, is_active === 'true');
        res.json({ message: 'User status updated successfully' });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// =============================================================================
// QUẢN LÝ BANNER - Banners Management
// =============================================================================

/**
 * Hiển thị danh sách banner
 *
 * @description Lấy danh sách tất cả banner quảng cáo
 *
 * @param {Object} req - Request object từ Express
 * @param {Object} res - Response object từ Express
 *
 * @returns {void} Render trang admin/banners với danh sách banner
 */
exports.getBanners = async (req, res) => {
    try {
        let banners = [];
        try {
            banners = await Banner.findAll();
        } catch (err) {
            console.error('Banners data error:', err);
        }

        // Render trang quản lý banner
        res.render('admin/banners', {
            banners,
            user: req.user,
            currentPage: 'banners'
        });
    } catch (error) {
        res.status(500).render('error', { message: 'Lỗi tải banners: ' + error.message, user: req.user });
    }
};

/**
 * Tạo banner mới
 *
 * @description Tạo banner quảng cáo mới với ảnh upload hoặc URL
 *
 * @param {Object} req - Request object từ Express
 * @param {Object} req.body - Dữ liệu banner
 * @param {string} req.body.title - Tiêu đề banner
 * @param {string} req.body.subtitle - Tiêu đề phụ
 * @param {string} req.body.description - Mô tả
 * @param {string} req.body.link_url - URL khi click vào banner
 * @param {string} req.body.button_text - Text nút CTA
 * @param {number} req.body.display_order - Thứ tự hiển thị
 * @param {string} [req.body.start_date] - Ngày bắt đầu hiển thị
 * @param {string} [req.body.end_date] - Ngày kết thúc hiển thị
 * @param {Object} [req.file] - File ảnh upload
 * @param {Object} res - Response object từ Express
 *
 * @returns {Redirect} Redirect về trang danh sách banner
 */
exports.createBanner = async (req, res) => {
    try {
        // Lấy dữ liệu từ form
        const { title, subtitle, description, link_url, button_text, display_order, start_date, end_date } = req.body;

        // Xử lý ảnh upload (ưu tiên URL Cloudinary)
        let image_url = '';
        if (req.file) {
            image_url = req.file.cloudinaryUrl || `/uploads/${req.file.filename}`;
        }

        // Tạo banner trong database
        await Banner.create({
            title,
            subtitle,
            description,
            image_url,
            link_url,
            button_text,
            display_order: parseInt(display_order) || 0,
            start_date: start_date || null,
            end_date: end_date || null
        });

        // Redirect về trang danh sách
        res.redirect('/admin/banners');
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

/**
 * Xóa banner
 *
 * @description Xóa banner khỏi database
 *
 * @param {Object} req - Request object từ Express
 * @param {Object} req.params.id - ID banner cần xóa
 * @param {Object} res - Response object từ Express
 *
 * @returns {JSON} Trả về JSON với thông báo thành công/thất bại
 */
exports.deleteBanner = async (req, res) => {
    try {
        const pool = require('../config/database');
        // Xóa banner từ database
        await pool.execute('DELETE FROM banners WHERE id = ?', [req.params.id]);
        res.json({ success: true, message: 'Banner deleted' });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// =============================================================================
// QUẢN LÝ KHUYẾN MÃI - Sales Management
// =============================================================================

/**
 * Hiển thị danh sách khuyến mãi
 *
 * @description Lấy danh sách tất cả chương trình khuyến mãi
 *
 * @param {Object} req - Request object từ Express
 * @param {Object} res - Response object từ Express
 *
 * @returns {void} Render trang admin/sales với danh sách khuyến mãi
 */
exports.getSales = async (req, res) => {
    try {
        let sales = [];
        let products = [];
        const searchQuery = typeof req.query.search === 'string' ? req.query.search.trim() : '';
        try {
            sales = await attachSaleAssignments(await Sale.findAll(searchQuery ? { search: searchQuery } : {}));
            products = await Product.findAll({ limit: 1000, offset: 0, sort_by: 'name', sort_order: 'ASC' });
        } catch (err) {
            console.error('Sales data error:', err);
        }

        // Render trang quản lý khuyến mãi
        res.render('admin/sales', {
            sales,
            products,
            searchQuery,
            user: req.user,
            currentPage: 'sales'
        });
    } catch (error) {
        res.status(500).render('error', { message: 'Lỗi tải khuyến mãi: ' + error.message, user: req.user });
    }
};

/**
 * Tạo chương trình khuyến mãi mới
 *
 * @description Tạo khuyến mãi mới với loại giảm giá (% hoặc số tiền cố định)
 *
 * @param {Object} req - Request object từ Express
 * @param {Object} req.body - Dữ liệu khuyến mãi
 * @param {string} req.body.name - Tên chương trình
 * @param {string} req.body.description - Mô tả
 * @param {string} req.body.type - Loại giảm giá ('percentage' hoặc 'fixed')
 * @param {number} req.body.value - Giá trị giảm (% hoặc số tiền)
 * @param {string} req.body.start_date - Ngày bắt đầu
 * @param {string} req.body.end_date - Ngày kết thúc
 * @param {Object} res - Response object từ Express
 *
 * @returns {Redirect} Redirect về trang danh sách khuyến mãi
 */
exports.createSale = async (req, res) => {
    try {
        const { name, description, type, value, start_date, end_date } = req.body;
        const productIds = parseSelectedProductIds(req.body);

        // Tạo khuyến mãi trong database
        const sale = await Sale.create({
            name,
            description,
            type,
            value: parseFloat(value),
            start_date,
            end_date
        });

        await Sale.assignProducts(sale.id, productIds);

        // Redirect về trang danh sách
        res.redirect('/admin/sales');
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

/**
 * Cập nhật chương trình khuyến mãi
 */
exports.updateSale = async (req, res) => {
    try {
        const { id } = req.params;
        const existingSale = await Sale.findById(id);

        if (!existingSale) {
            return res.status(404).json({ success: false, message: 'Khuyến mãi không tồn tại' });
        }

        const { name, description, type, value, start_date, end_date, is_active } = req.body;
        const productIds = parseSelectedProductIds(req.body);

        await Sale.update(id, {
            name,
            description,
            type,
            value: parseFloat(value),
            start_date: start_date || null,
            end_date: end_date || null,
            is_active: is_active === 'on' || is_active === true || is_active === 'true'
        });

        await Sale.assignProducts(id, productIds);

        res.json({ success: true, message: 'Cập nhật khuyến mãi thành công' });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

/**
 * Ngừng và gỡ áp dụng khuyến mãi khỏi sản phẩm
 */
exports.deleteSale = async (req, res) => {
    try {
        const { id } = req.params;
        const existingSale = await Sale.findById(id);

        if (!existingSale) {
            return res.status(404).json({ success: false, message: 'Khuyến mãi không tồn tại' });
        }

        await Sale.assignProducts(id, []);
        await Sale.delete(id);

        res.json({ success: true, message: 'Đã ngừng khuyến mãi' });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// =============================================================================
// EMAIL MARKETING
// =============================================================================

/**
 * Gửi email marketing hàng loạt
 *
 * @description Gửi email quảng cáo đến tất cả người dùng đã đồng ý nhận marketing
 *
 * @param {Object} req - Request object từ Express
 * @param {Object} req.body - Nội dung email
 * @param {string} req.body.subject - Tiêu đề email
 * @param {string} req.body.content - Nội dung email (HTML)
 * @param {Object} res - Response object từ Express
 *
 * @returns {JSON} Trả về JSON với số lượng email đã gửi thành công
 */
exports.sendMarketingEmail = async (req, res) => {
    try {
        const { subject, content } = req.body;

        // Lấy danh sách người dùng đã đồng ý nhận email marketing
        const users = await User.getMarketingList();

        // Gửi email hàng loạt
        const result = await emailService.sendMarketingEmail(users, {
            subject,
            content
        });

        // Trả về kết quả
        res.json({
            message: `Email sent to ${result.success}/${result.total} users`
        });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// =============================================================================
// QUẢN LÝ ẢNH SẢN PHẨM - Product Images Management
// =============================================================================

/**
 * Lấy danh sách ảnh của sản phẩm
 *
 * @description Lấy tất cả ảnh của một sản phẩm, sắp xếp ảnh chính lên đầu
 *
 * @param {Object} req - Request object từ Express
 * @param {Object} req.params.id - ID sản phẩm
 * @param {Object} res - Response object từ Express
 *
 * @returns {JSON} Trả về JSON với danh sách ảnh: { images: [...] }
 */
exports.getProductImages = async (req, res) => {
    try {
        const images = await Product.getImages(req.params.id);
        res.json({ images });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Thêm ảnh sản phẩm bằng URL
 *
 * @description Thêm ảnh mới cho sản phẩm bằng cách nhập URL ảnh
 *
 * @param {Object} req - Request object từ Express
 * @param {Object} req.params.id - ID sản phẩm
 * @param {Object} req.body.image_url - URL của ảnh
 * @param {boolean} [req.body.is_primary] - Đặt làm ảnh chính
 * @param {Object} res - Response object từ Express
 *
 * @returns {JSON} Trả về JSON với thông báo thành công/thất bại
 */
exports.addProductImageUrl = async (req, res) => {
    try {
        const pool = require('../config/database');
        const { image_url, is_primary } = req.body;
        const productId = req.params.id;

        // Nếu đặt làm ảnh chính, bỏ flag is_primary của các ảnh khác
        if (is_primary) {
            await pool.execute(
                'UPDATE product_images SET is_primary = FALSE WHERE product_id = ?',
                [productId]
            );
        }

        // Thêm ảnh mới vào database
        await pool.execute(
            'INSERT INTO product_images (product_id, image_url, is_primary) VALUES (?, ?, ?)',
            [productId, image_url, is_primary || false]
        );

        res.json({ success: true, message: 'Image added' });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

/**
 * Upload ảnh sản phẩm
 *
 * @description Upload file ảnh từ máy tính và lưu vào server
 *
 * @param {Object} req - Request object từ Express
 * @param {Object} req.params.id - ID sản phẩm
 * @param {Object} req.file - File ảnh upload (từ multer)
 * @param {string} req.body.is_primary - Đặt làm ảnh chính ('true'/'false')
 * @param {Object} res - Response object từ Express
 *
 * @returns {JSON} Trả về JSON với thông báo thành công/thất bại
 */
exports.uploadProductImage = async (req, res) => {
    try {
        const productId = req.params.id;
        const isPrimary = req.body.is_primary === 'true';
        const files = Array.isArray(req.files) ? req.files : (req.file ? [req.file] : []);

        if (files.length === 0) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const existingImages = await Product.getImages(productId);
        let displayOrder = existingImages.length;

        for (let index = 0; index < files.length; index += 1) {
            const file = files[index];
            const imageUrl = file.cloudinaryUrl || '/uploads/' + file.filename;
            const shouldSetPrimary = (isPrimary && index === 0) || (!isPrimary && existingImages.length === 0 && index === 0);
            await Product.addImage(productId, imageUrl, shouldSetPrimary, displayOrder);
            displayOrder += 1;
        }

        res.json({
            success: true,
            message: files.length > 1 ? `Đã tải lên ${files.length} ảnh` : 'Đã tải lên ảnh'
        });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

/**
 * Xóa ảnh sản phẩm
 *
 * @description Xóa một ảnh khỏi sản phẩm
 *
 * @param {Object} req - Request object từ Express
 * @param {Object} req.params.imageId - ID của ảnh cần xóa
 * @param {Object} res - Response object từ Express
 *
 * @returns {JSON} Trả về JSON với thông báo thành công/thất bại
 */
exports.deleteProductImage = async (req, res) => {
    try {
        const pool = require('../config/database');
        // Xóa ảnh từ database
        await pool.execute('DELETE FROM product_images WHERE id = ?', [req.params.imageId]);
        res.json({ success: true, message: 'Image deleted' });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

/**
 * Đặt ảnh làm ảnh chính
 *
 * @description Đặt một ảnh làm ảnh chính (primary) của sản phẩm.
 *              Bỏ flag is_primary của các ảnh khác cùng sản phẩm
 *
 * @param {Object} req - Request object từ Express
 * @param {Object} req.params.imageId - ID của ảnh cần đặt làm chính
 * @param {Object} res - Response object từ Express
 *
 * @returns {JSON} Trả về JSON với thông báo thành công/thất bại
 */
exports.setPrimaryImage = async (req, res) => {
    try {
        const pool = require('../config/database');
        const imageId = req.params.imageId;

        // Lấy product_id từ ảnh này
        const [image] = await pool.execute(
            'SELECT product_id FROM product_images WHERE id = ?',
            [imageId]
        );

        // Kiểm tra ảnh có tồn tại không
        if (image.length === 0) {
            return res.status(404).json({ message: 'Image not found' });
        }

        const productId = image[0].product_id;

        // Bỏ flag is_primary của tất cả ảnh cùng sản phẩm
        await pool.execute(
            'UPDATE product_images SET is_primary = FALSE WHERE product_id = ?',
            [productId]
        );

        // Đặt ảnh này làm ảnh chính
        await pool.execute(
            'UPDATE product_images SET is_primary = TRUE WHERE id = ?',
            [imageId]
        );

        res.json({ success: true, message: 'Primary image set' });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// =============================================================================
// QUẢN LÝ VOUCHER - Vouchers Management
// =============================================================================

/**
 * Hiển thị danh sách voucher
 */
exports.getVouchers = async (req, res) => {
    try {
        let vouchers = [];
        let products = [];
        const searchQuery = typeof req.query.search === 'string' ? req.query.search.trim() : '';
        try {
            vouchers = await attachVoucherAssignments(await Voucher.findAll(searchQuery ? { search: searchQuery } : {}));
            products = await Product.findAll({ limit: 1000, offset: 0, sort_by: 'name', sort_order: 'ASC' });
        } catch (err) {
            console.error('Vouchers data error:', err);
        }

        res.render('admin/vouchers', {
            vouchers,
            products,
            searchQuery,
            user: req.user,
            currentPage: 'vouchers'
        });
    } catch (error) {
        res.status(500).render('error', { message: 'Lỗi tải vouchers: ' + error.message, user: req.user });
    }
};

/**
 * Tạo voucher mới
 */
exports.createVoucher = async (req, res) => {
    try {
        const {
            code, name, description, type, value,
            min_order_amount, max_discount_amount, usage_limit,
            user_limit, start_date, end_date, is_active
        } = req.body;
        const productIds = parseSelectedProductIds(req.body);

        await Voucher.create({
            code,
            name,
            description,
            type,
            value: parseFloat(value),
            min_order_amount: parseFloat(min_order_amount) || 0,
            max_discount_amount: max_discount_amount ? parseFloat(max_discount_amount) : null,
            usage_limit: usage_limit ? parseInt(usage_limit) : null,
            user_limit: parseInt(user_limit) || 1,
            start_date,
            end_date,
            is_active: is_active === 'on',
            product_ids: productIds
        });

        res.redirect('/admin/vouchers');
    } catch (error) {
        console.error('Create voucher error:', error);
        res.redirect('/admin/vouchers?error=' + encodeURIComponent(error.message));
    }
};

/**
 * Cập nhật voucher
 */
exports.updateVoucher = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            code, name, description, type, value,
            min_order_amount, max_discount_amount, usage_limit,
            user_limit, start_date, end_date, is_active
        } = req.body;
        const productIds = parseSelectedProductIds(req.body);

        await Voucher.update(id, {
            code,
            name,
            description,
            type,
            value: parseFloat(value),
            min_order_amount: parseFloat(min_order_amount) || 0,
            max_discount_amount: max_discount_amount ? parseFloat(max_discount_amount) : null,
            usage_limit: usage_limit ? parseInt(usage_limit) : null,
            user_limit: parseInt(user_limit) || 1,
            start_date,
            end_date,
            is_active: is_active === 'on' || is_active === true,
            product_ids: productIds
        });

        res.json({ success: true, message: 'Voucher updated successfully' });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

/**
 * Xóa voucher
 */
exports.deleteVoucher = async (req, res) => {
    try {
        const { id } = req.params;
        await Voucher.delete(id);
        res.json({ success: true, message: 'Voucher deleted successfully' });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

/**
 * Cập nhật trạng thái voucher
 */
exports.updateVoucherStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { is_active } = req.body;
        await Voucher.updateStatus(id, is_active === 'true' || is_active === true);
        res.json({ success: true, message: 'Voucher status updated' });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// =============================================================================
// BIẾN THỂ SẢN PHẨM - PRODUCT VARIANTS
// =============================================================================

exports.getProductVariants = async (req, res) => {
    try {
        const variants = await Product.getVariants(req.params.id);
        res.json({ success: true, variants });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.addProductVariant = async (req, res) => {
    try {
        const variant = await Product.addVariant(req.params.id, req.body);
        res.json({ success: true, variant });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.deleteProductVariant = async (req, res) => {
    try {
        if (await Product.isVariantReferenced(req.params.variantId)) {
            return res.status(400).json({
                success: false,
                message: 'Không thể xóa biến thể đã được dùng trong giỏ hàng hoặc đơn hàng'
            });
        }

        await Product.deleteVariant(req.params.variantId);
        res.json({ success: true, message: 'Đã xóa biến thể' });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// =============================================================================
// QUẢN LÝ BANNER - Banners Management
// =============================================================================

exports.getBanners = async (req, res) => {
    try {
        let banners = [];
        try {
            banners = await Banner.findAll();
        } catch (err) {
            console.error('Banners data error:', err);
        }
        res.render('admin/banners', {
            banners,
            user: req.user,
            currentPage: 'banners'
        });
    } catch (error) {
        res.status(500).render('error', { message: 'Lỗi tải banners: ' + error.message, user: req.user });
    }
};

exports.createBanner = async (req, res) => {
    try {
        const { title, subtitle, description, link_url, button_text, display_order, start_date, end_date } = req.body;

        let image_url = '';
        if (req.file) {
            image_url = req.file.cloudinaryUrl || `/uploads/${req.file.filename}`;
        }

        await Banner.create({
            title,
            subtitle,
            description,
            image_url,
            link_url,
            button_text,
            display_order: parseInt(display_order) || 0,
            start_date: start_date || null,
            end_date: end_date || null
        });

        res.redirect('/admin/banners');
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.deleteBanner = async (req, res) => {
    try {
        const pool = require('../config/database');
        await pool.execute('DELETE FROM banners WHERE id = ?', [req.params.id]);
        res.json({ success: true, message: 'Banner deleted' });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.toggleBannerActive = async (req, res) => {
    try {
        const banner = await Banner.toggleActive(req.params.id);
        if (!banner) {
            return res.status(404).json({ success: false, message: 'Banner không tồn tại' });
        }
        res.json({ success: true, is_active: banner.is_active });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.reorderBanners = async (req, res) => {
    try {
        const { items } = req.body;
        if (!Array.isArray(items)) {
            return res.status(400).json({ success: false, message: 'Dữ liệu không hợp lệ' });
        }
        await Banner.updateOrder(items);
        res.json({ success: true });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.updateBanner = async (req, res) => {
    try {
        const { id } = req.params;
        const existing = await Banner.findById(id);
        if (!existing) {
            return res.status(404).json({ success: false, message: 'Banner không tồn tại' });
        }
        const { title, subtitle, link_url } = req.body;

        let image_url = existing.image_url;
        if (req.file) {
            image_url = req.file.cloudinaryUrl || `/uploads/${req.file.filename}`;
        }

        const updated = await Banner.update(id, {
            title: title || existing.title,
            subtitle: subtitle !== undefined ? subtitle : existing.subtitle,
            description: existing.description,
            image_url,
            link_url: link_url !== undefined ? link_url : existing.link_url,
            button_text: existing.button_text,
            display_order: existing.display_order,
            is_active: existing.is_active,
            start_date: existing.start_date,
            end_date: existing.end_date
        });

        res.json({ success: true, banner: updated });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};
