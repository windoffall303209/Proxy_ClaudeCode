/**
 * =============================================================================
 * ORDER CONTROLLER - Điều khiển đơn hàng
 * =============================================================================
 * File này chứa các hàm xử lý logic liên quan đến đơn hàng:
 * - Hiển thị trang thanh toán (checkout)
 * - Tạo đơn hàng mới
 * - Xác nhận đơn hàng
 * - Lịch sử đơn hàng
 * - Xử lý callback thanh toán (VNPay, MoMo)
 * - Mua ngay (Buy Now)
 * =============================================================================
 */

const Order = require('../models/Order');
const Address = require('../models/Address');
const Cart = require('../models/Cart');
const Voucher = require('../models/Voucher');
const Product = require('../models/Product');
const Payment = require('../models/Payment');
const ReturnRequest = require('../models/ReturnRequest');
const paymentService = require('../services/paymentService');
const emailService = require('../services/emailService');
const {
    cleanupUploadedReturnMedia,
    MAX_RETURN_IMAGES,
    MAX_RETURN_VIDEOS
} = require('../middleware/returnUpload');

const ALLOWED_PAYMENT_METHODS = new Set(['cod', 'vnpay', 'momo']);
const ONLINE_PAYMENT_METHODS = new Set(['vnpay', 'momo']);
const DEFAULT_FREE_SHIPPING_MIN_AMOUNT = 500000;
const DEFAULT_SHIPPING_FEE = 30000;

// Chuyển giá trị đầu vào về số nguyên.
function parseInteger(value) {
    const parsed = Number(value);
    return Number.isInteger(parsed) ? parsed : null;
}

// Phân tích positive integer.
function parsePositiveInteger(value) {
    const parsed = parseInteger(value);
    return parsed !== null && parsed > 0 ? parsed : null;
}

// Phân tích optional positive integer.
function parseOptionalPositiveInteger(value) {
    if (value === undefined || value === null || value === '') {
        return null;
    }

    return parsePositiveInteger(value);
}

