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
const paymentService = require('../services/paymentService');
const emailService = require('../services/emailService');

const ALLOWED_PAYMENT_METHODS = new Set(['cod', 'vnpay', 'momo']);

function parseInteger(value) {
    const parsed = Number(value);
    return Number.isInteger(parsed) ? parsed : null;
}

function parsePositiveInteger(value) {
    const parsed = parseInteger(value);
    return parsed !== null && parsed > 0 ? parsed : null;
}

function parseOptionalPositiveInteger(value) {
    if (value === undefined || value === null || value === '') {
        return null;
    }

    return parsePositiveInteger(value);
}

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

function ensureAvailableStock(product, quantity, variant = null) {
    const availableStock = variant
        ? (parseInteger(variant.stock_quantity) || 0)
        : (parseInteger(product.stock_quantity) || 0);

    if (availableStock < quantity) {
        throw new Error('Số lượng vượt quá tồn kho hiện có');
    }
}

function calculateUnitPrice(product, variant = null) {
    let unitPrice = product.final_price || product.price;

    if (variant && variant.additional_price) {
        unitPrice += Number(variant.additional_price);
    }

    return unitPrice;
}

async function assertUserOwnsAddress(userId, addressId) {
    const address = await Address.findById(addressId);

    if (!address || Number(address.user_id) !== Number(userId)) {
        throw new Error('Địa chỉ giao hàng không hợp lệ');
    }

    return address;
}

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

async function getAvailableVouchersForItems(items) {
    const vouchers = await Voucher.findAll({ is_active: true });
    const assignments = await Voucher.getApplicableProductsMap(vouchers.map((voucher) => voucher.id));
    const normalizedVouchers = normalizeVoucherAssignments(vouchers, assignments);
    return filterEligibleVouchers(normalizedVouchers, items);
}

