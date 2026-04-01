/**
 * =============================================================================
 * PRODUCT CONTROLLER - Điều khiển sản phẩm (Frontend)
 * =============================================================================
 * File này chứa các hàm xử lý logic hiển thị sản phẩm cho khách hàng:
 * - Trang chủ (Homepage)
 * - Danh sách sản phẩm (Product listing)
 * - Chi tiết sản phẩm (Product detail)
 * - Tìm kiếm sản phẩm (Search)
 * - Sản phẩm theo danh mục (Category products)
 * =============================================================================
 */

const sanitizeHtml = require('sanitize-html');
const Product = require('../models/Product');
const Category = require('../models/Category');
const Banner = require('../models/Banner');
const { deleteFromCloudinary } = require('../config/cloudinary');

const DESCRIPTION_ALLOWED_TAGS = [
    'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's',
    'ul', 'ol', 'li', 'blockquote',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'a'
];

const DESCRIPTION_ALLOWED_ATTRIBUTES = {
    a: ['href', 'target', 'rel']
};

const MAX_REVIEW_IMAGES = 5;
const MAX_REVIEW_VIDEOS = 1;

const REVIEW_FEEDBACK_MAP = {
    submitted: {
        type: 'success',
        message: 'Đánh giá của bạn đã được gửi thành công.'
    },
    'invalid-rating': {
        type: 'error',
        message: 'Vui lòng chọn số sao hợp lệ từ 1 đến 5.'
    },
    'not-eligible': {
        type: 'warning',
        message: 'Bạn chỉ có thể đánh giá sau khi đơn hàng đã được giao thành công.'
    },
    'already-reviewed': {
        type: 'info',
        message: 'Bạn đã đánh giá sản phẩm này rồi.'
    },
    'product-not-found': {
        type: 'error',
        message: 'Không tìm thấy sản phẩm để gửi đánh giá.'
    },
    failed: {
        type: 'error',
        message: 'Không thể gửi đánh giá lúc này. Vui lòng thử lại sau.'
    }
};

const REVIEW_FEEDBACK_MESSAGES = {
    ...REVIEW_FEEDBACK_MAP,
    updated: {
        type: 'success',
        message: 'Đánh giá của bạn đã được cập nhật.'
    },
    'already-reviewed': {
        type: 'info',
        message: 'Bạn đã đánh giá sản phẩm này. Bạn có thể chỉnh sửa nội dung ở form bên dưới.'
    },
    'invalid-media': {
        type: 'warning',
        message: 'Review chỉ hỗ trợ tối đa 5 ảnh và 1 video.'
    },
    'file-too-large': {
        type: 'warning',
        message: 'File review quá lớn. Vui lòng chọn file nhỏ hơn.'
    },
    'upload-failed': {
        type: 'error',
        message: 'Không thể tải media review lúc này. Vui lòng thử lại.'
    },
    'review-not-found': {
        type: 'error',
        message: 'Không tìm thấy review của bạn để chỉnh sửa.'
    }
};

function normalizeReviewComment(comment) {
    if (typeof comment !== 'string') {
        return '';
    }

    return sanitizeHtml(comment, {
        allowedTags: [],
        allowedAttributes: {}
    })
        .replace(/\r\n?/g, '\n')
        .trim()
        .slice(0, 2000);
}

function normalizeRemoveMediaIds(value) {
    return [...new Set(
        (Array.isArray(value) ? value : [value])
            .map((mediaId) => Number.parseInt(mediaId, 10))
            .filter((mediaId) => Number.isInteger(mediaId))
    )];
}

function countReviewMediaByType(mediaItems = []) {
    return mediaItems.reduce((counts, media) => {
        const mediaType = media?.mediaType || media?.media_type;
        if (mediaType === 'video') {
            counts.videos += 1;
        } else if (mediaType === 'image') {
            counts.images += 1;
        }

        return counts;
    }, { images: 0, videos: 0 });
}

function isReviewMediaSelectionValid(existingMedia = [], removeMediaIds = [], uploadedMedia = []) {
    const removableIds = new Set(removeMediaIds);
    const remainingMedia = (Array.isArray(existingMedia) ? existingMedia : [])
        .filter((media) => !removableIds.has(media.id));
    const remainingCounts = countReviewMediaByType(remainingMedia);
    const uploadedCounts = countReviewMediaByType(uploadedMedia);

    return (
        remainingCounts.images + uploadedCounts.images <= MAX_REVIEW_IMAGES &&
        remainingCounts.videos + uploadedCounts.videos <= MAX_REVIEW_VIDEOS
    );
}