// Phân tích tiền value.
function parseMoneyValue(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

// Lay nguong freeship tu cau hinh storefront.
function getFreeShippingMinAmount(settings = {}) {
    const amount = Number.parseInt(settings.free_shipping_min_amount, 10);
    return Number.isInteger(amount) && amount >= 0 ? amount : DEFAULT_FREE_SHIPPING_MIN_AMOUNT;
}

function getShippingFeeAmount(settings = {}) {
    const amount = Number.parseInt(settings.shipping_fee_amount, 10);
    return Number.isInteger(amount) && amount >= 0 ? amount : DEFAULT_SHIPPING_FEE;
}

// Tinh shipping fee theo nguong freeship hien hanh.
function resolveShippingFee(subtotal, settings = {}) {
    if (typeof Order.calculateShippingFee === 'function') {
        return parseMoneyValue(Order.calculateShippingFee(
            subtotal,
            getFreeShippingMinAmount(settings),
            getShippingFeeAmount(settings)
        ));
    }

    return parseMoneyValue(subtotal) >= getFreeShippingMinAmount(settings) ? 0 : getShippingFeeAmount(settings);
}

function getEnabledPaymentMethods(settings = {}) {
    const methods = [];

    if (settings.payment_cod_enabled !== false) methods.push('cod');
    if (settings.payment_vnpay_enabled !== false) methods.push('vnpay');
    if (settings.payment_momo_enabled !== false) methods.push('momo');

    return methods;
}

function isPaymentMethodEnabled(method, settings = {}) {
    const normalizedMethod = String(method || '').toLowerCase();
    return ALLOWED_PAYMENT_METHODS.has(normalizedMethod)
        && getEnabledPaymentMethods(settings).includes(normalizedMethod);
}

// Lấy payable amount.
function getPayableAmount(subtotal, shippingFee = 0) {
    return Math.max(0, parseMoneyValue(subtotal) + parseMoneyValue(shippingFee));
}

// Xử lý clamp discount amount.
function clampDiscountAmount(discountAmount, subtotal, shippingFee = 0) {
    return Math.max(0, Math.min(parseMoneyValue(discountAmount), getPayableAmount(subtotal, shippingFee)));
}

// Phân tích giỏ hàng item ids.
function parseCartItemIds(rawValue) {
    if (rawValue === undefined || rawValue === null || rawValue === '') {
        return null;
    }

    const values = Array.isArray(rawValue) ? rawValue : String(rawValue).split(',');
    const uniqueIds = new Set();

    values.forEach((value) => {
        String(value)
            .split(',')
            .map((part) => parsePositiveInteger(String(part).trim()))
            .filter((id) => id !== null)
            .forEach((id) => uniqueIds.add(id));
    });

    return Array.from(uniqueIds);
}

// Tạo dữ liệu scoped giỏ hàng dữ liệu.
function buildScopedCartData(cartData, selectedCartItemIds = null) {
    const items = Array.isArray(cartData?.items) ? cartData.items : [];

    if (selectedCartItemIds === null) {
        return {
            ...cartData,
            items,
            subtotal: items.reduce((sum, item) => sum + parseMoneyValue(item.subtotal), 0),
            itemCount: items.reduce((sum, item) => sum + (parseInteger(item.quantity) || 0), 0)
        };
    }

    const selectedIdSet = new Set(selectedCartItemIds.map((id) => Number(id)));
    const scopedItems = items.filter((item) => selectedIdSet.has(Number(item.id)));

    return {
        ...cartData,
        items: scopedItems,
        subtotal: scopedItems.reduce((sum, item) => sum + parseMoneyValue(item.subtotal), 0),
        itemCount: scopedItems.reduce((sum, item) => sum + (parseInteger(item.quantity) || 0), 0)
    };
}

// Lấy validated biến thể.
function getValidatedVariant(product, variantId) {
    if (variantId === null || variantId === undefined) {
        return null;
    }

    const variant = Array.isArray(product.variants)
        ? product.variants.find((item) => item.id === variantId)
        : null;

    if (!variant) {
        throw new Error('Biến thể sản phẩm không hợp lệ');
    }

    return variant;
}

// Đảm bảo available stock.
function ensureAvailableStock(product, quantity, variant = null) {
    const availableStock = variant
        ? (parseInteger(variant.stock_quantity) || 0)
        : (parseInteger(product.stock_quantity) || 0);

    if (availableStock < quantity) {
        throw new Error('Số lượng vượt quá tồn kho hiện có');
    }
}

// Tính unit giá.
function calculateUnitPrice(product, variant = null) {
    const basePrice = product.final_price !== undefined && product.final_price !== null
        ? product.final_price
        : product.price;
    let unitPrice = parseMoneyValue(basePrice);

    if (variant) {
        unitPrice += parseMoneyValue(variant.additional_price);
    }

    return unitPrice;
}

// Xử lý assert người dùng owns địa chỉ.
async function assertUserOwnsAddress(userId, addressId) {
    const address = await Address.findById(addressId);

    if (!address || Number(address.user_id) !== Number(userId)) {
        throw new Error('Địa chỉ giao hàng không hợp lệ');
    }

    return address;
}

// Chuẩn hóa mã giảm giá assignments.
function normalizeVoucherAssignments(vouchers, assignments) {
    return vouchers.map((voucher) => {
        const applicableProducts = assignments.get(voucher.id) || [];
        return {
            ...voucher,
            applicable_products: applicableProducts,
            applicable_product_ids: applicableProducts.map((product) => product.id)
        };
    });
}

// Lọc eligible mã giảm giá.
function filterEligibleVouchers(vouchers, items) {
    const now = new Date();
    const productIds = new Set((items || []).map((item) => parseInt(item.product_id, 10)));

    return vouchers.filter((voucher) => {
        const startDate = new Date(voucher.start_date);
        const endDate = new Date(voucher.end_date);
        const isValidTime = now >= startDate && now <= endDate;
        const hasRemainingUsage = voucher.usage_limit === null || voucher.used_count < voucher.usage_limit;
        const isFreeship = voucher.code.toLowerCase().includes('freeship') ||
            voucher.code.toLowerCase().includes('ship') ||
            (voucher.name && voucher.name.toLowerCase().includes('freeship'));
        const hasApplicableProducts = !voucher.applicable_product_ids?.length ||
            voucher.applicable_product_ids.some((productId) => productIds.has(parseInt(productId, 10)));

        return voucher.is_active && isValidTime && hasRemainingUsage && !isFreeship && hasApplicableProducts;
    });
}

// Lấy available mã giảm giá cho items.
async function getAvailableVouchersForItems(items) {
    const vouchers = await Voucher.findAll({ is_active: true });
    const assignments = await Voucher.getApplicableProductsMap(vouchers.map((voucher) => voucher.id));
    const normalizedVouchers = normalizeVoucherAssignments(vouchers, assignments);
    return filterEligibleVouchers(normalizedVouchers, items);
}

// Tạo dữ liệu buy now mã giảm giá items.
async function buildBuyNowVoucherItems(productId, quantity = 1, variantId = null, settings = {}) {
    const product = await Product.findById(parseInt(productId, 10), { incrementView: false });

    if (!product) {
        throw new Error('Không tìm thấy sản phẩm');
    }

    const quantityNumber = Math.max(1, parseInt(quantity, 10) || 1);
    const normalizedVariantId = variantId ? parseInt(variantId, 10) : null;
    const variant = getValidatedVariant(product, normalizedVariantId);
    ensureAvailableStock(product, quantityNumber, variant);
    const unitPrice = calculateUnitPrice(product, variant);

    const subtotal = unitPrice * quantityNumber;
    const shippingFee = resolveShippingFee(subtotal, settings);

    return {
        items: [{
            product_id: product.id,
            quantity: quantityNumber,
            subtotal
        }],
        subtotal,
        shippingFee,
        orderAmount: getPayableAmount(subtotal, shippingFee)
    };
}

// Hiển thị thanh toán failure.
function renderPaymentFailure(res, req, message, status = 400) {
    return res.status(status).render('error', {
        message,
        user: req.user || null
    });
}

// Đồng bộ vn pay thanh toán kết quả.
async function syncVNPayPaymentResult(order, result, { allowOrderPaymentUpdate = true } = {}) {
    const paymentStatus = result.success ? 'success' : 'failed';
    let paymentMarkedPaid = false;

    await Payment.recordGatewayResult({
        orderId: order.id,
        paymentMethod: 'vnpay',
        transactionId: result.transactionId || null,
        amount: result.amount,
        status: paymentStatus,
        paymentData: {
            responseCode: result.responseCode,
            transactionStatus: result.transactionStatus,
            bankCode: result.bankCode,
            cardType: result.cardType,
            payDate: result.payDate,
            raw: result.raw
        }
    });

    if (allowOrderPaymentUpdate && result.success) {
        if (order.payment_status !== 'paid') {
            paymentMarkedPaid = await markOrderPaid(order);
        }
        await confirmPaidOnlineOrder(order);
    } else if (allowOrderPaymentUpdate && !result.success) {
        await markOnlineOrderPendingPayment(order);
    }

    return { paymentStatus, paymentMarkedPaid };
}

// Đồng bộ mo mo thanh toán kết quả.
async function syncMoMoPaymentResult(order, result, { allowOrderPaymentUpdate = true } = {}) {
    const paymentStatus = result.success ? 'success' : 'failed';
    let paymentMarkedPaid = false;

    await Payment.recordGatewayResult({
        orderId: order.id,
        paymentMethod: 'momo',
        transactionId: result.transactionId || null,
        amount: result.amount,
        status: paymentStatus,
        paymentData: {
            resultCode: result.resultCode,
            message: result.message,
            payType: result.payType,
            responseTime: result.responseTime,
            raw: result.raw
        }
    });

    if (allowOrderPaymentUpdate && result.success) {
        if (order.payment_status !== 'paid') {
            paymentMarkedPaid = await markOrderPaid(order);
        }
        await confirmPaidOnlineOrder(order);
    } else if (allowOrderPaymentUpdate && !result.success) {
        await markOnlineOrderPendingPayment(order);
    }

    return { paymentStatus, paymentMarkedPaid };
}

// Xử lý mark đơn hàng paid.
async function markOrderPaid(order) {
    const updateResult = await Order.updatePaymentStatus(order.id, 'paid');

    if (updateResult === undefined || updateResult === null) {
        return true;
    }

    return Number(updateResult.affectedRows || updateResult.changedRows || 0) > 0;
}

// Gửi đơn hàng confirmation async.
function sendOrderConfirmationAsync(order) {
    return emailService.sendOrderConfirmation(order).catch(err => console.error('Email error:', err));
}

// Gửi quản trị new đơn hàng async.
function sendAdminNewOrderAsync(order) {
    if (typeof emailService.sendAdminNewOrderEmail !== 'function') {
        return Promise.resolve(false);
    }

    return emailService
        .sendAdminNewOrderEmail(order)
        .catch(err => console.error('Admin new order email error:', err));
}

// Gửi đơn hàng confirmation after thanh toán.
async function sendOrderConfirmationAfterPayment(order) {
    const latestOrder = await Order.findById(order.id);
    return sendOrderConfirmationAsync(latestOrder || order);
}

// Lấy đơn hàng final amount.
function getOrderFinalAmount(order) {
    const amount = Number(order?.final_amount);
    return Number.isFinite(amount) ? amount : null;
}

// Kiểm tra zero payable đơn hàng.
function isZeroPayableOrder(order) {
    const finalAmount = getOrderFinalAmount(order);
    return finalAmount !== null && finalAmount <= 0;
}

// Kiểm tra online thanh toán đơn hàng.
function isOnlinePaymentOrder(order) {
    return ONLINE_PAYMENT_METHODS.has(String(order?.payment_method || '').toLowerCase());
}

// Xử lý confirm paid online đơn hàng.
async function confirmPaidOnlineOrder(order) {
    if (!order?.id || !isOnlinePaymentOrder(order)) {
        return order;
    }

    const currentStatus = Order.normalizeStatus ? Order.normalizeStatus(order.status) : String(order.status || '').toLowerCase();
    if (!['pending_payment', 'pending'].includes(currentStatus)) {
        return order;
    }

    if (typeof Order.updateStatus !== 'function') {
        return { ...order, status: 'confirmed' };
    }

    return Order.updateStatus(order.id, 'confirmed', {
        source: 'system',
        title: 'Thanh toán thành công',
        description: 'Cổng thanh toán đã xác nhận giao dịch, đơn hàng được chuyển sang chờ người bán chuẩn bị hàng.'
    }) || { ...order, status: 'confirmed' };
}

// Xử lý mark online đơn hàng pending thanh toán.
async function markOnlineOrderPendingPayment(order) {
    if (!order?.id || !isOnlinePaymentOrder(order) || order.payment_status === 'paid') {
        return order;
    }

    const currentStatus = Order.normalizeStatus ? Order.normalizeStatus(order.status) : String(order.status || '').toLowerCase();
    if (currentStatus === 'pending_payment') {
        return order;
    }

    if (typeof Order.updateStatus !== 'function') {
        return { ...order, status: 'pending_payment' };
    }

    return Order.updateStatus(order.id, 'pending_payment', {
        source: 'system',
        title: 'Thanh toán chưa hoàn tất',
        description: 'Khách hàng chưa hoàn tất hoặc đã hủy phiên thanh toán online.'
    }) || { ...order, status: 'pending_payment' };
}

// Xử lý confirm zero payable đơn hàng.
async function confirmZeroPayableOrder(order) {
    if (!isZeroPayableOrder(order)) {
        return order;
    }

    await Order.updatePaymentStatus(order.id, 'paid');

    if (typeof Order.updateStatus !== 'function') {
        return {
            ...order,
            status: 'confirmed',
            payment_status: 'paid'
        };
    }

    const confirmedOrder = await Order.updateStatus(order.id, 'confirmed', {
        source: 'system',
        title: 'Đơn hàng 0đ đã được xác nhận',
        description: 'Đơn hàng không cần thanh toán thêm nên hệ thống tự động xác nhận để người bán chuẩn bị hàng.'
    });

    return confirmedOrder || {
        ...order,
        status: 'confirmed',
        payment_status: 'paid'
    };
}

// =============================================================================
// CHECKOUT - THANH TOÁN
// =============================================================================

/**
 * Hiển thị trang thanh toán
 *
 * @description Lấy thông tin giỏ hàng và địa chỉ giao hàng
 *              để hiển thị trên trang checkout
 *
 * @param {Object} req - Request object từ Express
 * @param {Object} res - Response object từ Express
 *
 * @returns {Render|Redirect} Render trang checkout hoặc redirect nếu chưa đăng nhập
 */
exports.showCheckout = async (req, res) => {
    try {
        // Kiểm tra đăng nhập
        if (!req.user) {
            return res.redirect('/auth/login');
        }

        // Lấy giỏ hàng của user
        const cart = await Cart.getOrCreate(req.user.id);
        const selectedCartItemIds = parseCartItemIds(req.query.items);
        const cartData = buildScopedCartData(
            await Cart.calculateTotal(cart.id),
            selectedCartItemIds
        );

        // Redirect về giỏ hàng nếu trống
        if (cartData.items.length === 0) {
            return res.redirect('/cart');
        }

        // Lấy danh sách địa chỉ giao hàng của user
        const addresses = await Address.findByUser(req.user.id);

        const availableVouchers = await getAvailableVouchersForItems(cartData.items);

        // Render trang checkout
        res.render('checkout/index', {
            cart: cartData,
            addresses,
            vouchers: availableVouchers,
            selectedCartItemIds: cartData.items.map((item) => item.id),
            user: req.user
        });
    } catch (error) {
        console.error('Checkout error:', error);
        res.status(500).render('error', { message: 'Unable to load checkout' });
    }
};

/**
 * Tạo đơn hàng mới
 *
 * @description Tạo đơn hàng từ giỏ hàng, gửi email xác nhận,
 *              và xử lý thanh toán theo phương thức được chọn
 *
 * @param {Object} req - Request object từ Express
 * @param {Object} req.body - Thông tin đơn hàng
 * @param {number} req.body.address_id - ID địa chỉ giao hàng (bắt buộc)
 * @param {string} req.body.payment_method - Phương thức thanh toán (bắt buộc)
 *                                          'cod' | 'vnpay' | 'momo'
 * @param {string} [req.body.notes] - Ghi chú đơn hàng
 * @param {number} [req.body.shipping_fee] - Phí vận chuyển
 * @param {number} [req.body.discount_amount] - Số tiền giảm giá
 * @param {string} [req.body.voucher_code] - Mã voucher
 * @param {Object} res - Response object từ Express
 *
 * @returns {Redirect} Redirect đến trang xác nhận hoặc trang thanh toán
 */
exports.createOrder = async (req, res) => {
    try {
        // Kiểm tra đăng nhập
        if (!req.user) {
            return res.status(401).json({ message: 'Please login to place order' });
        }

        // Lấy thông tin đơn hàng từ request
        const { address_id, payment_method, notes, voucher_code } = req.body;
        const addressId = parsePositiveInteger(address_id);
        const selectedCartItemIds = parseCartItemIds(req.body.selected_cart_item_ids);

        // Validate dữ liệu bắt buộc
        if (!addressId || !payment_method) {
            return res.status(400).json({ message: 'Address and payment method are required' });
        }

        // Parse giá trị số
        if (!ALLOWED_PAYMENT_METHODS.has(payment_method)) {
            return res.status(400).json({ message: 'Payment method is invalid' });
        }

        if (!isPaymentMethodEnabled(payment_method, req.storefrontSettings)) {
            return res.status(400).json({ message: 'Phương thức thanh toán này đang tạm tắt' });
        }

        await assertUserOwnsAddress(req.user.id, addressId);
        const cart = await Cart.getOrCreate(req.user.id);
        const cartData = buildScopedCartData(
            await Cart.calculateTotal(cart.id),
            selectedCartItemIds
        );

        if (cartData.items.length === 0) {
            return res.status(400).json({ message: 'No selected cart items' });
        }

        let discountAmount = 0;
        let voucherId = null;

        if (voucher_code) {
            const shippingFee = resolveShippingFee(cartData.subtotal, req.storefrontSettings);
            const voucherResult = await Voucher.validate(
                voucher_code,
                req.user.id,
                getPayableAmount(cartData.subtotal, shippingFee),
                cartData.items
            );

            if (!voucherResult.valid) {
                return res.status(400).json({ message: voucherResult.message });
            }

            discountAmount = clampDiscountAmount(voucherResult.discountAmount, cartData.subtotal, shippingFee);
            voucherId = voucherResult.voucher.id;
        }

        // Tạo đơn hàng trong database
        const orderResult = await Order.create(
            req.user.id,
            addressId,
            payment_method,
            notes,
            null,
            discountAmount,
            voucher_code,
            voucherId,
            selectedCartItemIds
        );

        // Lấy thông tin đầy đủ của đơn hàng
        let order = await Order.findById(orderResult.id);
        order = await confirmZeroPayableOrder(order);
        sendAdminNewOrderAsync(order);

        // Gửi email xác nhận đơn hàng (async)

        // Xử lý thanh toán theo phương thức
        if (isZeroPayableOrder(order) || payment_method === 'cod') {
            sendOrderConfirmationAsync(order);

            // COD (Thanh toán khi nhận hàng) - Redirect đến trang xác nhận
            return res.redirect(`/orders/${order.order_code}/confirmation`);
        } else if (payment_method === 'vnpay') {
            // VNPay - Tạo link thanh toán và redirect
            const payment = await paymentService.createVNPayPayment(order, { ipAddr: req.ip });
            return res.redirect(payment.paymentUrl);
        } else if (payment_method === 'momo') {
            // MoMo - Hiển thị trang QR code
            const payment = await paymentService.createMoMoPayment(order);
            return res.render('checkout/momo-payment', {
                payment,
                order,
                user: req.user
            });
        }

        // Mặc định redirect đến trang xác nhận
        res.redirect(`/orders/${order.order_code}/confirmation`);
    } catch (error) {
        console.error('Create order error:', error);
        res.status(400).json({ message: error.message });
    }
};

/**
 * Trang xác nhận đơn hàng
 *
 * @description Hiển thị thông tin đơn hàng sau khi đặt thành công
 *
 * @param {Object} req - Request object từ Express
 * @param {Object} req.params.orderCode - Mã đơn hàng
 * @param {Object} res - Response object từ Express
 *
 * @returns {Render} Render trang xác nhận đơn hàng
 */
exports.orderConfirmation = async (req, res) => {
    try {
        if (!req.user) {
            return res.redirect('/auth/login');
        }

        const { orderCode } = req.params;

        // Tìm đơn hàng theo mã
        const order = await Order.findByOrderCode(orderCode);

        if (!order) {
            return res.status(404).render('error', { message: 'Order not found' });
        }

        // Kiểm tra quyền xem đơn hàng (phải là chủ đơn hàng)
        if (order.user_id !== req.user.id) {
            return res.status(403).render('error', { message: 'Access denied' });
        }

        // Render trang xác nhận
        const returnRequest = await ReturnRequest.findByOrderId(order.id);

        res.render('checkout/confirmation', {
            order,
            returnRequest,
            user: req.user
        });
    } catch (error) {
        console.error('Order confirmation error:', error);
        res.status(500).render('error', { message: 'Unable to load order confirmation' });
    }
};

// =============================================================================
// LỊCH SỬ ĐƠN HÀNG
// =============================================================================

/**
 * Lấy lịch sử đơn hàng của người dùng
 *
 * @description Hiển thị danh sách các đơn hàng đã đặt
 *
 * @param {Object} req - Request object từ Express
 * @param {Object} res - Response object từ Express
 *
 * @returns {Render|Redirect} Render trang lịch sử đơn hàng
 */
exports.showOrderTracking = async (req, res) => {
    try {
        if (!req.user) {
            return res.redirect('/auth/login');
        }

        const { orderCode } = req.params;
        const order = await Order.findByOrderCode(orderCode);

        if (!order) {
            return res.status(404).render('error', { message: 'Order not found' });
        }

        if (order.user_id !== req.user.id) {
            return res.status(403).render('error', { message: 'Access denied' });
        }

        const returnRequest = await ReturnRequest.findByOrderId(order.id);

        res.render('user/order-tracking', {
            order,
            returnRequest,
            returnFeedback: req.query.return || null,
            receivedFeedback: req.query.received || null,
            cancelFeedback: req.query.cancel || null,
            user: req.user
        });
    } catch (error) {
        console.error('Order tracking error:', error);
        res.status(500).render('error', { message: 'Unable to load order tracking' });
    }
};

// Lấy đơn hàng history.
exports.getOrderHistory = async (req, res) => {
    try {
        // Kiểm tra đăng nhập
        if (!req.user) {
            return res.redirect('/auth/login');
        }

        const orderGroups = [
            { key: 'all', label: 'Tất cả', href: '/orders/history' },
            { key: 'awaiting_confirmation', label: 'Chờ xác nhận', href: '/orders/history?group=awaiting_confirmation' },
            { key: 'awaiting_pickup', label: 'Chờ lấy hàng', href: '/orders/history?group=awaiting_pickup' },
            { key: 'awaiting_delivery', label: 'Chờ giao hàng', href: '/orders/history?group=awaiting_delivery' },
            { key: 'delivered', label: 'Đã giao', href: '/orders/history?group=delivered' },
            { key: 'completed', label: 'Đã hoàn thành', href: '/orders/history?group=completed' },
            { key: 'returns', label: 'Trả hàng', href: '/orders/history?group=returns' },
            { key: 'cancelled', label: 'Đã hủy', href: '/orders/history?group=cancelled' },
            { key: 'reviews', label: 'Đánh giá', href: '/orders/history?group=reviews' }
        ];
        const allowedGroups = new Set(orderGroups.map((group) => group.key));
        const requestedGroup = typeof req.query.group === 'string' ? req.query.group.trim() : 'all';
        const activeGroup = allowedGroups.has(requestedGroup) ? requestedGroup : 'all';

        const orders = await Order.findByUser(req.user.id, 100, 0);
        await Promise.all(orders.map(async (order) => {
            const returnRequest = await ReturnRequest.findByOrderId(order.id);
            order.return_request_status = returnRequest?.status || null;
        }));
        const reviews = await Order.findReviews({
            user_id: req.user.id,
            limit: 100,
            offset: 0
        });

        const hasStatus = (order, statuses) => statuses.includes(String(order.status || '').toLowerCase());
        const orderGroupCounts = {
            all: orders.length,
            awaiting_confirmation: orders.filter((order) => hasStatus(order, ['pending_payment', 'pending'])).length,
            awaiting_pickup: orders.filter((order) => hasStatus(order, ['confirmed', 'processing'])).length,
            awaiting_delivery: orders.filter((order) => hasStatus(order, ['shipping'])).length,
            delivered: orders.filter((order) => hasStatus(order, ['delivered'])).length,
            completed: orders.filter((order) => hasStatus(order, ['completed'])).length,
            returns: orders.filter((order) => Boolean(order.return_request_status)).length,
            cancelled: orders.filter((order) => hasStatus(order, ['cancelled'])).length,
            reviews: reviews.length
        };

        const filteredOrders = (() => {
            if (activeGroup === 'awaiting_confirmation') {
                return orders.filter((order) => hasStatus(order, ['pending_payment', 'pending']));
            }
            if (activeGroup === 'awaiting_pickup') {
                return orders.filter((order) => hasStatus(order, ['confirmed', 'processing']));
            }
            if (activeGroup === 'awaiting_delivery') {
                return orders.filter((order) => hasStatus(order, ['shipping']));
            }
            if (activeGroup === 'delivered') {
                return orders.filter((order) => hasStatus(order, ['delivered']));
            }
            if (activeGroup === 'completed') {
                return orders.filter((order) => hasStatus(order, ['completed']));
            }
            if (activeGroup === 'returns') {
                return orders.filter((order) => Boolean(order.return_request_status));
            }
            if (activeGroup === 'cancelled') {
                return orders.filter((order) => hasStatus(order, ['cancelled']));
            }
            return orders;
        })();

        // Render trang lịch sử
        res.render('user/orders', {
            orders: activeGroup === 'reviews' ? [] : filteredOrders,
            reviews,
            activeGroup,
            orderGroups,
            orderGroupCounts,
            cancelFeedback: req.query.cancel || null,
            user: req.user
        });
    } catch (error) {
        console.error('Order history error:', error);
        res.status(500).render('error', { message: 'Unable to load order history' });
    }
};

// =============================================================================
// CALLBACK THANH TOÁN - PAYMENT CALLBACKS
// =============================================================================

/**
 * Xử lý callback từ VNPay
 *
 * @description Xác minh kết quả thanh toán từ VNPay
 *              và cập nhật trạng thái đơn hàng
 *
 * @param {Object} req - Request object từ Express
 * @param {Object} req.query - Tham số callback từ VNPay
 * @param {Object} res - Response object từ Express
 *
 * @returns {Redirect|Render} Redirect đến trang xác nhận hoặc trang lỗi
 */
exports.retryPayment = async (req, res) => {
    try {
        if (!req.user) {
            return res.redirect('/auth/login');
        }

        const order = await Order.findByOrderCode(req.params.orderCode);
        if (!order) {
            return res.status(404).render('error', { message: 'Order not found' });
        }

        if (order.user_id !== req.user.id) {
            return res.status(403).render('error', { message: 'Access denied' });
        }

        if (!isOnlinePaymentOrder(order)) {
            return res.redirect(`/orders/${order.order_code}/confirmation`);
        }

        if (order.payment_status === 'paid' || !['pending_payment', 'pending'].includes(String(order.status || '').toLowerCase())) {
            return res.redirect(`/orders/${order.order_code}/confirmation`);
        }

        if (isZeroPayableOrder(order)) {
            await confirmZeroPayableOrder(order);
            return res.redirect(`/orders/${order.order_code}/confirmation`);
        }

        if (order.payment_method === 'vnpay') {
            const payment = await paymentService.createVNPayPayment(order, { ipAddr: req.ip });
            return res.redirect(payment.paymentUrl);
        }

        if (order.payment_method === 'momo') {
            const payment = await paymentService.createMoMoPayment(order);
            return res.render('checkout/momo-payment', {
                payment,
                order,
                user: req.user
            });
        }

        return res.redirect(`/orders/${order.order_code}/confirmation`);
    } catch (error) {
        console.error('Retry payment error:', error);
        return res.status(400).render('error', { message: error.message || 'Unable to retry payment' });
    }
};

// Xử lý cancel đơn hàng.
exports.cancelOrder = async (req, res) => {
    try {
        if (!req.user) {
            return res.redirect('/auth/login');
        }

        const order = await Order.findByOrderCode(req.params.orderCode);
        if (!order) {
            return res.status(404).render('error', { message: 'Order not found' });
        }

        if (order.user_id !== req.user.id) {
            return res.status(403).render('error', { message: 'Access denied' });
        }

        if (!['pending', 'confirmed'].includes(String(order.status || '').toLowerCase())) {
            return res.redirect(`/orders/${order.order_code}/tracking?cancel=invalid-status`);
        }

        await Order.cancelByUser(order.id, req.user.id);
        return res.redirect(`/orders/${order.order_code}/tracking?cancel=success`);
    } catch (error) {
        console.error('Cancel order error:', error);
        return res.status(400).render('error', { message: error.message || 'Unable to cancel order' });
    }
};

// Xử lý show hoàn hàng yêu cầu.
exports.showReturnRequest = async (req, res) => {
    try {
        if (!req.user) {
            return res.redirect(`/auth/login?redirect=/orders/${encodeURIComponent(req.params.orderCode)}/return-request`);
        }

        const order = await Order.findByOrderCode(req.params.orderCode);
        if (!order) {
            return res.status(404).render('error', { message: 'Order not found' });
        }

        if (order.user_id !== req.user.id) {
            return res.status(403).render('error', { message: 'Access denied' });
        }

        if (String(order.status || '').toLowerCase() !== 'delivered') {
            return res.redirect(`/orders/${order.order_code}/tracking?return=invalid-status`);
        }

        const returnRequest = await ReturnRequest.findByOrderId(order.id);

        return res.render('user/return-request', {
            order,
            returnRequest,
            returnFeedback: req.query.return || null,
            returnMediaLimits: {
                images: MAX_RETURN_IMAGES,
                videos: MAX_RETURN_VIDEOS
            },
            user: req.user
        });
    } catch (error) {
        console.error('Return request page error:', error);
        return res.status(500).render('error', { message: 'Unable to load return request page' });
    }
};

// Xử lý confirm received.
exports.confirmReceived = async (req, res) => {
    try {
        if (!req.user) {
            return res.redirect('/auth/login');
        }

        const order = await Order.findByOrderCode(req.params.orderCode);
        if (!order) {
            return res.status(404).render('error', { message: 'Order not found' });
        }

        if (order.user_id !== req.user.id) {
            return res.status(403).render('error', { message: 'Access denied' });
        }

        if (String(order.status || '').toLowerCase() !== 'delivered') {
            return res.redirect(`/orders/${order.order_code}/tracking?received=invalid-status`);
        }

        const returnRequest = await ReturnRequest.findByOrderId(order.id);
        if (returnRequest && ['pending', 'approved'].includes(ReturnRequest.normalizeStatus(returnRequest.status))) {
            return res.redirect(`/orders/${order.order_code}/tracking?received=return-pending`);
        }

        await Order.updateStatus(order.id, 'completed', {
            source: 'user',
            title: 'Người mua xác nhận đã nhận hàng',
            description: 'Người mua đã xác nhận nhận hàng và hoàn tất đơn hàng.'
        }, { actorUserId: req.user.id });

        return res.redirect(`/orders/${order.order_code}/tracking?received=confirmed`);
    } catch (error) {
        console.error('Confirm received error:', error);
        return res.status(400).render('error', { message: error.message || 'Unable to confirm received order' });
    }
};

// Xử lý pre validate hoàn hàng yêu cầu.
exports.preValidateReturnRequest = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.redirect(`/auth/login?redirect=/orders/${encodeURIComponent(req.params.orderCode)}/return-request`);
        }

        const order = await Order.findByOrderCode(req.params.orderCode);
        if (!order) {
            return res.status(404).render('error', { message: 'Order not found' });
        }

        if (order.user_id !== req.user.id) {
            return res.status(403).render('error', { message: 'Access denied' });
        }

        if (String(order.status || '').toLowerCase() !== 'delivered') {
            return res.redirect(`/orders/${order.order_code}/tracking?return=invalid-status`);
        }

        const existingRequest = await ReturnRequest.findByOrderId(order.id);
        if (existingRequest) {
            return res.redirect(`/orders/${order.order_code}/return-request?return=already-requested`);
        }

        req.returnRequestOrder = order;
        return next();
    } catch (error) {
        console.error('Return request pre-validation error:', error);
        return res.status(400).render('error', { message: error.message || 'Unable to validate return request' });
    }
};

