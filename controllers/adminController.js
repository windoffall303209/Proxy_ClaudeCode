/**
 * =============================================================================
 * ADMIN CONTROLLER - Äiá»u khiá»ƒn trang quáº£n trá»‹
 * =============================================================================
 * File nÃ y chá»©a cÃ¡c hÃ m xá»­ lÃ½ logic cho trang Admin:
 * - Dashboard: Thá»‘ng kÃª tá»•ng quan
 * - Quáº£n lÃ½ sáº£n pháº©m: CRUD sáº£n pháº©m, quáº£n lÃ½ áº£nh
 * - Quáº£n lÃ½ Ä‘Æ¡n hÃ ng: Xem, cáº­p nháº­t tráº¡ng thÃ¡i
 * - Quáº£n lÃ½ ngÆ°á»i dÃ¹ng: Xem, khÃ³a/má»Ÿ khÃ³a tÃ i khoáº£n
 * - Quáº£n lÃ½ banner: CRUD banner quáº£ng cÃ¡o
 * - Quáº£n lÃ½ khuyáº¿n mÃ£i: CRUD chÆ°Æ¡ng trÃ¬nh sale
 * - Email marketing: Gá»­i email hÃ ng loáº¡t
 * =============================================================================
 */

const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const Category = require('../models/Category');
const Banner = require('../models/Banner');
const Sale = require('../models/Sale');
const Voucher = require('../models/Voucher');
const Newsletter = require('../models/Newsletter');
const pool = require('../config/database');
const emailService = require('../services/emailService');
const { attachUploadedImagesToProduct, parseVariantsPayload, syncVariants, validateVariants } = require('../services/adminProductVariantService');
const {
    createProductImportTemplateBuffer,
    exportProductsToWorkbookBuffer,
    importProductsFromWorkbook
} = require('../services/productBulkImportService');
const upload = require('../middleware/upload');
const { scheduleProductVisualEmbeddingSync } = require('../services/productVisualEmbeddingService');
const ProductImageEmbedding = require('../models/ProductImageEmbedding');

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

function parseOptionalTrimmedString(value) {
    if (value === undefined) {
        return undefined;
    }

    if (value === null) {
        return null;
    }

    const normalized = String(value).trim();
    return normalized ? normalized : null;
}

function parseOptionalDecimal(value, fieldName) {
    if (value === undefined) {
        return undefined;
    }

    if (value === null || value === '') {
        return null;
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        throw new Error(`${fieldName} is invalid`);
    }

    return parsed;
}

function parseOptionalDate(value, fieldName) {
    if (value === undefined) {
        return undefined;
    }

    if (value === null || value === '') {
        return null;
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        throw new Error(`${fieldName} is invalid`);
    }

    return parsed;
}