async function buildBuyNowVoucherItems(productId, quantity = 1, variantId = null) {
    const product = await Product.findById(parseInt(productId, 10), { incrementView: false });

    if (!product) {
        throw new Error('Không tìm thấy sản phẩm');
    }

    const quantityNumber = Math.max(1, parseInt(quantity, 10) || 1);
    const normalizedVariantId = variantId ? parseInt(variantId, 10) : null;
    const variant = getValidatedVariant(product, normalizedVariantId);
    ensureAvailableStock(product, quantityNumber, variant);
    const unitPrice = calculateUnitPrice(product, variant);

    return {
        items: [{
            product_id: product.id,
            quantity: quantityNumber,
            subtotal: unitPrice * quantityNumber
        }],
        orderAmount: unitPrice * quantityNumber
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
        const cartData = await Cart.calculateTotal(cart.id);

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

        // Validate dữ liệu bắt buộc
        if (!addressId || !payment_method) {
            return res.status(400).json({ message: 'Address and payment method are required' });
        }

        // Parse giá trị số
        if (!ALLOWED_PAYMENT_METHODS.has(payment_method)) {
            return res.status(400).json({ message: 'Payment method is invalid' });
        }

        await assertUserOwnsAddress(req.user.id, addressId);
        const cart = await Cart.getOrCreate(req.user.id);
        const cartData = await Cart.calculateTotal(cart.id);

        if (cartData.items.length === 0) {
            return res.status(400).json({ message: 'Cart is empty' });
        }

        let discountAmount = 0;
        let voucherId = null;

        if (voucher_code) {
            const voucherResult = await Voucher.validate(voucher_code, req.user.id, cartData.subtotal, cartData.items);

            if (!voucherResult.valid) {
                return res.status(400).json({ message: voucherResult.message });
            }

            discountAmount = voucherResult.discountAmount;
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
            voucherId
        );

        // Lấy thông tin đầy đủ của đơn hàng
        const order = await Order.findById(orderResult.id);

        // Gửi email xác nhận đơn hàng (async)
        emailService.sendOrderConfirmation(order).catch(err => console.error('Email error:', err));

        // Xử lý thanh toán theo phương thức
        if (payment_method === 'cod') {
            // COD (Thanh toán khi nhận hàng) - Redirect đến trang xác nhận
            return res.redirect(`/orders/${order.order_code}/confirmation`);
        } else if (payment_method === 'vnpay') {
            // VNPay - Tạo link thanh toán và redirect
            const payment = await paymentService.createVNPayPayment(order);
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
        res.render('checkout/confirmation', {
            order,
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
exports.getOrderHistory = async (req, res) => {
    try {
        // Kiểm tra đăng nhập
        if (!req.user) {
            return res.redirect('/auth/login');
        }

        // Lấy 20 đơn hàng gần nhất của user
        const orders = await Order.findByUser(req.user.id, 20, 0);

        // Render trang lịch sử
        res.render('user/orders', {
            orders,
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
exports.vnpayReturn = async (req, res) => {
    try {
        // Xác minh chữ ký và kết quả thanh toán
        const result = await paymentService.verifyVNPayPayment(req.query);

        if (result.success) {
            // Thanh toán thành công - cập nhật trạng thái
            const order = await Order.findByOrderCode(result.orderId);
            if (!order) {
                return res.status(404).render('error', { message: 'Order not found' });
            }

            if (Number(result.amount) !== Number(order.final_amount)) {
                return res.status(400).render('error', { message: 'Payment amount mismatch' });
            }

            await Order.updatePaymentStatus(order.id, 'paid');

            // Redirect đến trang xác nhận
            res.redirect(`/orders/${result.orderId}/confirmation`);
        } else {
            // Thanh toán thất bại
            res.render('checkout/payment-failed', {
                message: 'Payment failed. Please try again.',
                user: req.user || null
            });
        }
    } catch (error) {
        console.error('VNPay callback error:', error);
        res.status(500).render('error', { message: 'Payment verification failed' });
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
        const result = await paymentService.verifyMoMoPayment(req.body);

        if (result.success) {
            // Thanh toán thành công
            const order = await Order.findByOrderCode(result.orderId);
            if (!order) {
                return res.status(404).render('error', { message: 'Order not found' });
            }

            if (Number(result.amount) !== Number(order.final_amount)) {
                return res.status(400).render('error', { message: 'Payment amount mismatch' });
            }

            await Order.updatePaymentStatus(order.id, 'paid');

            res.redirect(`/orders/${result.orderId}/confirmation`);
        } else {
            // Thanh toán thất bại
            res.render('checkout/payment-failed', {
                message: 'Payment failed. Please try again.',
                user: req.user || null
            });
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

        const selectedVariant = getValidatedVariant(product, variantId);
        ensureAvailableStock(product, 1, selectedVariant);

        // Tính giá đã bao gồm variant additional_price
        const unitPrice = calculateUnitPrice(product, selectedVariant);

        // Tạo cấu trúc giỏ hàng giả cho trang checkout
        const buyNowItem = {
            product_id: product.id,
            product_name: product.name,
            product_slug: product.slug,
            product_image: product.images && product.images.length > 0 ? product.images[0].image_url : null,
            unit_price: unitPrice,
            quantity: 1,
            subtotal: unitPrice,
            size: selectedVariant ? selectedVariant.size : null,
            color: selectedVariant ? selectedVariant.color : null
        };

        const cart = {
            items: [buyNowItem],
            subtotal: buyNowItem.subtotal,
            itemCount: 1
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
            const voucherResult = await Voucher.validate(
                voucher_code,
                req.user.id,
                (product.final_price || product.price) * quantityNumber,
                [{
                    product_id: product.id,
                    quantity: quantityNumber,
                    subtotal: (product.final_price || product.price) * quantityNumber
                }]
            );

            if (!voucherResult.valid) {
                return res.status(400).json({ message: voucherResult.message });
            }

            discountAmount = voucherResult.discountAmount;
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
        const order = await Order.findById(orderResult.id);

        // Gửi email xác nhận
        emailService.sendOrderConfirmation(order).catch(err => console.error('Email error:', err));

        // Xử lý thanh toán theo phương thức
        if (payment_method === 'cod') {
            return res.redirect(`/orders/${order.order_code}/confirmation`);
        } else if (payment_method === 'vnpay') {
            const payment = await paymentService.createVNPayPayment(order);
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
        const { code, order_amount, mode, product_id, quantity, variant_id } = req.body;

        if (!code) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng nhập mã voucher'
            });
        }

        const userId = req.user ? req.user.id : null;
        let orderAmount = parseFloat(order_amount) || 0;
        let voucherItems = [];

        if (mode === 'buy-now' || product_id) {
            const buyNowContext = await buildBuyNowVoucherItems(product_id, quantity, variant_id);
            orderAmount = buyNowContext.orderAmount;
            voucherItems = buyNowContext.items;
        } else if (req.user) {
            const cart = await Cart.getOrCreate(req.user.id);
            const cartData = await Cart.calculateTotal(cart.id);
            orderAmount = cartData.subtotal;
            voucherItems = cartData.items;
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
            discount_amount: result.discountAmount
        });
    } catch (error) {
        console.error('Validate voucher error:', error);
        res.status(400).json({
            success: false,
            message: 'Có lỗi xảy ra khi kiểm tra voucher'
        });
    }
};