// Tạo hoàn hàng yêu cầu.
exports.createReturnRequest = async (req, res) => {
    const uploadedMedia = Array.isArray(req.uploadedReturnMedia) ? req.uploadedReturnMedia : [];

    try {
        if (!req.user) {
            await cleanupUploadedReturnMedia(uploadedMedia);
            return res.redirect(`/auth/login?redirect=/orders/${encodeURIComponent(req.params.orderCode)}/return-request`);
        }

        const order = req.returnRequestOrder || await Order.findByOrderCode(req.params.orderCode);
        if (!order) {
            await cleanupUploadedReturnMedia(uploadedMedia);
            return res.status(404).render('error', { message: 'Order not found' });
        }

        if (order.user_id !== req.user.id) {
            await cleanupUploadedReturnMedia(uploadedMedia);
            return res.status(403).render('error', { message: 'Access denied' });
        }

        if (String(order.status || '').toLowerCase() !== 'delivered') {
            await cleanupUploadedReturnMedia(uploadedMedia);
            return res.redirect(`/orders/${order.order_code}/tracking?return=invalid-status`);
        }

        const reason = String(req.body.reason || '').trim();
        if (reason.length < 10) {
            await cleanupUploadedReturnMedia(uploadedMedia);
            return res.redirect(`/orders/${order.order_code}/return-request?return=missing-reason`);
        }

        if (uploadedMedia.length === 0) {
            return res.redirect(`/orders/${order.order_code}/return-request?return=missing-media`);
        }

        if (!req.returnRequestOrder) {
            const existingRequest = await ReturnRequest.findByOrderId(order.id);
            if (existingRequest) {
                await cleanupUploadedReturnMedia(uploadedMedia);
                return res.redirect(`/orders/${order.order_code}/return-request?return=already-requested`);
            }
        }

        const returnRequest = await ReturnRequest.create({
            orderId: order.id,
            userId: req.user.id,
            reason,
            media: uploadedMedia
        });

        if (typeof emailService.sendAdminReturnRequestEmail === 'function') {
            emailService
                .sendAdminReturnRequestEmail(returnRequest, order)
                .catch((emailError) => console.error('Admin return request email error:', emailError));
        }

        return res.redirect(`/orders/${order.order_code}/return-request?return=requested`);
    } catch (error) {
        console.error('Create return request error:', error);
        await cleanupUploadedReturnMedia(uploadedMedia);
        return res.status(400).render('error', { message: error.message || 'Unable to create return request' });
    }
};