function parseChecked(value) {
    return value === true || value === 'true' || value === 'on' || value === 1 || value === '1';
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatCurrencyVnd(value) {
    const amount = Number(value) || 0;
    return `${amount.toLocaleString('vi-VN')}Ä‘`;
}

function formatDateTimeVi(value) {
    if (!value) {
        return 'KhÃ´ng giá»›i háº¡n';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return 'KhÃ´ng giá»›i háº¡n';
    }

    return date.toLocaleString('vi-VN');
}

function buildAdminNoticeRedirect(path, message, type = 'success') {
    const params = new URLSearchParams();
    params.set('notice', message);
    params.set('notice_type', type);
    return `${path}?${params.toString()}`;
}

function cleanupImportUploadFiles(files) {
    const fs = require('fs');
    const fileList = Array.isArray(files)
        ? files
        : Object.values(files || {}).flat();

    fileList.forEach((file) => {
        if (!file?.path) {
            return;
        }

        try {
            if (fs.existsSync(file.path)) {
                fs.unlinkSync(file.path);
            }
        } catch (error) {
            console.warn('Import upload cleanup warning:', error.message);
        }
    });
}

function buildOrderTrackingPayload(body = {}) {
    const payload = {
        source: 'admin'
    };

    if (Object.prototype.hasOwnProperty.call(body, 'carrier')) {
        payload.carrier = parseOptionalTrimmedString(body.carrier);
    }

    if (Object.prototype.hasOwnProperty.call(body, 'tracking_code')) {
        payload.tracking_code = parseOptionalTrimmedString(body.tracking_code);
    }

    if (Object.prototype.hasOwnProperty.call(body, 'tracking_url')) {
        payload.tracking_url = parseOptionalTrimmedString(body.tracking_url);
    }

    if (Object.prototype.hasOwnProperty.call(body, 'current_location_text')) {
        payload.current_location_text = parseOptionalTrimmedString(body.current_location_text);
    }

    if (Object.prototype.hasOwnProperty.call(body, 'current_lat')) {
        payload.current_lat = parseOptionalDecimal(body.current_lat, 'Current latitude');
    }

    if (Object.prototype.hasOwnProperty.call(body, 'current_lng')) {
        payload.current_lng = parseOptionalDecimal(body.current_lng, 'Current longitude');
    }

    if (Object.prototype.hasOwnProperty.call(body, 'estimated_delivery_at')) {
        payload.estimated_delivery_at = parseOptionalDate(body.estimated_delivery_at, 'Estimated delivery time');
    }

    if (Object.prototype.hasOwnProperty.call(body, 'status_title')) {
        payload.title = parseOptionalTrimmedString(body.status_title);
    }

    if (Object.prototype.hasOwnProperty.call(body, 'status_note')) {
        payload.description = parseOptionalTrimmedString(body.status_note);
    }

    return payload;
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

async function getAnnouncementRecipients() {
    const subscribers = await Newsletter.getActiveSubscribers();
    const seenEmails = new Set();

    return subscribers.reduce((list, subscriber) => {
        const email = String(subscriber?.email || '').trim().toLowerCase();
        if (!email || seenEmails.has(email)) {
            return list;
        }

        seenEmails.add(email);
        const fallbackName = email.split('@')[0] || 'báº¡n';

        list.push({
            email,
            full_name: String(subscriber?.user_name || fallbackName).trim() || 'báº¡n'
        });

        return list;
    }, []);
}

function buildVoucherAnnouncementCampaign(voucher) {
    const baseUrl = String(process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
    const valueText = voucher.type === 'percentage'
        ? `Giáº£m ${voucher.value}%${voucher.max_discount_amount ? `, tá»‘i Ä‘a ${formatCurrencyVnd(voucher.max_discount_amount)}` : ''}`
        : `Giáº£m ${formatCurrencyVnd(voucher.value)}`;
    const minOrderText = Number(voucher.min_order_amount || 0) > 0
        ? `ÄÆ¡n tá»‘i thiá»ƒu ${formatCurrencyVnd(voucher.min_order_amount)}`
        : 'KhÃ´ng yÃªu cáº§u giÃ¡ trá»‹ Ä‘Æ¡n tá»‘i thiá»ƒu';
    const scopeText = voucher.applicable_product_count > 0
        ? `Ãp dá»¥ng cho ${voucher.applicable_product_count} sáº£n pháº©m Ä‘Æ°á»£c chá»n`
        : 'Ãp dá»¥ng cho toÃ n bá»™ sáº£n pháº©m Ä‘á»§ Ä‘iá»u kiá»‡n';
    const descriptionHtml = voucher.description
        ? `<p style="margin:0 0 18px;color:#65594d;line-height:1.7;">${escapeHtml(voucher.description)}</p>`
        : '';

    return {
        subject: `Voucher má»›i tá»« WIND OF FALL: ${voucher.code}`,
        content: `
            <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 24px; color: #211d18;">
                <div style="text-align:center; margin-bottom: 24px;">
                    <h1 style="margin:0; font-size:28px; letter-spacing:0.04em;">WIND OF FALL</h1>
                    <p style="margin:8px 0 0; color:#7c6f60;">ThÃ´ng bÃ¡o Æ°u Ä‘Ã£i má»›i dÃ nh cho {{name}}</p>
                </div>
                <div style="background: linear-gradient(135deg, #f8e3a2, #f4c95d); border-radius: 24px; padding: 28px; margin-bottom: 20px;">
                    <p style="margin:0 0 10px; font-size:13px; letter-spacing:0.14em; text-transform:uppercase; color:#7b5d1a;">Voucher má»›i</p>
                    <h2 style="margin:0 0 14px; font-size:30px; color:#1f1a13;">${escapeHtml(voucher.code)}</h2>
                    <p style="margin:0; font-size:18px; font-weight:700; color:#402d05;">${escapeHtml(valueText)}</p>
                </div>
                ${descriptionHtml}
                <table style="width:100%; border-collapse:collapse; margin-bottom: 24px;">
                    <tr>
                        <td style="padding:10px 12px; border:1px solid #ead9b5; color:#7c6f60;">Pháº¡m vi</td>
                        <td style="padding:10px 12px; border:1px solid #ead9b5; font-weight:600;">${escapeHtml(scopeText)}</td>
                    </tr>
                    <tr>
                        <td style="padding:10px 12px; border:1px solid #ead9b5; color:#7c6f60;">Äiá»u kiá»‡n</td>
                        <td style="padding:10px 12px; border:1px solid #ead9b5; font-weight:600;">${escapeHtml(minOrderText)}</td>
                    </tr>
                    <tr>
                        <td style="padding:10px 12px; border:1px solid #ead9b5; color:#7c6f60;">Thá»i gian Ã¡p dá»¥ng</td>
                        <td style="padding:10px 12px; border:1px solid #ead9b5; font-weight:600;">${escapeHtml(formatDateTimeVi(voucher.start_date))} - ${escapeHtml(formatDateTimeVi(voucher.end_date))}</td>
                    </tr>
                </table>
                <div style="text-align:center;">
                    <a href="${baseUrl}" style="display:inline-block; padding:14px 28px; border-radius:999px; background:#17120c; color:#fff; text-decoration:none; font-weight:700;">Mua sáº¯m ngay</a>
                </div>
            </div>
        `
    };
}

function buildSaleAnnouncementCampaign(sale) {
    const baseUrl = String(process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
    const valueText = sale.type === 'percentage'
        ? `Giáº£m ${sale.value}%`
        : `Giáº£m ${formatCurrencyVnd(sale.value)}`;
    const scopeText = sale.assigned_product_count > 0
        ? `Äang Ã¡p dá»¥ng cho ${sale.assigned_product_count} sáº£n pháº©m`
        : 'ChÆ°a gáº¯n sáº£n pháº©m cá»¥ thá»ƒ';
    const descriptionHtml = sale.description
        ? `<p style="margin:0 0 18px;color:#65594d;line-height:1.7;">${escapeHtml(sale.description)}</p>`
        : '';

    return {
        subject: `Khuyáº¿n mÃ£i má»›i tá»« WIND OF FALL: ${sale.name}`,
        content: `
            <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 24px; color: #211d18;">
                <div style="text-align:center; margin-bottom: 24px;">
                    <h1 style="margin:0; font-size:28px; letter-spacing:0.04em;">WIND OF FALL</h1>
                    <p style="margin:8px 0 0; color:#7c6f60;">Æ¯u Ä‘Ã£i má»›i dÃ nh cho {{name}}</p>
                </div>
                <div style="background: linear-gradient(135deg, #fde3b7, #f8b35b); border-radius: 24px; padding: 28px; margin-bottom: 20px;">
                    <p style="margin:0 0 10px; font-size:13px; letter-spacing:0.14em; text-transform:uppercase; color:#9a5412;">ChÆ°Æ¡ng trÃ¬nh khuyáº¿n mÃ£i</p>
                    <h2 style="margin:0 0 14px; font-size:30px; color:#1f1a13;">${escapeHtml(sale.name)}</h2>
                    <p style="margin:0; font-size:18px; font-weight:700; color:#6f2c12;">${escapeHtml(valueText)}</p>
                </div>
                ${descriptionHtml}
                <table style="width:100%; border-collapse:collapse; margin-bottom: 24px;">
                    <tr>
                        <td style="padding:10px 12px; border:1px solid #ead9b5; color:#7c6f60;">Pháº¡m vi</td>
                        <td style="padding:10px 12px; border:1px solid #ead9b5; font-weight:600;">${escapeHtml(scopeText)}</td>
                    </tr>
                    <tr>
                        <td style="padding:10px 12px; border:1px solid #ead9b5; color:#7c6f60;">Thá»i gian Ã¡p dá»¥ng</td>
                        <td style="padding:10px 12px; border:1px solid #ead9b5; font-weight:600;">${escapeHtml(formatDateTimeVi(sale.start_date))} - ${escapeHtml(formatDateTimeVi(sale.end_date))}</td>
                    </tr>
                </table>
                <div style="text-align:center;">
                    <a href="${baseUrl}" style="display:inline-block; padding:14px 28px; border-radius:999px; background:#17120c; color:#fff; text-decoration:none; font-weight:700;">KhÃ¡m phÃ¡ bá»™ sÆ°u táº­p</a>
                </div>
            </div>
        `
    };
}

async function sendCampaignToSubscribers(campaign) {
    const recipients = await getAnnouncementRecipients();
    if (recipients.length === 0) {
        return { total: 0, success: 0 };
    }

    return emailService.sendMarketingEmail(recipients, campaign);
}

async function sendVoucherAnnouncement(voucher) {
    return sendCampaignToSubscribers(buildVoucherAnnouncementCampaign(voucher));
}

async function sendSaleAnnouncement(sale) {
    return sendCampaignToSubscribers(buildSaleAnnouncementCampaign(sale));
}

async function getDashboardAnalytics() {
    const [orderStatusRows, productRows, userRows] = await Promise.all([
        pool.query('SELECT status, COUNT(*) AS total FROM orders GROUP BY status'),
        pool.query(`
            SELECT
                SUM(CASE WHEN is_active = TRUE AND stock_quantity > 0 THEN 1 ELSE 0 END) AS live_products,
                SUM(CASE WHEN is_active = TRUE AND stock_quantity <= 0 THEN 1 ELSE 0 END) AS out_of_stock_products,
                SUM(CASE WHEN is_active = FALSE THEN 1 ELSE 0 END) AS hidden_products
            FROM products
        `),
        pool.query('SELECT COUNT(*) AS total_users FROM users')
    ]);

    const orderStatusCounts = {
        pending: 0,
        confirmed: 0,
        processing: 0,
        shipping: 0,
        delivered: 0,
        cancelled: 0
    };

    (orderStatusRows[0] || []).forEach((row) => {
        const status = Order.normalizeStatus(row.status);
        if (Object.prototype.hasOwnProperty.call(orderStatusCounts, status)) {
            orderStatusCounts[status] = Number(row.total || 0);
        }
    });

    const productStats = productRows[0]?.[0] || {};
    const productStatusCounts = {
        live: Number(productStats.live_products || 0),
        out_of_stock: Number(productStats.out_of_stock_products || 0),
        hidden: Number(productStats.hidden_products || 0)
    };

    return {
        orderStatusCounts,
        processingOrders: orderStatusCounts.confirmed + orderStatusCounts.processing + orderStatusCounts.shipping,
        productStatusCounts,
        totalUsers: Number(userRows[0]?.[0]?.total_users || 0),
        totalProducts: productStatusCounts.live + productStatusCounts.out_of_stock + productStatusCounts.hidden
    };
}

// =============================================================================
// DASHBOARD - Trang tá»•ng quan
// =============================================================================

/**
 * Hiá»ƒn thá»‹ trang Dashboard (Tá»•ng quan)
 *
 * @description Láº¥y cÃ¡c thá»‘ng kÃª tá»•ng quan vá» Ä‘Æ¡n hÃ ng, doanh thu
 *              vÃ  danh sÃ¡ch Ä‘Æ¡n hÃ ng gáº§n Ä‘Ã¢y Ä‘á»ƒ hiá»ƒn thá»‹ trÃªn dashboard
 *
 * @param {Object} req - Request object tá»« Express
 * @param {Object} res - Response object tá»« Express
 *
 * @returns {void} Render trang admin/dashboard vá»›i dá»¯ liá»‡u thá»‘ng kÃª
 */
exports.getDashboard = async (req, res) => {
    try {
        const allowedRecentLimits = new Set([5, 10, 15]);
        const requestedRecentLimit = Number.parseInt(req.query.recent_limit, 10);
        const recentLimit = allowedRecentLimits.has(requestedRecentLimit) ? requestedRecentLimit : 10;
        let dashboardCharts = {
            orderStatus: {
                pending: 0,
                processing: 0,
                delivered: 0,
                cancelled: 0
            },
            productStatus: {
                live: 0,
                out_of_stock: 0,
                hidden: 0
            }
        };

        // Khá»Ÿi táº¡o object thá»‘ng kÃª vá»›i giÃ¡ trá»‹ máº·c Ä‘á»‹nh
        let stats = {
            total_orders: 0,        // Tá»•ng sá»‘ Ä‘Æ¡n hÃ ng
            pending_orders: 0,      // ÄÆ¡n hÃ ng chá» xá»­ lÃ½
            delivered_orders: 0,    // ÄÆ¡n hÃ ng Ä‘Ã£ giao
            cancelled_orders: 0,    // ÄÆ¡n hÃ ng Ä‘Ã£ há»§y
            total_revenue: 0,       // Tá»•ng doanh thu
            today_revenue: 0,       // Doanh thu hÃ´m nay
            month_revenue: 0        // Doanh thu thÃ¡ng nÃ y
        };
        let recentOrders = [];      // Danh sÃ¡ch Ä‘Æ¡n hÃ ng gáº§n Ä‘Ã¢y
        stats.total_users = 0;
        stats.total_products = 0;
        stats.completed_orders = 0;
        stats.processing_orders = 0;

        try {
            // Láº¥y thá»‘ng kÃª tá»« database
            const [orderStats, dashboardAnalytics, recentOrdersData] = await Promise.all([
                Order.getStatistics(),
                getDashboardAnalytics(),
                Order.findAll({ limit: 15, offset: 0 })
            ]);

            stats = {
                ...stats,
                ...(orderStats || {}),
                total_users: dashboardAnalytics.totalUsers,
                total_products: dashboardAnalytics.totalProducts,
                completed_orders: Number(orderStats?.delivered_orders || 0),
                processing_orders: dashboardAnalytics.processingOrders
            };

            recentOrders = recentOrdersData || [];
            dashboardCharts = {
                orderStatus: {
                    pending: dashboardAnalytics.orderStatusCounts.pending,
                    processing: dashboardAnalytics.processingOrders,
                    delivered: dashboardAnalytics.orderStatusCounts.delivered,
                    cancelled: dashboardAnalytics.orderStatusCounts.cancelled
                },
                productStatus: dashboardAnalytics.productStatusCounts
            };
        } catch (err) {
            console.error('Dashboard data error:', err);
            // Sá»­ dá»¥ng giÃ¡ trá»‹ máº·c Ä‘á»‹nh náº¿u lá»—i
        }

        // Render trang dashboard vá»›i dá»¯ liá»‡u
        res.render('admin/dashboard', {
            stats,
            recentOrders,
            recentLimit,
            dashboardCharts,
            user: req.user,
            currentPage: 'dashboard'
        });
    } catch (error) {
        console.error('Lá»—i trang quáº£n trá»‹:', error);
        res.status(500).render('error', { message: 'Lá»—i táº£i dashboard: ' + error.message, user: req.user });
    }
};

// =============================================================================
// QUáº¢N LÃ DANH Má»¤C - Categories Management
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
        res.status(500).render('error', { message: 'Lá»—i táº£i danh má»¥c: ' + error.message, user: req.user });
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
            return res.status(404).json({ success: false, message: 'Danh má»¥c khÃ´ng tá»“n táº¡i' });
        }
        const { name, slug, description, parent_id, image_url, display_order } = req.body;
        if (parent_id && await Category.createsCircularReference(id, parent_id)) {
            return res.status(400).json({ success: false, message: 'KhÃ´ng thá»ƒ táº¡o vÃ²ng láº·p danh má»¥c cha-con' });
        }
        await Category.update(id, {
            name: name || existing.name,
            slug: slug || existing.slug,
            description: description !== undefined ? description : existing.description,
            parent_id: parent_id !== undefined ? (parent_id || null) : existing.parent_id,
            image_url: image_url !== undefined ? (image_url || null) : existing.image_url,
            display_order: display_order !== undefined ? (parseInt(display_order) || 0) : existing.display_order
        });
        res.json({ success: true, message: 'Cáº­p nháº­t danh má»¥c thÃ nh cÃ´ng' });
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
                message: `KhÃ´ng thá»ƒ xÃ³a: danh má»¥c Ä‘ang cÃ³ ${stats.product_count} sáº£n pháº©m vÃ  ${stats.child_count} danh má»¥c con`
            });
        }
        await Category.delete(id);
        res.json({ success: true, message: 'ÄÃ£ xÃ³a danh má»¥c' });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// =============================================================================
