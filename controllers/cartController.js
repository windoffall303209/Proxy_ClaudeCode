/**
 * =============================================================================
 * CART CONTROLLER - Điều khiển giỏ hàng
 * =============================================================================
 * File này chứa các hàm xử lý logic liên quan đến giỏ hàng:
 * - Xem giỏ hàng
 * - Thêm sản phẩm vào giỏ
 * - Cập nhật số lượng sản phẩm
 * - Xóa sản phẩm khỏi giỏ
 * - Lấy số lượng sản phẩm trong giỏ
 * =============================================================================
 */

const Cart = require('../models/Cart');
const Product = require('../models/Product');

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

// Xác định post đăng nhập điều hướng.
function resolvePostLoginRedirect(req) {
    const requestedRedirect = typeof req.body?.redirect === 'string' ? req.body.redirect.trim() : '';
    if (requestedRedirect.startsWith('/') && !requestedRedirect.startsWith('//')) {
        return requestedRedirect;
    }

    const referer = typeof req.get === 'function' ? req.get('Referer') : '';
    if (referer) {
        try {
            const url = new URL(referer, 'http://local');
            if (url.pathname.startsWith('/') && !url.pathname.startsWith('/auth/login')) {
                return `${url.pathname}${url.search}`;
            }
        } catch (error) {
            // Referer lỗi định dạng thì quay về danh sách sản phẩm mặc định.
        }
    }

    return '/products';
}

// Lấy giỏ hàng context.
async function getCartContext(req) {
    const userId = req.user ? req.user.id : null;
    const sessionId = req.sessionID || null;

    if (!userId && !sessionId) {
        throw new Error('No session available');
    }

    const cart = await Cart.getOrCreate(userId, sessionId);
    return { cart, userId, sessionId };
}

// Kiểm tra hợp lệ sản phẩm selection.
async function validateProductSelection(productId, quantity, variantId = null) {
    const product = await Product.findById(productId, { incrementView: false });

    if (!product) {
        return {
            valid: false,
            status: 404,
            message: 'Không tìm thấy sản phẩm'
        };
    }

    let availableStock = parseInteger(product.stock_quantity) || 0;

    if (variantId !== null) {
        const variant = Array.isArray(product.variants)
            ? product.variants.find((item) => item.id === variantId)
            : null;

        if (!variant) {
            return {
                valid: false,
                status: 400,
                message: 'Biến thể sản phẩm không hợp lệ'
            };
        }

        availableStock = parseInteger(variant.stock_quantity) || 0;
    }

    if (availableStock < quantity) {
        return {
            valid: false,
            status: 400,
            message: 'Số lượng vượt quá tồn kho hiện có'
        };
    }

    return { valid: true, product };
}

// Xác định add vào giỏ hàng biến thể.
async function resolveAddToCartVariant(productId, variantId = null) {
    const product = await Product.findById(productId, { incrementView: false });

    if (!product) {
        return {
            valid: false,
            status: 404,
            message: 'Không tìm thấy sản phẩm'
        };
    }

    const variants = Array.isArray(product.variants) ? product.variants : [];

    if (variantId === null && variants.length === 1) {
        return {
            valid: true,
            product,
            variantId: parsePositiveInteger(variants[0].id)
        };
    }

    if (variantId === null && variants.length > 1) {
        return {
            valid: false,
            status: 400,
            requiresVariant: true,
            message: 'Vui lòng chọn phân loại sản phẩm trước khi thêm vào giỏ hàng.',
            productUrl: product.slug ? `/products/${product.slug}` : `/products/${product.id}`
        };
    }

    return {
        valid: true,
        product,
        variantId
    };
}

/**
 * Hiển thị trang giỏ hàng
 *
 * @description Lấy thông tin giỏ hàng của người dùng (đăng nhập hoặc khách)
 *              và render ra trang giỏ hàng với danh sách sản phẩm
 *
 * @param {Object} req - Request object từ Express
 * @param {Object} req.user - Thông tin user đã đăng nhập (nếu có)
 * @param {Object} req.session - Session của người dùng (cho khách)
 * @param {Object} res - Response object từ Express
 *
 * @returns {void} Render trang cart/index với dữ liệu giỏ hàng
 */