// Xử lý vnpay hoàn hàng.
exports.vnpayReturn = async (req, res) => {
    try {
        // Xac minh chu ky va ket qua thanh toan
        const result = await paymentService.verifyVNPayPayment(req.query);
        if (!result.isValidSignature) {
            return renderPaymentFailure(res, req, 'Chữ ký trả về từ VNPay không hợp lệ');
        }
        const order = await Order.findByOrderCode(result.orderId);
        if (!order) {
            return renderPaymentFailure(res, req, 'Không tìm thấy đơn hàng thanh toán', 404);
        }
        if (Number(result.amount) !== Number(order.final_amount)) {
            return renderPaymentFailure(res, req, 'Số tiền VNPay trả về không khớp với đơn hàng');
        }
        // Return URL la duong hien thi cho khach, nhung van sync fallback o day
        // de ho tro test sandbox khi IPN chua di xuyen mang.
        const syncResult = await syncVNPayPaymentResult(order, result);
        if (result.success) {
            if (syncResult.paymentMarkedPaid) {
                await sendOrderConfirmationAfterPayment(order);
            }
            return res.redirect(`/orders/${result.orderId}/confirmation`);
        }
        return res.redirect(`/orders/${result.orderId}/confirmation?payment=failed`);
    } catch (error) {
        console.error('VNPay callback error:', error);
        res.status(500).render('error', { message: 'Payment verification failed' });
    }
};
// Xử lý vnpay ipn.
exports.vnpayIpn = async (req, res) => {
    try {
        const result = await paymentService.verifyVNPayPayment(req.query);
        if (!result.isValidSignature) {
            return res.status(200).json({ RspCode: '97', Message: 'Invalid Checksum' });
        }
        const order = await Order.findByOrderCode(result.orderId);
        if (!order) {
            return res.status(200).json({ RspCode: '01', Message: 'Order not Found' });
        }
        if (Number(result.amount) !== Number(order.final_amount)) {
            return res.status(200).json({ RspCode: '04', Message: 'Invalid Amount' });
        }
        if (order.payment_status === 'paid') {
            await confirmPaidOnlineOrder(order);
            return res.status(200).json({ RspCode: '02', Message: 'Order already confirmed' });
        }
        const syncResult = await syncVNPayPaymentResult(order, result);
        if (result.success && syncResult.paymentMarkedPaid) {
            await sendOrderConfirmationAfterPayment(order);
        }
        return res.status(200).json({ RspCode: '00', Message: 'Confirm Success' });
    } catch (error) {
        console.error('VNPay IPN error:', error);
        return res.status(200).json({ RspCode: '99', Message: 'Unknown error' });
    }
};
/**
 * Xử lý callback từ MoMo
 *
 * @description Xác minh kết quả thanh toán từ MoMo
 *              và cập nhật trạng thái đơn hàng
 *
 * @param {Object} req - Request object từ Express
 * @param {Object} req.body - Dữ liệu callback từ MoMo
 * @param {Object} res - Response object từ Express
 *
 * @returns {Redirect|Render} Redirect đến trang xác nhận hoặc trang lỗi
 */