async function cleanupUploadedReviewMedia(mediaItems = []) {
    for (const media of mediaItems) {
        const publicId = media?.publicId || media?.public_id;
        if (!publicId) {
            continue;
        }

        const resourceType = media?.mediaType || media?.media_type || 'image';
        await deleteFromCloudinary(publicId, { resource_type: resourceType }).catch((error) => {
            console.error('Review media cleanup error:', error);
        });
    }
}

function containsHtmlMarkup(value) {
    return /<\/?[a-z][\s\S]*>/i.test(value);
}

function formatProductDescription(description) {
    if (typeof description !== 'string') {
        return '';
    }

    const normalizedDescription = description.replace(/\r\n?/g, '\n').trim();
    if (!normalizedDescription) {
        return '';
    }

    const sanitizeOptions = {
        allowedTags: DESCRIPTION_ALLOWED_TAGS,
        allowedAttributes: DESCRIPTION_ALLOWED_ATTRIBUTES,
        allowedSchemes: ['http', 'https', 'mailto', 'tel'],
        transformTags: {
            a: (tagName, attribs) => ({
                tagName,
                attribs: {
                    ...attribs,
                    rel: 'noopener noreferrer nofollow'
                }
            })
        }
    };

    if (containsHtmlMarkup(normalizedDescription)) {
        return sanitizeHtml(normalizedDescription, sanitizeOptions);
    }

    const escapedDescription = sanitizeHtml(normalizedDescription, {
        allowedTags: [],
        allowedAttributes: {}
    });

    return escapedDescription
        .split(/\n{2,}/)
        .map((paragraph) => `<p>${paragraph.replace(/\n/g, '<br>')}</p>`)
        .join('');
}

function getReviewFeedback(code) {
    if (code === 'updated') {
        return null;
    }

    return REVIEW_FEEDBACK_MESSAGES[code] || null;
}

function buildProductReviewRedirect(slug, code) {
    const safeSlug = encodeURIComponent(slug);
    return `/products/${safeSlug}?review=${encodeURIComponent(code)}`;
}

// =============================================================================
// TRANG CHỦ - HOMEPAGE
// =============================================================================

/**
 * Hiển thị trang chủ
 *
 * @description Lấy dữ liệu banners, danh mục, sản phẩm mới và bán chạy
 *              để hiển thị trên trang chủ
 *
 * @param {Object} req - Request object từ Express
 * @param {Object} res - Response object từ Express
 *
 * @returns {Render} Render trang home/index với dữ liệu
 */