// QUáº¢N LÃ Sáº¢N PHáº¨M - Products Management
// =============================================================================

/**
 * Hiá»ƒn thá»‹ danh sÃ¡ch sáº£n pháº©m
 *
 * @description Láº¥y danh sÃ¡ch táº¥t cáº£ sáº£n pháº©m vÃ  danh má»¥c
 *              Ä‘á»ƒ hiá»ƒn thá»‹ trÃªn trang quáº£n lÃ½ sáº£n pháº©m
 *
 * @param {Object} req - Request object tá»« Express
 * @param {Object} res - Response object tá»« Express
 *
 * @returns {void} Render trang admin/products vá»›i danh sÃ¡ch sáº£n pháº©m
 */
exports.getProducts = async (req, res) => {
    try {
        let products = [];
        let categories = [];
        let totalItems = 0;
        let totalProductCount = 0;
        const bulkImportResult = req.session?.adminProductImportResult || null;

        if (req.session?.adminProductImportResult) {
            delete req.session.adminProductImportResult;
        }

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
            totalProductCount = await Product.countAllRecords();
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
            pagination: { totalItems, totalPages, currentPage: page, limit, searchQuery },
            bulkImportResult,
            totalProductCount
        });
    } catch (error) {
        res.status(500).render('error', { message: 'Lá»—i táº£i sáº£n pháº©m: ' + error.message, user: req.user });
    }
};