exports.momoReturn = async (req, res) => {
    try {
        // Xác minh kết quả thanh toán
        const momoPayload = Object.keys(req.body || {}).length > 0 ? req.body : req.query;
        const result = await paymentService.verifyMoMoPayment(momoPayload);

        if (!result.isValidSignature) {
            return renderPaymentFailure(res, req, 'Chữ ký trả về từ MoMo không hợp lệ');
        }

        if (!result.success) {
            const order = await Order.findByOrderCode(result.orderId);
            if (order && Number(result.amount) === Number(order.final_amount)) {
                await syncMoMoPaymentResult(order, result);
                return res.redirect(`/orders/${result.orderId}/confirmation?payment=failed`);
            }

            return renderPaymentFailure(res, req, 'Thanh toán MoMo không thành công. Vui lòng thử lại.');
        }

        if (result.success) {
            // Thanh toán thành công
            const order = await Order.findByOrderCode(result.orderId);
            if (!order) {
                return res.status(404).render('error', { message: 'Order not found' });
            }

            if (Number(result.amount) !== Number(order.final_amount)) {
                return res.status(400).render('error', { message: 'Payment amount mismatch' });
            }

            const syncResult = await syncMoMoPaymentResult(order, result);
            if (syncResult.paymentMarkedPaid) {
                await sendOrderConfirmationAfterPayment(order);
            }

            return res.redirect(`/orders/${result.orderId}/confirmation`);
        } else {
            // Thanh toán thất bại
            return renderPaymentFailure(res, req, 'Thanh toán MoMo không thành công. Vui lòng thử lại.');
        }
    } catch (error) {
        console.error('MoMo callback error:', error);
        res.status(500).render('error', { message: 'Payment verification failed' });
    }
};