exports.viewCart = async (req, res) => {
    try {
        // Lấy userId từ user đã đăng nhập, hoặc null nếu là khách
        const userId = req.user ? req.user.id : null;
        // Lấy sessionId để hỗ trợ giỏ hàng cho khách chưa đăng nhập
        const sessionId = req.sessionID || null;

        // Lấy hoặc tạo mới giỏ hàng dựa trên userId hoặc sessionId
        const cart = await Cart.getOrCreate(userId, sessionId);
        // Tính tổng tiền và lấy danh sách sản phẩm trong giỏ
        const cartData = await Cart.calculateTotal(cart.id);

        // Render trang giỏ hàng với dữ liệu
        res.render('cart/index', {
            cart: cartData,
            user: req.user || null
        });
    } catch (error) {
        console.error('Cart view error:', error);
        res.status(500).render('error', { message: 'Lỗi tải giỏ hàng: ' + error.message, user: req.user || null });
    }
};

/**
 * Thêm sản phẩm vào giỏ hàng
 *
 * @description Nhận thông tin sản phẩm từ request body và thêm vào giỏ hàng.
 *              Hỗ trợ cả người dùng đã đăng nhập và khách (dùng session)
 *
 * @param {Object} req - Request object từ Express
 * @param {Object} req.body - Dữ liệu từ form/API
 * @param {number} req.body.product_id - ID của sản phẩm cần thêm (bắt buộc)
 * @param {number} [req.body.quantity=1] - Số lượng sản phẩm (mặc định: 1)
 * @param {number} [req.body.variant_id] - ID biến thể sản phẩm (size, màu...)
 * @param {Object} res - Response object từ Express
 *
 * @returns {JSON} Trả về JSON với trạng thái thành công và số lượng giỏ hàng mới
 */
exports.addToCart = async (req, res) => {
    try {
        if (!req.user) {
            const redirect = resolvePostLoginRedirect(req);
            return res.status(401).json({
                success: false,
                requiresLogin: true,
                message: 'Vui lòng đăng nhập để thêm sản phẩm vào giỏ hàng.',
                loginUrl: `/auth/login?redirect=${encodeURIComponent(redirect)}`
            });
        }

        if (req.user.email_verified === false || req.user.email_verified === 0) {
            const redirect = resolvePostLoginRedirect(req);
            return res.status(403).json({
                success: false,
                requiresEmailVerification: true,
                message: 'Vui lòng xác thực email trước khi thêm sản phẩm vào giỏ hàng.',
                loginUrl: `/auth/verify-email?redirect=${encodeURIComponent(redirect)}`
            });
        }

        // Lấy thông tin sản phẩm từ request body
        const { product_id, quantity = 1, variant_id } = req.body;
        const productId = parsePositiveInteger(product_id);
        const quantityNumber = parsePositiveInteger(quantity);
        let safeVariantId = parseOptionalPositiveInteger(variant_id);

        // Kiểm tra product_id có được cung cấp không
        if (!productId) {
            return res.status(400).json({ success: false, message: 'Product ID is required' });
        }

        if (!quantityNumber) {
            return res.status(400).json({ success: false, message: 'Quantity must be a positive integer' });
        }

        if (variant_id !== undefined && variant_id !== null && variant_id !== '' && safeVariantId === null) {
            return res.status(400).json({ success: false, message: 'Variant ID is invalid' });
        }

        const variantResolution = await resolveAddToCartVariant(productId, safeVariantId);
        if (!variantResolution.valid) {
            return res.status(variantResolution.status).json({
                success: false,
                message: variantResolution.message,
                requiresVariant: Boolean(variantResolution.requiresVariant),
                productUrl: variantResolution.productUrl
            });
        }

        safeVariantId = variantResolution.variantId;

        const { cart } = await getCartContext(req);
        const existingItem = await Cart.findItemByProduct(cart.id, productId, safeVariantId);
        const nextQuantity = (existingItem ? existingItem.quantity : 0) + quantityNumber;
        const validation = await validateProductSelection(productId, nextQuantity, safeVariantId);

        if (!validation.valid) {
            return res.status(validation.status).json({ success: false, message: validation.message });
        }

        // Thêm sản phẩm vào giỏ hàng
        await Cart.addItem(cart.id, productId, quantityNumber, safeVariantId);

        // Lấy số lượng sản phẩm mới trong giỏ để cập nhật UI
        const cartCount = await Cart.getCartCount(cart.id);

        // Trả về kết quả thành công
        return res.json({
            success: true,
            message: 'Đã thêm vào giỏ hàng!',
            cartCount
        });
    } catch (error) {
        console.error('Add to cart error:', error);
        res.status(400).json({ success: false, message: 'Lỗi thêm giỏ hàng: ' + error.message });
    }
};