exports.downloadProductImportTemplate = async (req, res) => {
    try {
        const workbookBuffer = createProductImportTemplateBuffer();
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="wind-of-fall-product-import-template.xlsx"');
        res.send(workbookBuffer);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.exportProducts = async (req, res) => {
    try {
        const workbookBuffer = await exportProductsToWorkbookBuffer({
            search: typeof req.query.search === 'string' ? req.query.search.trim() : ''
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="wind-of-fall-products-export.xlsx"');
        res.send(workbookBuffer);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.importProducts = async (req, res) => {
    try {
        req.session = req.session || {};
        const workbookFile = req.files?.import_file?.[0] || null;
        const zipFile = req.files?.images_zip?.[0] || null;

        if (!workbookFile) {
            req.session.adminProductImportResult = {
                totalProducts: 0,
                createdCount: 0,
                failedCount: 0,
                createdProducts: [],
                errors: [{ message: 'Vui lÃ²ng táº£i lÃªn file Excel (.xlsx hoáº·c .xls).' }]
            };
            return res.redirect('/admin/products');
        }

        const result = await importProductsFromWorkbook({
            workbookPath: workbookFile.path,
            zipPath: zipFile?.path || null
        });

        req.session.adminProductImportResult = result;
        res.redirect(buildAdminNoticeRedirect(
            '/admin/products',
            result.failedCount > 0
                ? `Da import ${result.createdCount}/${result.totalProducts} san pham. Co ${result.failedCount} dong bi loi.`
                : `Da import thanh cong ${result.createdCount} san pham.`,
            result.failedCount > 0 ? 'warning' : 'success'
        ));
    } catch (error) {
        req.session.adminProductImportResult = {
            totalProducts: 0,
            createdCount: 0,
            failedCount: 0,
            createdProducts: [],
            errors: [{ message: error.message || 'Khong the import san pham tu file Excel.' }]
        };
        res.redirect(buildAdminNoticeRedirect('/admin/products', 'Import san pham that bai.', 'error'));
    } finally {
        cleanupImportUploadFiles(req.files);
    }
};

/**
 * Táº¡o sáº£n pháº©m má»›i
 *
 * @description Nháº­n dá»¯ liá»‡u tá»« form táº¡o sáº£n pháº©m, tá»± Ä‘á»™ng táº¡o slug náº¿u khÃ´ng cÃ³,
 *              lÆ°u sáº£n pháº©m vÃ o database vÃ  xá»­ lÃ½ upload áº£nh
 *
 * @param {Object} req - Request object tá»« Express
 * @param {Object} req.body - Dá»¯ liá»‡u sáº£n pháº©m tá»« form
 * @param {number} req.body.category_id - ID danh má»¥c
 * @param {string} req.body.name - TÃªn sáº£n pháº©m
 * @param {string} [req.body.slug] - Slug URL (tá»± Ä‘á»™ng táº¡o náº¿u khÃ´ng cÃ³)
 * @param {string} req.body.description - MÃ´ táº£ sáº£n pháº©m
 * @param {number} req.body.price - GiÃ¡ sáº£n pháº©m
 * @param {number} req.body.stock_quantity - Sá»‘ lÆ°á»£ng tá»“n kho
 * @param {string} req.body.sku - MÃ£ SKU
 * @param {number} [req.body.sale_id] - ID chÆ°Æ¡ng trÃ¬nh khuyáº¿n mÃ£i
 * @param {string} [req.body.is_featured] - Sáº£n pháº©m ná»•i báº­t ('on' = true)
 * @param {Array} [req.files] - Danh sÃ¡ch file áº£nh upload
 * @param {Object} res - Response object tá»« Express
 *
 * @returns {Redirect} Redirect vá» trang danh sÃ¡ch sáº£n pháº©m
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

        scheduleProductVisualEmbeddingSync(product.id);

        res.redirect('/admin/products');
    } catch (error) {
        console.error('Create product error:', error);
        res.redirect('/admin/products?error=' + encodeURIComponent(error.message));
    }
};

/**
 * Cáº­p nháº­t thÃ´ng tin sáº£n pháº©m
 *
 * @description Nháº­n dá»¯ liá»‡u cáº­p nháº­t tá»« form vÃ  lÆ°u vÃ o database
 *
 * @param {Object} req - Request object tá»« Express
 * @param {Object} req.params - Tham sá»‘ URL
 * @param {number} req.params.id - ID sáº£n pháº©m cáº§n cáº­p nháº­t
 * @param {Object} req.body - Dá»¯ liá»‡u cáº­p nháº­t
 * @param {Object} res - Response object tá»« Express
 *
 * @returns {Redirect} Redirect vá» trang danh sÃ¡ch sáº£n pháº©m
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
            return res.status(404).json({ success: false, message: 'Sáº£n pháº©m khÃ´ng tá»“n táº¡i' });
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

        scheduleProductVisualEmbeddingSync(id);

        res.json({ success: true, message: 'Cáº­p nháº­t sáº£n pháº©m thÃ nh cÃ´ng' });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

/**
 * XÃ³a sáº£n pháº©m
 *
 * @description XÃ³a sáº£n pháº©m khá»i database dá»±a trÃªn ID
 *
 * @param {Object} req - Request object tá»« Express
 * @param {Object} req.params - Tham sá»‘ URL
 * @param {number} req.params.id - ID sáº£n pháº©m cáº§n xÃ³a
 * @param {Object} res - Response object tá»« Express
 *
 * @returns {JSON} Tráº£ vá» JSON vá»›i thÃ´ng bÃ¡o thÃ nh cÃ´ng/tháº¥t báº¡i
 */
exports.deleteProduct = async (req, res) => {
    try {
        const { id } = req.params;
        // XÃ³a sáº£n pháº©m (sáº½ cascade xÃ³a cáº£ áº£nh liÃªn quan)
        await Product.delete(id);
        res.json({ message: 'Product deleted successfully' });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.deleteAllProducts = async (req, res) => {
    try {
        const result = await Product.deleteAllPermanently();
        res.json({
            success: true,
            deletedCount: result.deletedProducts,
            blockedCount: result.blockedProducts,
            message: result.totalProducts === 0
                ? 'Không có sản phẩm nào trong database để xóa.'
                : result.blockedProducts > 0
                    ? `Đã xóa vĩnh viễn ${result.deletedProducts} sản phẩm. Còn ${result.blockedProducts} sản phẩm không thể xóa vì đã nằm trong lịch sử đơn hàng.`
                    : `Đã xóa vĩnh viễn ${result.deletedProducts} sản phẩm khỏi database.`
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// =============================================================================
// QUáº¢N LÃ ÄÆ N HÃ€NG - Orders Management
// =============================================================================

/**
 * Hiá»ƒn thá»‹ danh sÃ¡ch Ä‘Æ¡n hÃ ng
 *
 * @description Láº¥y danh sÃ¡ch táº¥t cáº£ Ä‘Æ¡n hÃ ng Ä‘á»ƒ hiá»ƒn thá»‹ trÃªn trang quáº£n lÃ½
 *
 * @param {Object} req - Request object tá»« Express
 * @param {Object} res - Response object tá»« Express
 *
 * @returns {void} Render trang admin/orders vá»›i danh sÃ¡ch Ä‘Æ¡n hÃ ng
 */
exports.getOrders = async (req, res) => {
    try {
        let orders = [];
        const searchQuery = typeof req.query.search === 'string' ? req.query.search.trim() : '';
        try {
            // Láº¥y 50 Ä‘Æ¡n hÃ ng gáº§n nháº¥t
            orders = await Order.findAll({
                limit: 50,
                offset: 0,
                ...(searchQuery ? { search: searchQuery } : {})
            });
        } catch (err) {
            console.error('Orders data error:', err);
        }

        // Render trang quáº£n lÃ½ Ä‘Æ¡n hÃ ng
        res.render('admin/orders', {
            orders,
            searchQuery,
            user: req.user,
            currentPage: 'orders'
        });
    } catch (error) {
        res.status(500).render('error', { message: 'Lá»—i táº£i Ä‘Æ¡n hÃ ng: ' + error.message, user: req.user });
    }
};

/**
 * Hiá»ƒn thá»‹ chi tiáº¿t Ä‘Æ¡n hÃ ng
 *
 * @param {Object} req - Request object tá»« Express
 * @param {Object} res - Response object tá»« Express
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
        res.status(500).render('error', { message: 'Lá»—i táº£i Ä‘Æ¡n hÃ ng: ' + error.message, user: req.user });
    }
};

/**
 * Cáº­p nháº­t tráº¡ng thÃ¡i Ä‘Æ¡n hÃ ng
 *
 * @description Thay Ä‘á»•i tráº¡ng thÃ¡i Ä‘Æ¡n hÃ ng (pending, confirmed, shipping, delivered, cancelled)
 *
 * @param {Object} req - Request object tá»« Express
 * @param {Object} req.params.id - ID Ä‘Æ¡n hÃ ng
 * @param {Object} req.body.status - Tráº¡ng thÃ¡i má»›i
 * @param {Object} res - Response object tá»« Express
 *
 * @returns {JSON} Tráº£ vá» JSON vá»›i thÃ´ng bÃ¡o thÃ nh cÃ´ng/tháº¥t báº¡i
 */
exports.updateOrderStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        // Cáº­p nháº­t tráº¡ng thÃ¡i trong database
        await Order.updateStatus(id, status);
        res.json({ message: 'Order status updated successfully' });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// =============================================================================
// QUáº¢N LÃ NGÆ¯á»œI DÃ™NG - Users Management
// =============================================================================

/**
 * Hiá»ƒn thá»‹ danh sÃ¡ch ngÆ°á»i dÃ¹ng
 *
 * @description Láº¥y danh sÃ¡ch táº¥t cáº£ ngÆ°á»i dÃ¹ng Ä‘Ã£ Ä‘Äƒng kÃ½
 *
 * @param {Object} req - Request object tá»« Express
 * @param {Object} res - Response object tá»« Express
 *
 * @returns {void} Render trang admin/users vá»›i danh sÃ¡ch ngÆ°á»i dÃ¹ng
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
            // Äáº¿m tá»•ng ngÆ°á»i dÃ¹ng
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
        res.status(500).render('error', { message: 'Lá»—i táº£i ngÆ°á»i dÃ¹ng: ' + error.message, user: req.user });
    }
};

/**
 * Xem chi tiáº¿t ngÆ°á»i dÃ¹ng (API JSON)
 *
 * @param {Object} req - Request object tá»« Express
 * @param {Object} res - Response object tá»« Express
 */
exports.getUserDetail = async (req, res) => {
    try {
        const { id } = req.params;
        const pool = require('../config/database');

        // Láº¥y user info (bao gá»“m cáº£ bá»‹ khÃ³a)
        const [users] = await pool.execute(
            'SELECT id, email, full_name, phone, avatar_url, birthday, role, email_verified, marketing_consent, is_active, created_at FROM users WHERE id = ?',
            [id]
        );
        const userData = users[0];
        if (!userData) {
            return res.status(404).json({ success: false, message: 'KhÃ´ng tÃ¬m tháº¥y ngÆ°á»i dÃ¹ng' });
        }

        // Láº¥y Ä‘á»‹a chá»‰
        const [addresses] = await pool.execute(
            'SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC',
            [id]
        );
        userData.addresses = addresses;

        // Láº¥y 5 Ä‘Æ¡n hÃ ng gáº§n nháº¥t
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
 * Cáº­p nháº­t tráº¡ng thÃ¡i ngÆ°á»i dÃ¹ng (KhÃ³a/Má»Ÿ khÃ³a)
 *
 * @description KhÃ³a hoáº·c má»Ÿ khÃ³a tÃ i khoáº£n ngÆ°á»i dÃ¹ng
 *
 * @param {Object} req - Request object tá»« Express
 * @param {Object} req.params.id - ID ngÆ°á»i dÃ¹ng
 * @param {Object} req.body.is_active - Tráº¡ng thÃ¡i má»›i ('true' hoáº·c 'false')
 * @param {Object} res - Response object tá»« Express
 *
 * @returns {JSON} Tráº£ vá» JSON vá»›i thÃ´ng bÃ¡o thÃ nh cÃ´ng/tháº¥t báº¡i
 */
exports.updateUserStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { is_active } = req.body;

        // Cáº­p nháº­t tráº¡ng thÃ¡i (chuyá»ƒn string 'true'/'false' thÃ nh boolean)
        await User.updateStatus(id, is_active === 'true');
        res.json({ message: 'User status updated successfully' });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// =============================================================================
// QUáº¢N LÃ BANNER - Banners Management
// =============================================================================

/**
 * Hiá»ƒn thá»‹ danh sÃ¡ch banner
 *
 * @description Láº¥y danh sÃ¡ch táº¥t cáº£ banner quáº£ng cÃ¡o
 *
 * @param {Object} req - Request object tá»« Express
 * @param {Object} res - Response object tá»« Express
 *
 * @returns {void} Render trang admin/banners vá»›i danh sÃ¡ch banner
 */
exports.getBanners = async (req, res) => {
    try {
        let banners = [];
        try {
            banners = await Banner.findAll();
        } catch (err) {
            console.error('Banners data error:', err);
        }

        // Render trang quáº£n lÃ½ banner
        res.render('admin/banners', {
            banners,
            user: req.user,
            currentPage: 'banners'
        });
    } catch (error) {
        res.status(500).render('error', { message: 'Lá»—i táº£i banners: ' + error.message, user: req.user });
    }
};

/**
 * Táº¡o banner má»›i
 *
 * @description Táº¡o banner quáº£ng cÃ¡o má»›i vá»›i áº£nh upload hoáº·c URL
 *
 * @param {Object} req - Request object tá»« Express
 * @param {Object} req.body - Dá»¯ liá»‡u banner
 * @param {string} req.body.title - TiÃªu Ä‘á» banner
 * @param {string} req.body.subtitle - TiÃªu Ä‘á» phá»¥
 * @param {string} req.body.description - MÃ´ táº£
 * @param {string} req.body.link_url - URL khi click vÃ o banner
 * @param {string} req.body.button_text - Text nÃºt CTA
 * @param {number} req.body.display_order - Thá»© tá»± hiá»ƒn thá»‹
 * @param {string} [req.body.start_date] - NgÃ y báº¯t Ä‘áº§u hiá»ƒn thá»‹
 * @param {string} [req.body.end_date] - NgÃ y káº¿t thÃºc hiá»ƒn thá»‹
 * @param {Object} [req.file] - File áº£nh upload
 * @param {Object} res - Response object tá»« Express
 *
 * @returns {Redirect} Redirect vá» trang danh sÃ¡ch banner
 */
exports.createBanner = async (req, res) => {
    try {
        // Láº¥y dá»¯ liá»‡u tá»« form
        const { title, subtitle, description, link_url, button_text, display_order, start_date, end_date } = req.body;

        // Xá»­ lÃ½ áº£nh upload (Æ°u tiÃªn URL Cloudinary)
        let image_url = '';
        if (req.file) {
            image_url = req.file.cloudinaryUrl || `/uploads/${req.file.filename}`;
        }

        // Táº¡o banner trong database
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

        // Redirect vá» trang danh sÃ¡ch
        res.redirect('/admin/banners');
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

/**
 * XÃ³a banner
 *
 * @description XÃ³a banner khá»i database
 *
 * @param {Object} req - Request object tá»« Express
 * @param {Object} req.params.id - ID banner cáº§n xÃ³a
 * @param {Object} res - Response object tá»« Express
 *
 * @returns {JSON} Tráº£ vá» JSON vá»›i thÃ´ng bÃ¡o thÃ nh cÃ´ng/tháº¥t báº¡i
 */
exports.deleteBanner = async (req, res) => {
    try {
        const pool = require('../config/database');
        // XÃ³a banner tá»« database
        await pool.execute('DELETE FROM banners WHERE id = ?', [req.params.id]);
        res.json({ success: true, message: 'Banner deleted' });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// =============================================================================
// QUáº¢N LÃ KHUYáº¾N MÃƒI - Sales Management
// =============================================================================

/**
 * Hiá»ƒn thá»‹ danh sÃ¡ch khuyáº¿n mÃ£i
 *
 * @description Láº¥y danh sÃ¡ch táº¥t cáº£ chÆ°Æ¡ng trÃ¬nh khuyáº¿n mÃ£i
 *
 * @param {Object} req - Request object tá»« Express
 * @param {Object} res - Response object tá»« Express
 *
 * @returns {void} Render trang admin/sales vá»›i danh sÃ¡ch khuyáº¿n mÃ£i
 */
exports.getSales = async (req, res) => {
    try {
        let sales = [];
        let products = [];
        let subscriberCount = 0;
        const searchQuery = typeof req.query.search === 'string' ? req.query.search.trim() : '';
        try {
            const [salesData, productsData, totalSubscribers] = await Promise.all([
                Sale.findAll(searchQuery ? { search: searchQuery } : {}),
                Product.findAll({ limit: 1000, offset: 0, sort_by: 'name', sort_order: 'ASC' }),
                Newsletter.countActive()
            ]);
            sales = await attachSaleAssignments(salesData);
            products = productsData;
            subscriberCount = totalSubscribers;
        } catch (err) {
            console.error('Sales data error:', err);
        }

        // Render trang quáº£n lÃ½ khuyáº¿n mÃ£i
        res.render('admin/sales', {
            sales,
            products,
            subscriberCount,
            searchQuery,
            user: req.user,
            currentPage: 'sales'
        });
    } catch (error) {
        res.status(500).render('error', { message: 'Lá»—i táº£i khuyáº¿n mÃ£i: ' + error.message, user: req.user });
    }
};

/**
 * Táº¡o chÆ°Æ¡ng trÃ¬nh khuyáº¿n mÃ£i má»›i
 *
 * @description Táº¡o khuyáº¿n mÃ£i má»›i vá»›i loáº¡i giáº£m giÃ¡ (% hoáº·c sá»‘ tiá»n cá»‘ Ä‘á»‹nh)
 *
 * @param {Object} req - Request object tá»« Express
 * @param {Object} req.body - Dá»¯ liá»‡u khuyáº¿n mÃ£i
 * @param {string} req.body.name - TÃªn chÆ°Æ¡ng trÃ¬nh
 * @param {string} req.body.description - MÃ´ táº£
 * @param {string} req.body.type - Loáº¡i giáº£m giÃ¡ ('percentage' hoáº·c 'fixed')
 * @param {number} req.body.value - GiÃ¡ trá»‹ giáº£m (% hoáº·c sá»‘ tiá»n)
 * @param {string} req.body.start_date - NgÃ y báº¯t Ä‘áº§u
 * @param {string} req.body.end_date - NgÃ y káº¿t thÃºc
 * @param {Object} res - Response object tá»« Express
 *
 * @returns {Redirect} Redirect vá» trang danh sÃ¡ch khuyáº¿n mÃ£i
 */
exports.createSale = async (req, res) => {
    try {
        const { name, description, type, value, start_date, end_date } = req.body;
        const productIds = parseSelectedProductIds(req.body);
        const shouldNotifySubscribers = parseChecked(req.body.notify_subscribers);

        // Táº¡o khuyáº¿n mÃ£i trong database
        const sale = await Sale.create({
            name,
            description,
            type,
            value: parseFloat(value),
            start_date,
            end_date
        });

        await Sale.assignProducts(sale.id, productIds);

        if (shouldNotifySubscribers) {
            const [createdSale] = await attachSaleAssignments([await Sale.findById(sale.id)]);
            const result = await sendSaleAnnouncement(createdSale);

            if (result.total === 0) {
                return res.redirect(buildAdminNoticeRedirect('/admin/sales', 'ÄÃ£ táº¡o khuyáº¿n mÃ£i nhÆ°ng hiá»‡n chÆ°a cÃ³ ngÆ°á»i Ä‘Äƒng kÃ½ nháº­n thÃ´ng bÃ¡o.', 'warning'));
            }

            if (result.success === result.total) {
                return res.redirect(buildAdminNoticeRedirect('/admin/sales', `ÄÃ£ táº¡o khuyáº¿n mÃ£i vÃ  gá»­i email thÃ nh cÃ´ng tá»›i ${result.success} ngÆ°á»i Ä‘Äƒng kÃ½.`));
            }

            if (result.success > 0) {
                return res.redirect(buildAdminNoticeRedirect('/admin/sales', `ÄÃ£ táº¡o khuyáº¿n mÃ£i vÃ  gá»­i email tá»›i ${result.success}/${result.total} ngÆ°á»i Ä‘Äƒng kÃ½.`, 'warning'));
            }

            return res.redirect(buildAdminNoticeRedirect('/admin/sales', 'ÄÃ£ táº¡o khuyáº¿n mÃ£i nhÆ°ng chÆ°a gá»­i email thÃ nh cÃ´ng. Vui lÃ²ng kiá»ƒm tra cáº¥u hÃ¬nh email.', 'error'));
        }

        // Redirect vá» trang danh sÃ¡ch
        res.redirect(buildAdminNoticeRedirect('/admin/sales', 'ÄÃ£ táº¡o khuyáº¿n mÃ£i thÃ nh cÃ´ng.'));
    } catch (error) {
        res.redirect(buildAdminNoticeRedirect('/admin/sales', error.message || 'KhÃ´ng thá»ƒ táº¡o khuyáº¿n mÃ£i.', 'error'));
    }
};

/**
 * Cáº­p nháº­t chÆ°Æ¡ng trÃ¬nh khuyáº¿n mÃ£i
 */
exports.updateSale = async (req, res) => {
    try {
        const { id } = req.params;
        const existingSale = await Sale.findById(id);

        if (!existingSale) {
            return res.status(404).json({ success: false, message: 'Khuyáº¿n mÃ£i khÃ´ng tá»“n táº¡i' });
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

        res.json({ success: true, message: 'Cáº­p nháº­t khuyáº¿n mÃ£i thÃ nh cÃ´ng' });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

/**
 * Ngá»«ng vÃ  gá»¡ Ã¡p dá»¥ng khuyáº¿n mÃ£i khá»i sáº£n pháº©m
 */
exports.deleteSale = async (req, res) => {
    try {
        const { id } = req.params;
        const existingSale = await Sale.findById(id);

        if (!existingSale) {
            return res.status(404).json({ success: false, message: 'Khuyáº¿n mÃ£i khÃ´ng tá»“n táº¡i' });
        }

        await Sale.assignProducts(id, []);
        await Sale.delete(id);

        res.json({ success: true, message: 'ÄÃ£ ngá»«ng khuyáº¿n mÃ£i' });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.sendSaleAnnouncementEmail = async (req, res) => {
    try {
        const { id } = req.params;
        const existingSale = await Sale.findById(id);

        if (!existingSale) {
            return res.status(404).json({ success: false, message: 'Khuyáº¿n mÃ£i khÃ´ng tá»“n táº¡i', toastType: 'error' });
        }

        const [sale] = await attachSaleAssignments([existingSale]);
        const result = await sendSaleAnnouncement(sale);

        if (result.total === 0) {
            return res.json({
                success: true,
                toastType: 'warning',
                message: 'Hiá»‡n chÆ°a cÃ³ ngÆ°á»i dÃ¹ng nÃ o Ä‘Äƒng kÃ½ nháº­n thÃ´ng bÃ¡o.'
            });
        }

        if (result.success === result.total) {
            return res.json({
                success: true,
                toastType: 'success',
                message: `ÄÃ£ gá»­i email thÃ´ng bÃ¡o khuyáº¿n mÃ£i tá»›i ${result.success} ngÆ°á»i Ä‘Äƒng kÃ½.`
            });
        }

        if (result.success > 0) {
            return res.json({
                success: true,
                toastType: 'warning',
                message: `ÄÃ£ gá»­i email tá»›i ${result.success}/${result.total} ngÆ°á»i Ä‘Äƒng kÃ½.`
            });
        }

        return res.status(500).json({
            success: false,
            toastType: 'error',
            message: 'KhÃ´ng gá»­i Ä‘Æ°á»£c email thÃ´ng bÃ¡o. Vui lÃ²ng kiá»ƒm tra cáº¥u hÃ¬nh email.'
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message, toastType: 'error' });
    }
};

// =============================================================================
// EMAIL MARKETING
// =============================================================================

/**
 * Gá»­i email marketing hÃ ng loáº¡t
 *
 * @description Gá»­i email quáº£ng cÃ¡o Ä‘áº¿n táº¥t cáº£ ngÆ°á»i dÃ¹ng Ä‘Ã£ Ä‘á»“ng Ã½ nháº­n marketing
 *
 * @param {Object} req - Request object tá»« Express
 * @param {Object} req.body - Ná»™i dung email
 * @param {string} req.body.subject - TiÃªu Ä‘á» email
 * @param {string} req.body.content - Ná»™i dung email (HTML)
 * @param {Object} res - Response object tá»« Express
 *
 * @returns {JSON} Tráº£ vá» JSON vá»›i sá»‘ lÆ°á»£ng email Ä‘Ã£ gá»­i thÃ nh cÃ´ng
 */
exports.sendMarketingEmail = async (req, res) => {
    try {
        const { subject, content } = req.body;

        // Láº¥y danh sÃ¡ch ngÆ°á»i dÃ¹ng Ä‘Ã£ Ä‘á»“ng Ã½ nháº­n email marketing
        const users = await User.getMarketingList();

        // Gá»­i email hÃ ng loáº¡t
        const result = await emailService.sendMarketingEmail(users, {
            subject,
            content
        });

        // Tráº£ vá» káº¿t quáº£
        res.json({
            message: `Email sent to ${result.success}/${result.total} users`
        });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// =============================================================================
// QUáº¢N LÃ áº¢NH Sáº¢N PHáº¨M - Product Images Management
// =============================================================================

/**
 * Láº¥y danh sÃ¡ch áº£nh cá»§a sáº£n pháº©m
 *
 * @description Láº¥y táº¥t cáº£ áº£nh cá»§a má»™t sáº£n pháº©m, sáº¯p xáº¿p áº£nh chÃ­nh lÃªn Ä‘áº§u
 *
 * @param {Object} req - Request object tá»« Express
 * @param {Object} req.params.id - ID sáº£n pháº©m
 * @param {Object} res - Response object tá»« Express
 *
 * @returns {JSON} Tráº£ vá» JSON vá»›i danh sÃ¡ch áº£nh: { images: [...] }
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
 * ThÃªm áº£nh sáº£n pháº©m báº±ng URL
 *
 * @description ThÃªm áº£nh má»›i cho sáº£n pháº©m báº±ng cÃ¡ch nháº­p URL áº£nh
 *
 * @param {Object} req - Request object tá»« Express
 * @param {Object} req.params.id - ID sáº£n pháº©m
 * @param {Object} req.body.image_url - URL cá»§a áº£nh
 * @param {boolean} [req.body.is_primary] - Äáº·t lÃ m áº£nh chÃ­nh
 * @param {Object} res - Response object tá»« Express
 *
 * @returns {JSON} Tráº£ vá» JSON vá»›i thÃ´ng bÃ¡o thÃ nh cÃ´ng/tháº¥t báº¡i
 */
exports.addProductImageUrl = async (req, res) => {
    try {
        const pool = require('../config/database');
        const { image_url, is_primary } = req.body;
        const productId = req.params.id;

        // Náº¿u Ä‘áº·t lÃ m áº£nh chÃ­nh, bá» flag is_primary cá»§a cÃ¡c áº£nh khÃ¡c
        if (is_primary) {
            await pool.execute(
                'UPDATE product_images SET is_primary = FALSE WHERE product_id = ?',
                [productId]
            );
        }

        // ThÃªm áº£nh má»›i vÃ o database
        await pool.execute(
            'INSERT INTO product_images (product_id, image_url, is_primary) VALUES (?, ?, ?)',
            [productId, image_url, is_primary || false]
        );

        scheduleProductVisualEmbeddingSync(productId);

        res.json({ success: true, message: 'Image added' });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

/**
 * Upload áº£nh sáº£n pháº©m
 *
 * @description Upload file áº£nh tá»« mÃ¡y tÃ­nh vÃ  lÆ°u vÃ o server
 *
 * @param {Object} req - Request object tá»« Express
 * @param {Object} req.params.id - ID sáº£n pháº©m
 * @param {Object} req.file - File áº£nh upload (tá»« multer)
 * @param {string} req.body.is_primary - Äáº·t lÃ m áº£nh chÃ­nh ('true'/'false')
 * @param {Object} res - Response object tá»« Express
 *
 * @returns {JSON} Tráº£ vá» JSON vá»›i thÃ´ng bÃ¡o thÃ nh cÃ´ng/tháº¥t báº¡i
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

        scheduleProductVisualEmbeddingSync(productId);

        res.json({
            success: true,
            message: files.length > 1 ? `ÄÃ£ táº£i lÃªn ${files.length} áº£nh` : 'ÄÃ£ táº£i lÃªn áº£nh'
        });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

/**
 * XÃ³a áº£nh sáº£n pháº©m
 *
 * @description XÃ³a má»™t áº£nh khá»i sáº£n pháº©m
 *
 * @param {Object} req - Request object tá»« Express
 * @param {Object} req.params.imageId - ID cá»§a áº£nh cáº§n xÃ³a
 * @param {Object} res - Response object tá»« Express
 *
 * @returns {JSON} Tráº£ vá» JSON vá»›i thÃ´ng bÃ¡o thÃ nh cÃ´ng/tháº¥t báº¡i
 */
exports.deleteProductImage = async (req, res) => {
    try {
        const pool = require('../config/database');
        const [rows] = await pool.execute(
            'SELECT product_id, is_primary FROM product_images WHERE id = ? LIMIT 1',
            [req.params.imageId]
        );
        const row = rows[0];
        await pool.execute('DELETE FROM product_images WHERE id = ?', [req.params.imageId]);
        if (row?.is_primary) {
            await ProductImageEmbedding.deleteByProductId(row.product_id);
        }
        if (row?.product_id) {
            scheduleProductVisualEmbeddingSync(row.product_id);
        }
        res.json({ success: true, message: 'Image deleted' });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

/**
 * Äáº·t áº£nh lÃ m áº£nh chÃ­nh
 *
 * @description Äáº·t má»™t áº£nh lÃ m áº£nh chÃ­nh (primary) cá»§a sáº£n pháº©m.
 *              Bá» flag is_primary cá»§a cÃ¡c áº£nh khÃ¡c cÃ¹ng sáº£n pháº©m
 *
 * @param {Object} req - Request object tá»« Express
 * @param {Object} req.params.imageId - ID cá»§a áº£nh cáº§n Ä‘áº·t lÃ m chÃ­nh
 * @param {Object} res - Response object tá»« Express
 *
 * @returns {JSON} Tráº£ vá» JSON vá»›i thÃ´ng bÃ¡o thÃ nh cÃ´ng/tháº¥t báº¡i
 */
exports.setPrimaryImage = async (req, res) => {
    try {
        const pool = require('../config/database');
        const imageId = req.params.imageId;

        // Láº¥y product_id tá»« áº£nh nÃ y
        const [image] = await pool.execute(
            'SELECT product_id FROM product_images WHERE id = ?',
            [imageId]
        );

        // Kiá»ƒm tra áº£nh cÃ³ tá»“n táº¡i khÃ´ng
        if (image.length === 0) {
            return res.status(404).json({ message: 'Image not found' });
        }

        const productId = image[0].product_id;

        // Bá» flag is_primary cá»§a táº¥t cáº£ áº£nh cÃ¹ng sáº£n pháº©m
        await pool.execute(
            'UPDATE product_images SET is_primary = FALSE WHERE product_id = ?',
            [productId]
        );

        // Äáº·t áº£nh nÃ y lÃ m áº£nh chÃ­nh
        await pool.execute(
            'UPDATE product_images SET is_primary = TRUE WHERE id = ?',
            [imageId]
        );

        scheduleProductVisualEmbeddingSync(productId);

        res.json({ success: true, message: 'Primary image set' });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// =============================================================================
// QUáº¢N LÃ VOUCHER - Vouchers Management
// =============================================================================

/**
 * Hiá»ƒn thá»‹ danh sÃ¡ch voucher
 */
exports.getVouchers = async (req, res) => {
    try {
        let vouchers = [];
        let products = [];
        let subscriberCount = 0;
        const searchQuery = typeof req.query.search === 'string' ? req.query.search.trim() : '';
        try {
            const [voucherData, productsData, totalSubscribers] = await Promise.all([
                Voucher.findAll(searchQuery ? { search: searchQuery } : {}),
                Product.findAll({ limit: 1000, offset: 0, sort_by: 'name', sort_order: 'ASC' }),
                Newsletter.countActive()
            ]);
            vouchers = await attachVoucherAssignments(voucherData);
            products = productsData;
            subscriberCount = totalSubscribers;
        } catch (err) {
            console.error('Vouchers data error:', err);
        }

        res.render('admin/vouchers', {
            vouchers,
            products,
            subscriberCount,
            searchQuery,
            user: req.user,
            currentPage: 'vouchers'
        });
    } catch (error) {
        res.status(500).render('error', { message: 'Lá»—i táº£i vouchers: ' + error.message, user: req.user });
    }
};

/**
 * Táº¡o voucher má»›i
 */
exports.createVoucher = async (req, res) => {
    try {
        const {
            code, name, description, type, value,
            min_order_amount, max_discount_amount, usage_limit,
            user_limit, start_date, end_date, is_active
        } = req.body;
        const productIds = parseSelectedProductIds(req.body);
        const shouldNotifySubscribers = parseChecked(req.body.notify_subscribers);

        const createdVoucher = await Voucher.create({
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

        if (shouldNotifySubscribers) {
            const [voucher] = await attachVoucherAssignments([await Voucher.findById(createdVoucher.id)]);
            const result = await sendVoucherAnnouncement(voucher);

            if (result.total === 0) {
                return res.redirect(buildAdminNoticeRedirect('/admin/vouchers', 'ÄÃ£ táº¡o voucher nhÆ°ng hiá»‡n chÆ°a cÃ³ ngÆ°á»i Ä‘Äƒng kÃ½ nháº­n thÃ´ng bÃ¡o.', 'warning'));
            }

            if (result.success === result.total) {
                return res.redirect(buildAdminNoticeRedirect('/admin/vouchers', `ÄÃ£ táº¡o voucher vÃ  gá»­i email thÃ nh cÃ´ng tá»›i ${result.success} ngÆ°á»i Ä‘Äƒng kÃ½.`));
            }

            if (result.success > 0) {
                return res.redirect(buildAdminNoticeRedirect('/admin/vouchers', `ÄÃ£ táº¡o voucher vÃ  gá»­i email tá»›i ${result.success}/${result.total} ngÆ°á»i Ä‘Äƒng kÃ½.`, 'warning'));
            }

            return res.redirect(buildAdminNoticeRedirect('/admin/vouchers', 'ÄÃ£ táº¡o voucher nhÆ°ng chÆ°a gá»­i email thÃ nh cÃ´ng. Vui lÃ²ng kiá»ƒm tra cáº¥u hÃ¬nh email.', 'error'));
        }

        res.redirect(buildAdminNoticeRedirect('/admin/vouchers', 'ÄÃ£ táº¡o voucher thÃ nh cÃ´ng.'));
    } catch (error) {
        console.error('Create voucher error:', error);
        res.redirect(buildAdminNoticeRedirect('/admin/vouchers', error.message || 'KhÃ´ng thá»ƒ táº¡o voucher.', 'error'));
    }
};

/**
 * Cáº­p nháº­t voucher
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
 * XÃ³a voucher
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
 * Cáº­p nháº­t tráº¡ng thÃ¡i voucher
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

exports.sendVoucherAnnouncementEmail = async (req, res) => {
    try {
        const { id } = req.params;
        const existingVoucher = await Voucher.findById(id);

        if (!existingVoucher) {
            return res.status(404).json({ success: false, message: 'Voucher khÃ´ng tá»“n táº¡i', toastType: 'error' });
        }

        const [voucher] = await attachVoucherAssignments([existingVoucher]);
        const result = await sendVoucherAnnouncement(voucher);

        if (result.total === 0) {
            return res.json({
                success: true,
                toastType: 'warning',
                message: 'Hiá»‡n chÆ°a cÃ³ ngÆ°á»i dÃ¹ng nÃ o Ä‘Äƒng kÃ½ nháº­n thÃ´ng bÃ¡o.'
            });
        }

        if (result.success === result.total) {
            return res.json({
                success: true,
                toastType: 'success',
                message: `ÄÃ£ gá»­i email thÃ´ng bÃ¡o voucher tá»›i ${result.success} ngÆ°á»i Ä‘Äƒng kÃ½.`
            });
        }

        if (result.success > 0) {
            return res.json({
                success: true,
                toastType: 'warning',
                message: `ÄÃ£ gá»­i email tá»›i ${result.success}/${result.total} ngÆ°á»i Ä‘Äƒng kÃ½.`
            });
        }

        return res.status(500).json({
            success: false,
            toastType: 'error',
            message: 'KhÃ´ng gá»­i Ä‘Æ°á»£c email thÃ´ng bÃ¡o. Vui lÃ²ng kiá»ƒm tra cáº¥u hÃ¬nh email.'
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message, toastType: 'error' });
    }
};

// =============================================================================
// BIáº¾N THá»‚ Sáº¢N PHáº¨M - PRODUCT VARIANTS
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
                message: 'KhÃ´ng thá»ƒ xÃ³a biáº¿n thá»ƒ Ä‘Ã£ Ä‘Æ°á»£c dÃ¹ng trong giá» hÃ ng hoáº·c Ä‘Æ¡n hÃ ng'
            });
        }

        await Product.deleteVariant(req.params.variantId);
        res.json({ success: true, message: 'ÄÃ£ xÃ³a biáº¿n thá»ƒ' });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// =============================================================================
// QUáº¢N LÃ BANNER - Banners Management
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
        res.status(500).render('error', { message: 'Lá»—i táº£i banners: ' + error.message, user: req.user });
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
            return res.status(404).json({ success: false, message: 'Banner khÃ´ng tá»“n táº¡i' });
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
            return res.status(400).json({ success: false, message: 'Dá»¯ liá»‡u khÃ´ng há»£p lá»‡' });
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
            return res.status(404).json({ success: false, message: 'Banner khÃ´ng tá»“n táº¡i' });
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

exports.updateOrderStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const trackingPayload = buildOrderTrackingPayload(req.body);

        if (!status) {
            return res.status(400).json({ message: 'Status is required' });
        }

        const order = await Order.updateStatus(id, status, trackingPayload, {
            actorUserId: req.user?.id || null
        });

        res.json({
            message: 'Order status updated successfully',
            order
        });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};