// =============================================================================
// MUA NGAY - BUY NOW
// =============================================================================

/**
 * Hiển thị trang mua ngay (checkout cho 1 sản phẩm)
 *
 * @description Cho phép mua trực tiếp 1 sản phẩm mà không cần thêm vào giỏ hàng
 *
 * @param {Object} req - Request object từ Express
 * @param {Object} req.params.productId - ID sản phẩm cần mua
 * @param {Object} res - Response object từ Express
 *
 * @returns {Render|Redirect} Render trang mua ngay hoặc redirect nếu chưa đăng nhập
 */
exports.showBuyNow = async (req, res) => {
    try {
        // Kiểm tra đăng nhập, lưu redirect URL để quay lại sau khi login
        if (!req.user) {
            return res.redirect('/auth/login?redirect=/orders/buy-now/' + req.params.productId);
        }

        const { productId } = req.params;
        const normalizedProductId = parsePositiveInteger(productId);

        if (!normalizedProductId) {
            return res.status(400).render('error', {
                message: 'ID sản phẩm không hợp lệ',
                user: req.user
            });
        }

        // Lấy thông tin sản phẩm
        const product = await Product.findById(normalizedProductId, { incrementView: false });

        if (!product) {
            return res.status(404).render('error', {
                message: 'Không tìm thấy sản phẩm',
                user: req.user
            });
        }

        // Lấy địa chỉ giao hàng của user
        const addresses = await Address.findByUser(req.user.id);

        // Xử lý variant nếu có
        const variantId = parseOptionalPositiveInteger(req.query.variant_id);
        if (req.query.variant_id && variantId === null) {
            return res.status(400).render('error', {
                message: 'Biến thể sản phẩm không hợp lệ',
                user: req.user
            });
        }

        const quantity = parsePositiveInteger(req.query.quantity) || 1;

        const selectedVariant = getValidatedVariant(product, variantId);
        ensureAvailableStock(product, quantity, selectedVariant);

        // Tính giá đã bao gồm variant additional_price
        const unitPrice = calculateUnitPrice(product, selectedVariant);

        // Tạo cấu trúc giỏ hàng giả cho trang checkout
        const buyNowItem = {
            product_id: product.id,
            product_name: product.name,
            product_slug: product.slug,
            product_image: product.images && product.images.length > 0 ? product.images[0].image_url : null,
            unit_price: unitPrice,
            quantity: quantity,
            subtotal: unitPrice * quantity,
            size: selectedVariant ? selectedVariant.size : null,
            color: selectedVariant ? selectedVariant.color : null
        };

        const cart = {
            items: [buyNowItem],
            subtotal: buyNowItem.subtotal,
            itemCount: quantity
        };

        const vouchers = await getAvailableVouchersForItems(cart.items);

        // Render trang mua ngay
        res.render('checkout/buy-now', {
            cart,
            product,
            addresses,
            vouchers,
            user: req.user,
            isBuyNow: true,
            selectedVariant,
            variantId
        });
    } catch (error) {
        console.error('Buy now error:', error);
        res.status(500).render('error', {
            message: 'Không thể tải trang mua hàng: ' + error.message,
            user: req.user
        });
    }
};