/**
 * Cập nhật số lượng sản phẩm trong giỏ hàng
 *
 * @description Thay đổi số lượng của một sản phẩm đã có trong giỏ.
 *              Nếu quantity = 0, sản phẩm sẽ bị xóa khỏi giỏ
 *
 * @param {Object} req - Request object từ Express
 * @param {Object} req.body - Dữ liệu cập nhật
 * @param {number} req.body.cart_item_id - ID của item trong giỏ hàng (bắt buộc)
 * @param {number} req.body.quantity - Số lượng mới (bắt buộc)
 * @param {Object} res - Response object từ Express
 *
 * @returns {JSON|Redirect} Trả về JSON hoặc redirect về trang giỏ hàng
 */
exports.updateCart = async (req, res) => {
    try {
        // Lấy thông tin cập nhật từ request body
        const { cart_item_id, quantity } = req.body;
        const cartItemId = parsePositiveInteger(cart_item_id);
        const quantityNumber = parseInteger(quantity);

        // Validate: cần có cả cart_item_id và quantity
        if (!cartItemId || quantity === undefined || quantityNumber === null || quantityNumber < 0) {
            return res.status(400).json({ success: false, message: 'Cart item ID and quantity are required' });
        }

        const { cart } = await getCartContext(req);
        const cartItem = await Cart.getScopedItem(cart.id, cartItemId);

        if (!cartItem) {
            return res.status(404).json({ success: false, message: 'Cart item not found' });
        }

        if (quantityNumber > 0) {
            const validation = await validateProductSelection(cartItem.product_id, quantityNumber, cartItem.variant_id);
            if (!validation.valid) {
                return res.status(validation.status).json({ success: false, message: validation.message });
            }
        }

        // Cập nhật số lượng sản phẩm trong database
        await Cart.updateQuantity(cart.id, cartItemId, quantityNumber);

        // Lấy thông tin item đã cập nhật
        const updatedItem = quantityNumber > 0 ? await Cart.getItemById(cartItemId, cart.id) : null;

        // Nếu request chấp nhận JSON, trả về JSON với thông tin item
        if (req.accepts('json')) {
            return res.json({
                success: true,
                item: updatedItem,
                removed: quantityNumber === 0
            });
        }

        // Nếu không, redirect về trang giỏ hàng
        res.redirect('/cart');
    } catch (error) {
        console.error('Update cart error:', error);
        res.status(400).json({ success: false, message: error.message });
    }
};

/**
 * Xóa sản phẩm khỏi giỏ hàng
 *
 * @description Xóa hoàn toàn một sản phẩm khỏi giỏ hàng dựa trên cart_item_id
 *
 * @param {Object} req - Request object từ Express
 * @param {Object} req.body - Dữ liệu xóa
 * @param {number} req.body.cart_item_id - ID của item cần xóa (bắt buộc)
 * @param {Object} res - Response object từ Express
 *
 * @returns {JSON|Redirect} Trả về JSON hoặc redirect về trang giỏ hàng
 */
exports.removeFromCart = async (req, res) => {
    try {
        // Lấy cart_item_id từ request body
        const { cart_item_id } = req.body;
        const cartItemId = parsePositiveInteger(cart_item_id);

        // Validate: cần có cart_item_id
        if (!cartItemId) {
            return res.status(400).json({ success: false, message: 'Cart item ID is required' });
        }

        const { cart } = await getCartContext(req);
        const cartItem = await Cart.getScopedItem(cart.id, cartItemId);

        if (!cartItem) {
            return res.status(404).json({ success: false, message: 'Cart item not found' });
        }

        // Xóa sản phẩm khỏi giỏ hàng
        await Cart.removeItem(cart.id, cartItemId);

        // Trả về JSON nếu request chấp nhận
        if (req.accepts('json')) {
            return res.json({ success: true });
        }

        // Redirect về trang giỏ hàng
        res.redirect('/cart');
    } catch (error) {
        console.error('Remove from cart error:', error);
        res.status(400).json({ success: false, message: error.message });
    }
};

/**
 * Lấy số lượng sản phẩm trong giỏ hàng (cho header)
 *
 * @description API endpoint để lấy số lượng sản phẩm trong giỏ,
 *              thường được gọi bằng AJAX để cập nhật icon giỏ hàng trên header
 *
 * @param {Object} req - Request object từ Express
 * @param {Object} res - Response object từ Express
 *
 * @returns {JSON} Trả về JSON với số lượng sản phẩm: { count: number }
 */
exports.getCartCount = async (req, res) => {
    try {
        const { cart } = await getCartContext(req);
        // Đếm số lượng sản phẩm
        const count = await Cart.getCartCount(cart.id);

        // Trả về số lượng
        res.json({ count });
    } catch (error) {
        // Nếu lỗi, trả về 0
        res.json({ count: 0 });
    }
};