exports.getHomePage = async (req, res) => {
    try {
        // Lấy danh sách banner đang hoạt động (cho carousel)
        const banners = await Banner.getActiveBanners().catch(err => {
            console.error('Banner error:', err);
            return []; // Trả về mảng rỗng nếu lỗi
        });

        // Lấy 3 danh mục hàng đầu
        const categories = await Category.getTopCategories(3).catch(err => {
            console.error('Category error:', err);
            // Dữ liệu mẫu fallback nếu lỗi database
            return [
                { id: 1, name: 'Thời Trang Nam', slug: 'nam', product_count: 5 },
                { id: 2, name: 'Thời Trang Nữ', slug: 'nu', product_count: 5 },
                { id: 3, name: 'Thời Trang Trẻ Em', slug: 'tre-em', product_count: 4 }
            ];
        });

        // Lấy 8 sản phẩm mới nhất
        const newProducts = await Product.getNewProducts(8).catch(err => {
            console.error('New products error:', err);
            // Dữ liệu mẫu fallback
            return [
                { id: 1, name: 'Áo Polo Classic Nam', slug: 'ao-polo-classic', price: 450000, final_price: 225000, primary_image: 'https://images.unsplash.com/photo-1586790170083-2f9ceadc732d?w=600' },
                { id: 2, name: 'Đầm Maxi Hoa', slug: 'dam-maxi-hoa', price: 750000, final_price: 592500, primary_image: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=600' },
                { id: 3, name: 'Áo Thun Basic', slug: 'ao-thun-basic', price: 250000, final_price: 250000, primary_image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600' },
                { id: 4, name: 'Váy Công Sở', slug: 'vay-cong-so', price: 420000, final_price: 420000, primary_image: 'https://images.unsplash.com/photo-1594633313593-bab3825d0caf?w=600' }
            ];
        });

        // Lấy 8 sản phẩm bán chạy nhất
        const bestSellers = await Product.getBestSellers(8).catch(err => {
            console.error('Best sellers error:', err);
            // Dữ liệu mẫu fallback
            return [
                { id: 5, name: 'Quần Jeans Slim Fit', slug: 'quan-jeans', price: 680000, final_price: 680000, primary_image: 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=600' },
                { id: 6, name: 'Áo Sơ Mi Lụa', slug: 'ao-so-mi-lua', price: 520000, final_price: 520000, primary_image: 'https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?w=600' },
                { id: 7, name: 'Bộ Đồ Bé Trai', slug: 'bo-do-be-trai', price: 320000, final_price: 320000, primary_image: 'https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?w=600' },
                { id: 8, name: 'Áo Sơ Mi Oxford', slug: 'ao-so-mi-oxford', price: 520000, final_price: 410800, primary_image: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600' }
            ];
        });

        // Render trang chủ với dữ liệu
        res.render('home/index', {
            banners,
            categories,
            newProducts,
            bestSellers,
            user: req.user || null
        });
    } catch (error) {
        console.error('Homepage error:', error);
        res.status(500).render('error', { message: 'Unable to load homepage', user: req.user || null });
    }
};

exports.createProductReview = async (req, res) => {
    const fallbackSlug = req.params.slug;
    const uploadedMedia = Array.isArray(req.uploadedReviewMedia) ? req.uploadedReviewMedia : [];

    try {
        const product = await Product.findBySlug(fallbackSlug, { incrementView: false });

        if (!product) {
            await cleanupUploadedReviewMedia(uploadedMedia);
            return res.redirect(buildProductReviewRedirect(fallbackSlug, 'product-not-found'));
        }

        const rating = Number.parseInt(req.body.rating, 10);
        const comment = normalizeReviewComment(req.body.comment);

        if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
            await cleanupUploadedReviewMedia(uploadedMedia);
            return res.redirect(buildProductReviewRedirect(product.slug || fallbackSlug, 'invalid-rating'));
        }

        const reviewContext = await Product.getReviewContext(product.id, req.user?.id);

        if (reviewContext.existingReview) {
            await cleanupUploadedReviewMedia(uploadedMedia);
            return res.redirect(buildProductReviewRedirect(product.slug || fallbackSlug, 'already-reviewed'));
        }

        if (!reviewContext.eligibleOrder) {
            await cleanupUploadedReviewMedia(uploadedMedia);
            return res.redirect(buildProductReviewRedirect(product.slug || fallbackSlug, 'not-eligible'));
        }

        await Product.createReview({
            productId: product.id,
            userId: req.user.id,
            orderId: reviewContext.eligibleOrder.id,
            rating,
            comment,
            isVerified: true,
            isApproved: true,
            media: uploadedMedia
        });

        return res.redirect(buildProductReviewRedirect(product.slug || fallbackSlug, 'submitted'));
    } catch (error) {
        console.error('Create product review error:', error);
        await cleanupUploadedReviewMedia(uploadedMedia);
        return res.redirect(buildProductReviewRedirect(fallbackSlug, 'failed'));
    }
};

exports.updateProductReview = async (req, res) => {
    const fallbackSlug = req.params.slug;
    const requestedReviewId = Number.parseInt(req.params.reviewId, 10);
    const uploadedMedia = Array.isArray(req.uploadedReviewMedia) ? req.uploadedReviewMedia : [];

    try {
        const product = await Product.findBySlug(fallbackSlug, { incrementView: false });

        if (!product) {
            await cleanupUploadedReviewMedia(uploadedMedia);
            return res.redirect(buildProductReviewRedirect(fallbackSlug, 'product-not-found'));
        }

        if (!Number.isInteger(requestedReviewId)) {
            await cleanupUploadedReviewMedia(uploadedMedia);
            return res.redirect(buildProductReviewRedirect(product.slug || fallbackSlug, 'review-not-found'));
        }

        const rating = Number.parseInt(req.body.rating, 10);
        const comment = normalizeReviewComment(req.body.comment);

        if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
            await cleanupUploadedReviewMedia(uploadedMedia);
            return res.redirect(buildProductReviewRedirect(product.slug || fallbackSlug, 'invalid-rating'));
        }

        const reviewContext = await Product.getReviewContext(product.id, req.user?.id);
        const existingReview = reviewContext?.existingReview;

        if (!existingReview || existingReview.id !== requestedReviewId) {
            await cleanupUploadedReviewMedia(uploadedMedia);
            return res.redirect(buildProductReviewRedirect(product.slug || fallbackSlug, 'review-not-found'));
        }

        const removeMediaIds = normalizeRemoveMediaIds(req.body.remove_media_ids);
        if (!isReviewMediaSelectionValid(existingReview.media, removeMediaIds, uploadedMedia)) {
            await cleanupUploadedReviewMedia(uploadedMedia);
            return res.redirect(buildProductReviewRedirect(product.slug || fallbackSlug, 'invalid-media'));
        }

        const updatedReview = await Product.updateReview({
            reviewId: existingReview.id,
            userId: req.user.id,
            rating,
            comment,
            removeMediaIds,
            media: uploadedMedia
        });

        if (!updatedReview) {
            await cleanupUploadedReviewMedia(uploadedMedia);
            return res.redirect(buildProductReviewRedirect(product.slug || fallbackSlug, 'review-not-found'));
        }

        await cleanupUploadedReviewMedia(updatedReview.removedMedia || []);
        return res.redirect(`/products/${encodeURIComponent(product.slug || fallbackSlug)}`);
    } catch (error) {
        console.error('Update product review error:', error);
        await cleanupUploadedReviewMedia(uploadedMedia);
        return res.redirect(buildProductReviewRedirect(fallbackSlug, 'failed'));
    }
};

// =============================================================================
// DANH SÁCH SẢN PHẨM - PRODUCT LISTING
// =============================================================================

/**
 * Hiển thị danh sách sản phẩm với bộ lọc
 *
 * @description Lấy danh sách sản phẩm theo các tiêu chí lọc:
 *              danh mục, từ khóa, khoảng giá, sắp xếp
 *
 * @param {Object} req - Request object từ Express
 * @param {Object} req.query - Tham số lọc từ URL
 * @param {string} [req.query.category] - Slug danh mục
 * @param {string} [req.query.search] - Từ khóa tìm kiếm
 * @param {number} [req.query.min_price] - Giá tối thiểu
 * @param {number} [req.query.max_price] - Giá tối đa
 * @param {string} [req.query.sort_by] - Trường sắp xếp (price, created_at, name)
 * @param {string} [req.query.sort_order] - Thứ tự (ASC, DESC)
 * @param {number} [req.query.page=1] - Số trang
 * @param {Object} res - Response object từ Express
 *
 * @returns {Render} Render trang products/list với danh sách sản phẩm
 */
exports.getProducts = async (req, res) => {
    try {
        // Lấy các tham số lọc từ query string
        const {
            category,       // Slug danh mục
            search,         // Từ khóa tìm kiếm
            min_price,      // Giá tối thiểu
            max_price,      // Giá tối đa
            sort,           // Sắp xếp (price-asc, price-desc, name-asc, name-desc, newest)
            page = 1,       // Số trang (mặc định: 1)
            sale            // Lọc sản phẩm đang khuyến mãi
        } = req.query;

        // Xử lý sort parameter
        let sort_by = 'created_at';
        let sort_order = 'DESC';

        if (sort) {
            switch (sort) {
                case 'price-asc':
                    sort_by = 'price';
                    sort_order = 'ASC';
                    break;
                case 'price-desc':
                    sort_by = 'price';
                    sort_order = 'DESC';
                    break;
                case 'name-asc':
                    sort_by = 'name';
                    sort_order = 'ASC';
                    break;
                case 'name-desc':
                    sort_by = 'name';
                    sort_order = 'DESC';
                    break;
                case 'newest':
                default:
                    sort_by = 'created_at';
                    sort_order = 'DESC';
                    break;
            }
        }

        // Cấu hình phân trang
        const limit = 12;                    // 12 sản phẩm mỗi trang
        const offset = (page - 1) * limit;   // Bỏ qua bao nhiêu sản phẩm

        // Xây dựng object filter
        const filters = {
            limit,
            offset,
            sort_by,
            sort_order
        };

        // Lọc theo danh mục nếu có
        if (category) {
            const cat = await Category.findBySlug(category).catch(() => null);
            if (cat) filters.category_id = cat.id;
        }

        // Lọc theo từ khóa tìm kiếm
        if (search) filters.search = search;

        // Lọc theo khoảng giá
        if (min_price) filters.min_price = parseFloat(min_price);
        if (max_price) filters.max_price = parseFloat(max_price);

        // Lọc sản phẩm đang khuyến mãi
        if (sale === 'true') filters.on_sale = true;

        // Lấy danh sách sản phẩm với error handling
        let products = [];
        let categories = [];

        try {
            products = await Product.findAll(filters);
        } catch (err) {
            console.error('Product findAll error:', err);
            // Dữ liệu mẫu fallback
            products = [
                { id: 1, name: 'Áo Polo Classic Nam', slug: 'ao-polo-classic', price: 450000, final_price: 225000, primary_image: 'https://images.unsplash.com/photo-1586790170083-2f9ceadc732d?w=600' },
                { id: 2, name: 'Đầm Maxi Hoa', slug: 'dam-maxi-hoa', price: 750000, final_price: 592500, primary_image: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=600' },
                { id: 3, name: 'Áo Thun Basic', slug: 'ao-thun-basic', price: 250000, final_price: 250000, primary_image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600' },
                { id: 4, name: 'Váy Công Sở', slug: 'vay-cong-so', price: 420000, final_price: 420000, primary_image: 'https://images.unsplash.com/photo-1594633313593-bab3825d0caf?w=600' }
            ];
        }

        // Lấy danh sách danh mục cho sidebar
        try {
            categories = await Category.findAll();
        } catch (err) {
            console.error('Category findAll error:', err);
            categories = [
                { id: 1, name: 'Thời Trang Nam', slug: 'nam', product_count: 5 },
                { id: 2, name: 'Thời Trang Nữ', slug: 'nu', product_count: 5 },
                { id: 3, name: 'Thời Trang Trẻ Em', slug: 'tre-em', product_count: 4 }
            ];
        }

        // Return JSON if requested (for AJAX)
        if (req.headers.accept && req.headers.accept.includes('application/json')) {
            return res.json({
                products,
                currentPage: parseInt(page),
                totalPages: Math.ceil(products.length / limit) || 1
            });
        }

        // Render trang danh sách sản phẩm
        res.render('products/list', {
            products,
            categories,
            category: null,                  // Không có category cụ thể
            filters: req.query,              // Giữ lại filter để hiển thị
            currentPage: parseInt(page),
            user: req.user || null,
            isSalePage: sale === 'true'      // Đánh dấu đây là trang sale
        });
    } catch (error) {
        console.error('Product listing error:', error);
        res.status(500).render('error', { message: 'Lỗi tải danh sách sản phẩm: ' + error.message, user: req.user || null });
    }
};

// =============================================================================
// CHI TIẾT SẢN PHẨM - PRODUCT DETAIL
// =============================================================================

/**
 * Hiển thị chi tiết sản phẩm
 *
 * @description Lấy thông tin đầy đủ của sản phẩm và sản phẩm liên quan
 *
 * @param {Object} req - Request object từ Express
 * @param {Object} req.params.slug - Slug của sản phẩm
 * @param {Object} res - Response object từ Express
 *
 * @returns {Render} Render trang products/detail với thông tin sản phẩm
 */
exports.getProductDetail = async (req, res) => {
    try {
        const { slug } = req.params;
        const reviewFeedbackCode = req.query?.review || null;
        const reviewFeedback = getReviewFeedback(reviewFeedbackCode);

        // Tìm sản phẩm theo slug
        let product = null;
        try {
            product = await Product.findBySlug(slug);
        } catch (err) {
            console.error('Product findBySlug error:', err);
        }

        // Trả về 404 nếu không tìm thấy
        if (!product) {
            return res.status(404).render('error', {
                message: 'Không tìm thấy sản phẩm: ' + slug,
                user: req.user || null
            });
        }

        // Lấy sản phẩm liên quan (cùng danh mục)
        product.descriptionHtml = formatProductDescription(product.description);
        const reviews = Array.isArray(product.reviews) ? product.reviews : [];
        let reviewContext = {
            canReview: false,
            eligibleOrder: null,
            existingReview: null
        };

        if (req.user?.id) {
            try {
                reviewContext = await Product.getReviewContext(product.id, req.user.id);
            } catch (err) {
                console.error('Product review context error:', err);
            }
        }

        let relatedProducts = [];
        try {
            relatedProducts = await Product.findAll({
                category_id: product.category_id,
                limit: 4,
                offset: 0
            });
            // Loại bỏ sản phẩm hiện tại khỏi danh sách liên quan
            relatedProducts = relatedProducts.filter(p => p.id !== product.id);
        } catch (err) {
            console.error('Related products error:', err);
        }

        // Render trang chi tiết
        res.render('products/detail', {
            product,
            reviews,
            reviewContext,
            reviewFeedback,
            reviewFeedbackCode,
            relatedProducts,
            user: req.user || null
        });
    } catch (error) {
        console.error('Product detail error:', error);
        res.status(500).render('error', { message: 'Lỗi tải chi tiết sản phẩm: ' + error.message, user: req.user || null });
    }
};

// =============================================================================
// TÌM KIẾM SẢN PHẨM - SEARCH
// =============================================================================

/**
 * Tìm kiếm sản phẩm
 *
 * @description Tìm kiếm sản phẩm theo từ khóa trong tên và mô tả
 *
 * @param {Object} req - Request object từ Express
 * @param {Object} req.query.q - Từ khóa tìm kiếm
 * @param {Object} res - Response object từ Express
 *
 * @returns {Render|Redirect} Render trang kết quả tìm kiếm hoặc redirect
 */
exports.searchProducts = async (req, res) => {
    try {
        const { q } = req.query;

        // Redirect về trang danh sách nếu không có từ khóa
        if (!q) {
            return res.redirect('/products');
        }

        // Tìm kiếm sản phẩm (tối đa 20 kết quả)
        const products = await Product.search(q, 20);

        // Render trang kết quả
        res.render('products/search-results', {
            products,
            query: q,
            user: req.user || null
        });
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).render('error', { message: 'Search failed' });
    }
};

// =============================================================================
// SẢN PHẨM THEO DANH MỤC - CATEGORY PRODUCTS
// =============================================================================

/**
 * Hiển thị sản phẩm theo danh mục
 *
 * @description Lấy danh sách sản phẩm thuộc một danh mục cụ thể
 *
 * @param {Object} req - Request object từ Express
 * @param {Object} req.params.slug - Slug của danh mục
 * @param {Object} res - Response object từ Express
 *
 * @returns {Render} Render trang products/category với sản phẩm theo danh mục
 */
exports.getProductsByCategory = async (req, res) => {
    try {
        const { slug } = req.params;
        const { sort, page = 1 } = req.query;

        // Tìm danh mục theo slug
        let category = await Category.findBySlug(slug);

        // Fallback sang dữ liệu mẫu nếu không tìm thấy trong database
        if (!category) {
            const categoryMap = {
                'nam': { id: 1, name: 'Thời Trang Nam', slug: 'nam', description: 'Quần áo và phụ kiện nam' },
                'nu': { id: 2, name: 'Thời Trang Nữ', slug: 'nu', description: 'Quần áo và phụ kiện nữ' },
                'tre-em': { id: 3, name: 'Thời Trang Trẻ Em', slug: 'tre-em', description: 'Quần áo trẻ em' }
            };
            category = categoryMap[slug] || null;
        }

        // Trả về 404 nếu không tìm thấy danh mục
        if (!category) {
            return res.status(404).render('error', {
                message: 'Không tìm thấy danh mục: ' + slug,
                user: req.user || null
            });
        }

        // Xử lý sort parameter
        let sort_by = 'created_at';
        let sort_order = 'DESC';

        if (sort) {
            switch (sort) {
                case 'price-asc':
                    sort_by = 'price';
                    sort_order = 'ASC';
                    break;
                case 'price-desc':
                    sort_by = 'price';
                    sort_order = 'DESC';
                    break;
                case 'name-asc':
                    sort_by = 'name';
                    sort_order = 'ASC';
                    break;
                case 'name-desc':
                    sort_by = 'name';
                    sort_order = 'DESC';
                    break;
                case 'newest':
                default:
                    sort_by = 'created_at';
                    sort_order = 'DESC';
                    break;
            }
        }

        // Lấy sản phẩm thuộc danh mục
        let products = [];
        try {
            products = await Product.findAll({
                category_id: category.id,
                limit: 50,
                offset: 0,
                sort_by,
                sort_order
            });
        } catch (err) {
            console.error('Product findAll error:', err);
            products = []; // Trả về mảng rỗng nếu lỗi
        }

        // Nếu là AJAX request, trả về JSON
        if (req.xhr || req.headers.accept?.includes('application/json')) {
            return res.json({ products, category });
        }

        // Render trang danh mục
        res.render('products/category', {
            category,
            products,
            currentSort: sort || 'newest',
            user: req.user || null
        });
    } catch (error) {
        console.error('Category products error:', error);
        res.status(500).render('error', {
            message: 'Lỗi tải sản phẩm theo danh mục: ' + error.message,
            user: req.user || null
        });
    }
};