/**
 * Tạo đơn hàng mua ngay (1 sản phẩm)
 *
 * @description Tạo đơn hàng trực tiếp từ 1 sản phẩm mà không qua giỏ hàng
 *
 * @param {Object} req - Request object từ Express
 * @param {Object} req.body - Thông tin đơn hàng
 * @param {number} req.body.product_id - ID sản phẩm (bắt buộc)
 * @param {number} [req.body.quantity=1] - Số lượng mua
 * @param {number} req.body.address_id - ID địa chỉ giao hàng (bắt buộc)
 * @param {string} req.body.payment_method - Phương thức thanh toán (bắt buộc)
 * @param {string} [req.body.notes] - Ghi chú đơn hàng
 * @param {Object} res - Response object từ Express
 *
 * @returns {Redirect|JSON} Redirect đến trang thanh toán hoặc trả về JSON lỗi
 */
exports.createBuyNowOrder = async (req, res) => {
    try {
        // Kiểm tra đăng nhập
        if (!req.user) {
            return res.status(401).json({ message: 'Vui lòng đăng nhập' });
        }

        const { product_id, quantity, address_id, payment_method, notes, variant_id, voucher_code } = req.body;
        const productId = parsePositiveInteger(product_id);
        const quantityNumber = parsePositiveInteger(quantity || 1);
        const addressId = parsePositiveInteger(address_id);
        const variantId = parseOptionalPositiveInteger(variant_id);

        // Validate dữ liệu bắt buộc
        if (!productId || !addressId || !payment_method || !quantityNumber) {
            return res.status(400).json({ message: 'Thiếu thông tin bắt buộc' });
        }

        // Lấy thông tin sản phẩm
        if (!ALLOWED_PAYMENT_METHODS.has(payment_method)) {
            return res.status(400).json({ message: 'Phương thức thanh toán không hợp lệ' });
        }

        if (!isPaymentMethodEnabled(payment_method, req.storefrontSettings)) {
            return res.status(400).json({ message: 'Phương thức thanh toán này đang tạm tắt' });
        }

        if (variant_id !== undefined && variant_id !== null && variant_id !== '' && variantId === null) {
            return res.status(400).json({ message: 'Biến thể sản phẩm không hợp lệ' });
        }

        await assertUserOwnsAddress(req.user.id, addressId);
        const product = await Product.findById(productId, { incrementView: false });

        if (!product) {
            return res.status(404).json({ message: 'Không tìm thấy sản phẩm' });
        }

        // Xử lý variant: điều chỉnh giá nếu có variant
        const variant = getValidatedVariant(product, variantId);
        ensureAvailableStock(product, quantityNumber, variant);
        if (variant) {
            product.final_price = calculateUnitPrice(product, variant);
        }

        let discountAmount = 0;
        let voucherId = null;

        if (voucher_code) {
            const subtotal = (product.final_price || product.price) * quantityNumber;
            const shippingFee = resolveShippingFee(subtotal, req.storefrontSettings);
            const voucherResult = await Voucher.validate(
                voucher_code,
                req.user.id,
                getPayableAmount(subtotal, shippingFee),
                [{
                    product_id: product.id,
                    quantity: quantityNumber,
                    subtotal
                }]
            );

            if (!voucherResult.valid) {
                return res.status(400).json({ message: voucherResult.message });
            }

            discountAmount = clampDiscountAmount(voucherResult.discountAmount, subtotal, shippingFee);
            voucherId = voucherResult.voucher.id;
        }

        // Tạo đơn hàng trực tiếp từ sản phẩm (không qua giỏ hàng)
        const orderResult = await Order.createFromProduct(
            req.user.id,
            addressId,
            product,
            quantityNumber,
            payment_method,
            notes,
            variantId,
            discountAmount,
            voucherId
        );

        // Lấy thông tin đầy đủ đơn hàng
        let order = await Order.findById(orderResult.id);
        order = await confirmZeroPayableOrder(order);
        sendAdminNewOrderAsync(order);

        // Gửi email xác nhận

        // Xử lý thanh toán theo phương thức
        if (isZeroPayableOrder(order) || payment_method === 'cod') {
            sendOrderConfirmationAsync(order);

            return res.redirect(`/orders/${order.order_code}/confirmation`);
        } else if (payment_method === 'vnpay') {
            const payment = await paymentService.createVNPayPayment(order, { ipAddr: req.ip });
            return res.redirect(payment.paymentUrl);
        } else if (payment_method === 'momo') {
            const payment = await paymentService.createMoMoPayment(order);
            return res.render('checkout/momo-payment', {
                payment,
                order,
                user: req.user
            });
        }

        res.redirect(`/orders/${order.order_code}/confirmation`);
    } catch (error) {
        console.error('Create buy now order error:', error);
        res.status(400).json({ message: error.message });
    }
};

// =============================================================================
// VOUCHER - MÃ GIẢM GIÁ
// =============================================================================

/**
 * Kiểm tra và áp dụng voucher
 *
 * @description Validate mã voucher và trả về số tiền giảm giá
 *
 * @param {Object} req - Request object từ Express
 * @param {Object} req.body.code - Mã voucher
 * @param {Object} req.body.order_amount - Tổng tiền đơn hàng
 * @param {Object} res - Response object từ Express
 *
 * @returns {JSON} Trả về thông tin voucher và số tiền giảm
 */
exports.validateVoucher = async (req, res) => {
    try {
        const { code, order_amount, mode, product_id, quantity, variant_id, selected_cart_item_ids } = req.body;

        if (!code) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng nhập mã voucher'
            });
        }

        const userId = req.user ? req.user.id : null;
        let orderAmount = parseFloat(order_amount) || 0;
        let voucherItems = [];
        let subtotalAmount = parseFloat(order_amount) || 0;
        let shippingFee = 0;

        if (mode === 'buy-now' || product_id) {
            const buyNowContext = await buildBuyNowVoucherItems(product_id, quantity, variant_id, req.storefrontSettings);
            orderAmount = buyNowContext.orderAmount;
            voucherItems = buyNowContext.items;
            subtotalAmount = buyNowContext.subtotal;
            shippingFee = buyNowContext.shippingFee;
        } else if (req.user) {
            const cart = await Cart.getOrCreate(req.user.id);
            const selectedCartItemIds = parseCartItemIds(selected_cart_item_ids);
            const cartData = buildScopedCartData(
                await Cart.calculateTotal(cart.id),
                selectedCartItemIds
            );
            subtotalAmount = cartData.subtotal;
            shippingFee = resolveShippingFee(cartData.subtotal, req.storefrontSettings);
            orderAmount = getPayableAmount(cartData.subtotal, shippingFee);
            voucherItems = cartData.items;
        }

        if (!voucherItems.length) {
            return res.status(400).json({
                success: false,
                message: 'Không có sản phẩm được chọn để áp dụng voucher'
            });
        }

        // Validate voucher
        const result = await Voucher.validate(code, userId, orderAmount, voucherItems);

        if (!result.valid) {
            return res.status(400).json({
                success: false,
                message: result.message
            });
        }

        // Trả về thông tin voucher hợp lệ
        res.json({
            success: true,
            message: 'Áp dụng mã giảm giá thành công',
            voucher: {
                code: result.voucher.code,
                name: result.voucher.name,
                type: result.voucher.type,
                value: result.voucher.value
            },
            discount_amount: clampDiscountAmount(result.discountAmount, subtotalAmount, shippingFee)
        });
    } catch (error) {
        console.error('Validate voucher error:', error);
        res.status(400).json({
            success: false,
            message: 'Có lỗi xảy ra khi kiểm tra voucher'
        });
    }
};
