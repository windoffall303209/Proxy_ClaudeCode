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
const { getProductSuggestions } = require('../services/productSuggestService');

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

// Trả JSON gợi ý sản phẩm cho ô autocomplete tìm kiếm.
exports.suggestProducts = async (req, res) => {
    try {
        const suggestions = await getProductSuggestions(req.query.q, 6);
        res.json(suggestions);
    } catch (error) {
        console.error('Product suggest error:', error);
        res.status(500).json([]);
    }
};

const PER_PAGE_OPTIONS = [10, 20, 30, 40, 50];
const DEFAULT_PER_PAGE = 20;
const DEFAULT_PRODUCT_GRID_COLUMNS = 5;
const DEFAULT_HOME_CATEGORY_SHOWCASE_COUNT = 3;
const PROMOTION_FILTER_OPTIONS = new Set(['active', 'upcoming', 'active_or_upcoming']);
const CATALOG_RATING_OPTIONS = [4, 3, 2, 1];
const CATALOG_PRICE_RANGES = [
    { label: 'Dưới 200k', min: null, max: 200000 },
    { label: '200k - 500k', min: 200000, max: 500000 },
    { label: '500k - 1M', min: 500000, max: 1000000 },
    { label: 'Từ 1M', min: 1000000, max: null }
];
const CATEGORY_FALLBACK_MAP = {
    nam: { id: 1, name: 'Thời Trang Nam', slug: 'nam', description: 'Quần áo và phụ kiện nam' },
    nu: { id: 2, name: 'Thời Trang Nữ', slug: 'nu', description: 'Quần áo và phụ kiện nữ' },
    'tre-em': { id: 3, name: 'Thời Trang Trẻ Em', slug: 'tre-em', description: 'Quần áo trẻ em' }
};

// Chuẩn hóa positive integer.
function normalizePositiveInteger(value, fallback = 1) {
    const parsedValue = Number.parseInt(value, 10);
    return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : fallback;
}

// Chuẩn hóa per trang.
function normalizePerPage(value) {
    const parsedValue = normalizePositiveInteger(value, DEFAULT_PER_PAGE);
    return PER_PAGE_OPTIONS.includes(parsedValue) ? parsedValue : DEFAULT_PER_PAGE;
}

// Chuẩn hóa storefront settings.
function normalizeStorefrontSettings(settings = {}) {
    const productGridColumns = Math.min(
        6,
        Math.max(
            2,
            normalizePositiveInteger(settings.product_grid_columns, DEFAULT_PRODUCT_GRID_COLUMNS)
        )
    );
    const homeCategoryShowcaseCount = Math.min(
        8,
        Math.max(
            1,
            normalizePositiveInteger(settings.home_category_showcase_count, DEFAULT_HOME_CATEGORY_SHOWCASE_COUNT)
        )
    );

    return {
        product_grid_columns: productGridColumns,
        home_category_showcase_count: homeCategoryShowcaseCount
    };
}

// Tạo dữ liệu phân trang.
function buildPagination(totalItems, requestedPage, perPage) {
    const safeTotalItems = Math.max(0, Number.parseInt(totalItems, 10) || 0);
    const safePerPage = normalizePerPage(perPage);
    const totalPages = Math.max(1, Math.ceil(safeTotalItems / safePerPage) || 1);
    const currentPage = Math.min(Math.max(normalizePositiveInteger(requestedPage, 1), 1), totalPages);

    return {
        totalItems: safeTotalItems,
        totalPages,
        currentPage,
        perPage: safePerPage,
        offset: (currentPage - 1) * safePerPage
    };
}

// Phân tích catalog sort.
function parseCatalogSort(sort) {
    switch (String(sort || '').trim()) {
        case 'best-selling':
            return { currentSort: 'best-selling', sort_by: 'sold_count', sort_order: 'DESC' };
        case 'price-asc':
            return { currentSort: 'price-asc', sort_by: 'price', sort_order: 'ASC' };
        case 'price-desc':
            return { currentSort: 'price-desc', sort_by: 'price', sort_order: 'DESC' };
        case 'name-asc':
            return { currentSort: 'name-asc', sort_by: 'name', sort_order: 'ASC' };
        case 'name-desc':
            return { currentSort: 'name-desc', sort_by: 'name', sort_order: 'DESC' };
        case 'newest':
        default:
            return { currentSort: 'newest', sort_by: 'created_at', sort_order: 'DESC' };
    }
}

// Chuẩn hóa non negative number.
function normalizeNonNegativeNumber(value) {
    if (value === undefined || value === null || value === '') {
        return null;
    }

    const parsedValue = Number.parseFloat(value);
    return Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : null;
}

// Chuẩn hóa giá range.
function normalizePriceRange(minPrice, maxPrice) {
    let normalizedMin = normalizeNonNegativeNumber(minPrice);
    let normalizedMax = normalizeNonNegativeNumber(maxPrice);

    if (normalizedMin !== null && normalizedMax !== null && normalizedMin > normalizedMax) {
        [normalizedMin, normalizedMax] = [normalizedMax, normalizedMin];
    }

    return {
        minPrice: normalizedMin,
        maxPrice: normalizedMax
    };
}

// Chuẩn hóa array truy vấn.
function normalizeArrayQuery(value) {
    const rawValues = Array.isArray(value) ? value : [value];

    return [...new Set(
        rawValues
            .map((item) => String(item ?? '').trim())
            .filter(Boolean)
    )];
}

// Chuẩn hóa rating filters.
function normalizeRatingFilters(value) {
    return [...new Set(
        normalizeArrayQuery(value)
            .map((item) => Number.parseInt(item, 10))
            .filter((item) => [1, 2, 3, 4, 5].includes(item))
    )].sort((left, right) => right - left);
}

// Chuẩn hóa promotion filters.
function normalizePromotionFilters(promotion, sale) {
    const normalizedPromotions = normalizeArrayQuery(promotion)
        .filter((item) => PROMOTION_FILTER_OPTIONS.has(item));

    if (normalizedPromotions.length > 0) {
        return normalizedPromotions;
    }

    return String(sale || '').trim() === 'true' ? ['active_or_upcoming'] : [];
}

// Chuẩn hóa giá range filters.
function normalizePriceRangeFilters(value) {
    const ranges = [];
    const seenRanges = new Set();

    normalizeArrayQuery(value).forEach((item) => {
        const [rawMin = '', rawMax = ''] = item.split(':', 2);
        const normalizedRange = normalizePriceRange(rawMin, rawMax);
        const rangeKey = `${normalizedRange.minPrice ?? ''}:${normalizedRange.maxPrice ?? ''}`;

        if ((normalizedRange.minPrice === null && normalizedRange.maxPrice === null) || seenRanges.has(rangeKey)) {
            return;
        }

        seenRanges.add(rangeKey);
        ranges.push({
            key: rangeKey,
            min: normalizedRange.minPrice,
            max: normalizedRange.maxPrice
        });
    });

    return ranges;
}

// Tạo dữ liệu effective giá ranges.
function buildEffectivePriceRanges(presetRanges = [], minPrice = null, maxPrice = null) {
    const ranges = [...presetRanges];
    const hasManualRange = minPrice !== null || maxPrice !== null;

    if (!hasManualRange) {
        return ranges;
    }

    const manualRangeKey = `${minPrice ?? ''}:${maxPrice ?? ''}`;
    if (ranges.some((range) => range.key === manualRangeKey)) {
        return ranges;
    }

    ranges.push({
        key: manualRangeKey,
        min: minPrice,
        max: maxPrice
    });

    return ranges;
}

// Tạo catalog danh mục maps.
function createCatalogCategoryMaps(categories = []) {
    const categoryById = new Map();
    const categoryBySlug = new Map();
    const childrenMap = new Map();

    categories.forEach((item) => {
        if (!item) {
            return;
        }

        categoryById.set(String(item.id), item);
        categoryBySlug.set(String(item.slug), item);

        const parentKey = item.parent_id ? String(item.parent_id) : 'root';
        const siblings = childrenMap.get(parentKey) || [];
        siblings.push(item);
        childrenMap.set(parentKey, siblings);
    });

    const descendantCache = new Map();

    // Lấy root danh mục.
    function getRootCategory(item) {
        let current = item || null;
        let guard = 0;

        while (current && current.parent_id && guard < 20) {
            const parent = categoryById.get(String(current.parent_id)) || null;
            if (!parent) {
                break;
            }

            current = parent;
            guard += 1;
        }

        return current;
    }

    // Lấy danh sách danh mục con.
    function getChildren(parentId) {
        const key = parentId ? String(parentId) : 'root';
        return childrenMap.get(key) || [];
    }

    // Lấy descendant ids.
    function getDescendantIds(categoryId) {
        const cacheKey = String(categoryId);
        if (descendantCache.has(cacheKey)) {
            return descendantCache.get(cacheKey);
        }

        const descendantIds = new Set([Number(categoryId)]);
        const pendingIds = [Number(categoryId)];

        while (pendingIds.length > 0) {
            const currentId = pendingIds.shift();
            getChildren(currentId).forEach((child) => {
                const childId = Number(child.id);
                if (descendantIds.has(childId)) {
                    return;
                }

                descendantIds.add(childId);
                pendingIds.push(childId);
            });
        }

        const result = [...descendantIds];
        descendantCache.set(cacheKey, result);
        return result;
    }

    return {
        categoryById,
        categoryBySlug,
        childrenMap,
        getChildren,
        getRootCategory,
        getDescendantIds
    };
}

// Chuẩn hóa danh mục filters.
function normalizeCategoryFilters(value, categories = []) {
    const allowedSlugs = new Set(
        (Array.isArray(categories) ? categories : [])
            .map((item) => String(item?.slug || '').trim())
            .filter(Boolean)
    );

    return normalizeArrayQuery(value).filter((slug) => (
        allowedSlugs.size === 0 || allowedSlugs.has(slug)
    ));
}

// Xác định danh mục filter ids.
function resolveCategoryFilterIds(selectedCategorySlugs = [], categoryMaps, defaultCategoryIds = []) {
    const categoryIds = new Set(
        (Array.isArray(defaultCategoryIds) ? defaultCategoryIds : [])
            .map((item) => Number(item))
            .filter((item) => Number.isInteger(item) && item > 0)
    );

    if (!Array.isArray(selectedCategorySlugs) || selectedCategorySlugs.length === 0) {
        return [...categoryIds];
    }

    const resolvedIds = new Set();

    selectedCategorySlugs.forEach((slug) => {
        const category = categoryMaps.categoryBySlug.get(String(slug));
        if (!category) {
            return;
        }

        categoryMaps.getDescendantIds(category.id).forEach((categoryId) => {
            resolvedIds.add(categoryId);
        });
    });

    return [...resolvedIds];
}

// Kiểm tra khuyến mãi filter đang bật.
function isSaleFilterActive(promotions = []) {
    const promotionSet = new Set(Array.isArray(promotions) ? promotions : []);
    return (
        promotionSet.has('active_or_upcoming') ||
        (promotionSet.has('active') && promotionSet.has('upcoming'))
    );
}

// Lấy fallback danh mục.
function getFallbackCategories() {
    return Object.values(CATEGORY_FALLBACK_MAP);
}

// Tìm danh mục theo slug với fallback.
async function findCategoryBySlugWithFallback(slug) {
    if (!slug) {
        return null;
    }

    try {
        const category = await Category.findBySlug(slug);
        if (category) {
            return category;
        }
    } catch (error) {
        console.error('Category findBySlug error:', error);
    }

    return CATEGORY_FALLBACK_MAP[slug] || null;
}

// Nạp catalog danh mục.
async function loadCatalogCategories() {
    try {
        const categories = await Category.findAll();
        if (Array.isArray(categories) && categories.length > 0) {
            return categories;
        }
    } catch (error) {
        console.error('Category findAll error:', error);
    }

    return getFallbackCategories();
}

// Tạo dữ liệu catalog truy vấn state.
function buildCatalogQueryState({
    categorySlug = '',
    categorySlugs = [],
    priceRanges = [],
    minPrice = null,
    maxPrice = null,
    rating = null,
    ratings = [],
    promotion = '',
    promotions = [],
    currentSort = 'newest',
    perPage = DEFAULT_PER_PAGE,
    q = '',
    search = ''
} = {}) {
    const query = {};

    const normalizedCategorySlugs = categorySlugs.length > 0
        ? categorySlugs
        : (categorySlug ? [categorySlug] : []);
    const normalizedRatings = ratings.length > 0
        ? ratings.map((item) => String(item))
        : (rating !== null ? [String(rating)] : []);
    const normalizedPromotions = promotions.length > 0
        ? promotions
        : (promotion ? [promotion] : []);

    if (normalizedCategorySlugs.length > 0) query.category = normalizedCategorySlugs;
    if (Array.isArray(priceRanges) && priceRanges.length > 0) query.price_range = priceRanges;
    if (minPrice !== null) query.min_price = String(minPrice);
    if (maxPrice !== null) query.max_price = String(maxPrice);
    if (normalizedRatings.length > 0) query.rating = normalizedRatings;
    if (normalizedPromotions.length > 0) query.promotion = normalizedPromotions;
    if (currentSort && currentSort !== 'newest') query.sort = currentSort;
    if (perPage && perPage !== DEFAULT_PER_PAGE) query.per_page = String(perPage);
    if (q) query.q = q;
    if (search) query.search = search;

    return query;
}

// Lấy sản phẩm display giá.
function getProductDisplayPrice(product) {
    const priceCandidates = [
        product?.display_price,
        product?.final_price,
        product?.price
    ];

    for (const candidate of priceCandidates) {
        const parsedValue = Number(candidate);
        if (Number.isFinite(parsedValue)) {
            return parsedValue;
        }
    }

    return 0;
}

// Lấy sản phẩm average rating.
function getProductAverageRating(product) {
    const parsedValue = Number(product?.average_rating);
    return Number.isFinite(parsedValue) ? parsedValue : 0;
}

// Lấy sản phẩm promotion trạng thái.
function getProductPromotionStatus(product) {
    return String(product?.promotion_status || 'none').trim();
}

// Xử lý matches promotion filter.
function matchesPromotionFilter(product, promotions = []) {
    const selectedPromotions = Array.isArray(promotions)
        ? promotions
        : (promotions ? [promotions] : []);

    if (selectedPromotions.length === 0) {
        return true;
    }

    const promotionStatus = getProductPromotionStatus(product);
    return selectedPromotions.some((promotion) => (
        promotion === 'active_or_upcoming'
            ? (promotionStatus === 'active' || promotionStatus === 'upcoming')
            : promotionStatus === promotion
    ));
}

// Xử lý matches catalog filters.
function matchesCatalogFilters(product, filters = {}) {
    if (!product) {
        return false;
    }

    const categoryIds = Array.isArray(filters.category_ids)
        ? filters.category_ids
        : (filters.category_id ? [filters.category_id] : []);
    if (categoryIds.length > 0 && !categoryIds.some((categoryId) => Number(product.category_id) === Number(categoryId))) {
        return false;
    }

    const displayPrice = getProductDisplayPrice(product);
    const priceRanges = Array.isArray(filters.price_ranges) ? filters.price_ranges : [];
    if (priceRanges.length > 0) {
        const isMatchedPriceRange = priceRanges.some((range) => {
            const minValue = range?.min ?? null;
            const maxValue = range?.max ?? null;

            if (minValue !== null && displayPrice < Number(minValue)) {
                return false;
            }

            if (maxValue !== null && displayPrice > Number(maxValue)) {
                return false;
            }

            return true;
        });

        if (!isMatchedPriceRange) {
            return false;
        }
    } else {
        if (filters.min_price !== undefined && filters.min_price !== null && displayPrice < Number(filters.min_price)) {
            return false;
        }

        if (filters.max_price !== undefined && filters.max_price !== null && displayPrice > Number(filters.max_price)) {
            return false;
        }
    }

    const ratingFilters = Array.isArray(filters.ratings)
        ? filters.ratings
        : (filters.rating !== undefined && filters.rating !== null ? [filters.rating] : []);
    if (ratingFilters.length > 0) {
        const averageRating = getProductAverageRating(product);
        const isMatchedRating = ratingFilters.some((ratingValue) => averageRating >= Number(ratingValue));
        if (!isMatchedRating) {
            return false;
        }
    }

    return matchesPromotionFilter(product, filters.promotions || filters.promotion);
}

// So sánh catalog sản phẩm.
function compareCatalogProducts(left, right, currentSort) {
    if (currentSort === 'best-selling') {
        return (Number(right?.sold_count) || 0) - (Number(left?.sold_count) || 0);
    }

    if (currentSort === 'price-asc') {
        return getProductDisplayPrice(left) - getProductDisplayPrice(right);
    }

    if (currentSort === 'price-desc') {
        return getProductDisplayPrice(right) - getProductDisplayPrice(left);
    }

    if (currentSort === 'name-asc') {
        return String(left?.name || '').localeCompare(String(right?.name || ''), 'vi', { sensitivity: 'base' });
    }

    if (currentSort === 'name-desc') {
        return String(right?.name || '').localeCompare(String(left?.name || ''), 'vi', { sensitivity: 'base' });
    }

    const leftCreatedAt = new Date(left?.created_at || 0).getTime();
    const rightCreatedAt = new Date(right?.created_at || 0).getTime();
    return rightCreatedAt - leftCreatedAt;
}

// Sắp xếp catalog sản phẩm.
function sortCatalogProducts(products = [], currentSort = 'newest') {
    return [...products].sort((left, right) => {
        const primaryComparison = compareCatalogProducts(left, right, currentSort);
        if (primaryComparison !== 0) {
            return primaryComparison;
        }

        return Number(right?.id || 0) - Number(left?.id || 0);
    });
}

// Tạo dữ liệu catalog view dữ liệu.
function buildCatalogViewData({
    category = null,
    categories = [],
    products = [],
    currentSort = 'newest',
    pagination,
    paginationPath,
    paginationQuery,
    user = null,
    isSalePage = false,
    query = '',
    search = '',
    filters = {}
} = {}) {
    return {
        category,
        categories,
        products,
        currentSort,
        currentPage: pagination.currentPage,
        totalPages: pagination.totalPages,
        totalItems: pagination.totalItems,
        perPage: pagination.perPage,
        perPageOptions: PER_PAGE_OPTIONS,
        paginationPath,
        paginationQuery,
        path: paginationPath,
        filters,
        filterRatingOptions: CATALOG_RATING_OPTIONS,
        filterPriceRanges: CATALOG_PRICE_RANGES,
        query,
        search,
        user,
        isSalePage
    };
}

// Chuẩn hóa đánh giá comment.
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

// Chuẩn hóa remove media ids.
function normalizeRemoveMediaIds(value) {
    return [...new Set(
        (Array.isArray(value) ? value : [value])
            .map((mediaId) => Number.parseInt(mediaId, 10))
            .filter((mediaId) => Number.isInteger(mediaId))
    )];
}

// Đếm đánh giá media theo type.
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

// Kiểm tra đánh giá media selection valid.
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

// Dọn dẹp uploaded đánh giá media.
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

// Xử lý contains html markup.
function containsHtmlMarkup(value) {
    return /<\/?[a-z][\s\S]*>/i.test(value);
}

// Định dạng sản phẩm description.
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

// Lấy đánh giá feedback.
function getReviewFeedback(code) {
    return REVIEW_FEEDBACK_MESSAGES[code] || null;
}

// Tạo dữ liệu sản phẩm đánh giá điều hướng.
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
        const storefrontSettings = normalizeStorefrontSettings(
            req.storefrontSettings || res.locals.storefrontSettings || {}
        );

        // Lấy danh sách banner đang hoạt động (cho carousel)
        const banners = await Banner.getActiveBanners().catch(err => {
            console.error('Banner error:', err);
            return []; // Trả về mảng rỗng nếu lỗi
        });

        // Lấy 3 danh mục hàng đầu
        const categories = await Category.getTopCategories(storefrontSettings.home_category_showcase_count).catch(err => {
            console.error('Category error:', err);
            // Dữ liệu mẫu fallback nếu lỗi database
            return [
                { id: 1, name: 'Thời Trang Nam', slug: 'nam', product_count: 5 },
                { id: 2, name: 'Thời Trang Nữ', slug: 'nu', product_count: 5 },
                { id: 3, name: 'Thời Trang Trẻ Em', slug: 'tre-em', product_count: 4 }
            ];
        });

        // Lấy 8 sản phẩm mới nhất
        const newProducts = await Product.getNewProducts(10).catch(err => {
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
        const bestSellers = await Product.getBestSellers(10).catch(err => {
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
            storefrontSettings,
            user: req.user || null
        });
    } catch (error) {
        console.error('Homepage error:', error);
        res.status(500).render('error', { message: 'Unable to load homepage', user: req.user || null });
    }
};

// Tạo sản phẩm đánh giá.
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

// Cập nhật sản phẩm đánh giá.
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
        return res.redirect(buildProductReviewRedirect(product.slug || fallbackSlug, 'updated'));
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
        const {
            category,
            search,
            price_range,
            min_price,
            max_price,
            sort,
            page = 1,
            per_page,
            rating,
            promotion,
            sale
        } = req.query;

        const requestedPage = normalizePositiveInteger(page, 1);
        const normalizedPerPage = normalizePerPage(per_page);
        const sortOption = parseCatalogSort(sort);
        const normalizedPromotions = normalizePromotionFilters(promotion, sale);
        const normalizedRatings = normalizeRatingFilters(rating);
        const normalizedPricePresets = normalizePriceRangeFilters(price_range);
        const { minPrice, maxPrice } = normalizePriceRange(min_price, max_price);
        const effectivePriceRanges = buildEffectivePriceRanges(normalizedPricePresets, minPrice, maxPrice);
        const categories = await loadCatalogCategories();
        const categoryMaps = createCatalogCategoryMaps(categories);
        const selectedCategorySlugs = normalizeCategoryFilters(category, categories);
        const selectedCategories = selectedCategorySlugs
            .map((slug) => categoryMaps.categoryBySlug.get(String(slug)))
            .filter(Boolean);
        const effectiveCategoryIds = resolveCategoryFilterIds(selectedCategorySlugs, categoryMaps);
        const selectedCategory = selectedCategories.length === 1 ? selectedCategories[0] : null;

        const baseFilters = {
            sort_by: sortOption.sort_by,
            sort_order: sortOption.sort_order,
            prioritize_in_stock: true,
            use_final_price: true
        };

        if (effectiveCategoryIds.length === 1) {
            baseFilters.category_id = effectiveCategoryIds[0];
        } else if (effectiveCategoryIds.length > 1) {
            baseFilters.category_ids = effectiveCategoryIds;
        }

        if (search) {
            baseFilters.search = search;
        }

        if (effectivePriceRanges.length > 0) {
            baseFilters.price_ranges = effectivePriceRanges;
        }

        if (normalizedRatings.length > 0) {
            baseFilters.ratings = normalizedRatings;
            baseFilters.rating = Math.min(...normalizedRatings);
        }

        if (normalizedPromotions.length > 0) {
            baseFilters.promotions = normalizedPromotions;
            baseFilters.promotion = normalizedPromotions.length === 1
                ? normalizedPromotions[0]
                : normalizedPromotions;
        }

        let totalItems = 0;
        try {
            totalItems = await Product.count(baseFilters);
        } catch (error) {
            console.error('Product count error:', error);
        }

        let pagination = buildPagination(totalItems, requestedPage, normalizedPerPage);
        let products = [];

        try {
            products = await Product.findAll({
                ...baseFilters,
                limit: pagination.perPage,
                offset: pagination.offset
            });
        } catch (error) {
            console.error('Product findAll error:', error);
            products = [
                { id: 1, name: 'Áo Polo Classic Nam', slug: 'ao-polo-classic', price: 450000, final_price: 225000, display_price: 225000, primary_image: 'https://images.unsplash.com/photo-1586790170083-2f9ceadc732d?w=600', average_rating: 4.8, sold_count: 1200, review_count: 8, promotion_status: 'active' },
                { id: 2, name: 'Đầm Maxi Hoa', slug: 'dam-maxi-hoa', price: 750000, final_price: 592500, display_price: 592500, primary_image: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=600', average_rating: 4.6, sold_count: 340, review_count: 6, promotion_status: 'active' },
                { id: 3, name: 'Áo Thun Basic', slug: 'ao-thun-basic', price: 250000, final_price: 250000, display_price: 250000, primary_image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600', average_rating: 0, sold_count: 0, review_count: 0, promotion_status: 'none' },
                { id: 4, name: 'Váy Công Sở', slug: 'vay-cong-so', price: 420000, final_price: 420000, display_price: 420000, primary_image: 'https://images.unsplash.com/photo-1594633313593-bab3825d0caf?w=600', average_rating: 4.9, sold_count: 78, review_count: 5, promotion_status: 'upcoming' }
            ].filter((product) => matchesCatalogFilters(product, baseFilters));

            if (totalItems === 0) {
                totalItems = products.length;
                pagination = buildPagination(totalItems, requestedPage, normalizedPerPage);
                products = products.slice(pagination.offset, pagination.offset + pagination.perPage);
            }
        }

        const filterState = {
            category: selectedCategorySlugs,
            price_ranges: normalizedPricePresets.map((range) => range.key),
            min_price: minPrice !== null ? String(minPrice) : '',
            max_price: maxPrice !== null ? String(maxPrice) : '',
            rating: normalizedRatings.map((value) => String(value)),
            promotion: normalizedPromotions,
            currentSort: sortOption.currentSort,
            perPage: pagination.perPage,
            search: search || ''
        };
        const paginationQuery = buildCatalogQueryState({
            categorySlugs: selectedCategorySlugs,
            priceRanges: normalizedPricePresets.map((range) => range.key),
            minPrice,
            maxPrice,
            ratings: normalizedRatings,
            promotions: normalizedPromotions,
            currentSort: sortOption.currentSort,
            perPage: pagination.perPage,
            search
        });
        const isSalePage = isSaleFilterActive(normalizedPromotions);

        // Return JSON if requested (for AJAX)
        if (req.headers.accept && req.headers.accept.includes('application/json')) {
            return res.json({
                products,
                currentPage: pagination.currentPage,
                perPage: pagination.perPage,
                totalPages: pagination.totalPages,
                totalItems: pagination.totalItems
            });
        }

        // Render trang danh sách sản phẩm
        res.render('products/list', buildCatalogViewData({
            category: selectedCategory,
            categories,
            products,
            currentSort: sortOption.currentSort,
            pagination,
            paginationPath: '/products',
            paginationQuery,
            user: req.user || null,
            isSalePage,
            search,
            filters: filterState
        }));
    } catch (error) {
        console.error('Product listing error:', error);
        res.status(500).render('error', { message: 'Lỗi tải danh sách sản phẩm: ' + error.message, user: req.user || null });
    }
};

// Lấy cho you.
exports.getForYou = async (req, res) => {
    try {
        const recommendations = req.user
            ? await Product.getForYouRecommendations(req.user.id, 30)
            : [];

        res.render('products/for-you', {
            products: recommendations,
            hasPurchaseHistory: recommendations.length > 0,
            user: req.user || null,
            path: '/products/for-you'
        });
    } catch (error) {
        console.error('For You error:', error);
        res.status(500).render('error', {
            message: 'Lỗi tải gợi ý dành cho bạn: ' + error.message,
            user: req.user || null
        });
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
                offset: 0,
                prioritize_in_stock: true
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
        const {
            q,
            page = 1,
            per_page,
            sort,
            category,
            price_range,
            min_price,
            max_price,
            rating,
            promotion,
            sale
        } = req.query;

        // Redirect về trang danh sách nếu không có từ khóa
        if (!q) {
            return res.redirect('/products');
        }

        const requestedPage = normalizePositiveInteger(page, 1);
        const normalizedPerPage = normalizePerPage(per_page);
        const sortOption = parseCatalogSort(sort);
        const normalizedPromotions = normalizePromotionFilters(promotion, sale);
        const normalizedRatings = normalizeRatingFilters(rating);
        const normalizedPricePresets = normalizePriceRangeFilters(price_range);
        const { minPrice, maxPrice } = normalizePriceRange(min_price, max_price);
        const effectivePriceRanges = buildEffectivePriceRanges(normalizedPricePresets, minPrice, maxPrice);
        const categories = await loadCatalogCategories();
        const categoryMaps = createCatalogCategoryMaps(categories);
        const selectedCategorySlugs = normalizeCategoryFilters(category, categories);
        const selectedCategories = selectedCategorySlugs
            .map((slug) => categoryMaps.categoryBySlug.get(String(slug)))
            .filter(Boolean);
        const effectiveCategoryIds = resolveCategoryFilterIds(selectedCategorySlugs, categoryMaps);
        const selectedCategory = selectedCategories.length === 1 ? selectedCategories[0] : null;
        const activeProductCount = await Product.count().catch(() => 0);
        const searchPoolSize = Math.max(activeProductCount, normalizedPerPage, 20);
        const allProducts = await Product.search(q, searchPoolSize);
        const filteredProducts = sortCatalogProducts(
            allProducts.filter((product) => matchesCatalogFilters(product, {
                category_ids: effectiveCategoryIds,
                price_ranges: effectivePriceRanges,
                ratings: normalizedRatings,
                promotions: normalizedPromotions
            })),
            sortOption.currentSort
        );
        const pagination = buildPagination(filteredProducts.length, requestedPage, normalizedPerPage);
        const products = filteredProducts.slice(pagination.offset, pagination.offset + pagination.perPage);
        const filterState = {
            category: selectedCategorySlugs,
            price_ranges: normalizedPricePresets.map((range) => range.key),
            min_price: minPrice !== null ? String(minPrice) : '',
            max_price: maxPrice !== null ? String(maxPrice) : '',
            rating: normalizedRatings.map((value) => String(value)),
            promotion: normalizedPromotions,
            currentSort: sortOption.currentSort,
            perPage: pagination.perPage,
            q
        };
        const paginationQuery = buildCatalogQueryState({
            categorySlugs: selectedCategorySlugs,
            priceRanges: normalizedPricePresets.map((range) => range.key),
            minPrice,
            maxPrice,
            ratings: normalizedRatings,
            promotions: normalizedPromotions,
            currentSort: sortOption.currentSort,
            perPage: pagination.perPage,
            q
        });

        // Render trang kết quả
        res.render('products/search-results', buildCatalogViewData({
            category: selectedCategory,
            categories,
            products,
            currentSort: sortOption.currentSort,
            pagination,
            paginationPath: '/products/search',
            paginationQuery,
            user: req.user || null,
            isSalePage: isSaleFilterActive(normalizedPromotions),
            query: q,
            filters: filterState
        }));
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
        const {
            sort,
            page = 1,
            per_page,
            category: categoryFilters,
            price_range,
            min_price,
            max_price,
            rating,
            promotion,
            sale
        } = req.query;

        // Tìm danh mục theo slug
        let category = await findCategoryBySlugWithFallback(slug);
        const categories = await loadCatalogCategories();
        const categoryMaps = createCatalogCategoryMaps(categories);

        // Trả về 404 nếu không tìm thấy danh mục
        if (!category) {
            return res.status(404).render('error', {
                message: 'Không tìm thấy danh mục: ' + slug,
                user: req.user || null
            });
        }

        const requestedPage = normalizePositiveInteger(page, 1);
        const normalizedPerPage = normalizePerPage(per_page);
        const sortOption = parseCatalogSort(sort);
        const normalizedPromotions = normalizePromotionFilters(promotion, sale);
        const normalizedRatings = normalizeRatingFilters(rating);
        const normalizedPricePresets = normalizePriceRangeFilters(price_range);
        const { minPrice, maxPrice } = normalizePriceRange(min_price, max_price);
        const scopedRootCategory = category.parent_id
            ? (categoryMaps.getRootCategory(category) || category)
            : category;
        const scopedCategories = scopedRootCategory
            ? categoryMaps.getChildren(scopedRootCategory.id)
            : [];
        const normalizedScopedCategorySlugs = normalizeCategoryFilters(categoryFilters, scopedCategories);
        const selectedCategorySlugs = normalizedScopedCategorySlugs.length > 0
            ? normalizedScopedCategorySlugs
            : (category.parent_id ? [category.slug] : []);
        const defaultCategoryIds = category.parent_id
            ? [category.id]
            : categoryMaps.getDescendantIds(category.id);
        const effectiveCategoryIds = resolveCategoryFilterIds(selectedCategorySlugs, categoryMaps, defaultCategoryIds);
        const effectivePriceRanges = buildEffectivePriceRanges(normalizedPricePresets, minPrice, maxPrice);

        // Lấy sản phẩm thuộc danh mục
        let products = [];
        let totalItems = 0;
        let pagination = buildPagination(totalItems, requestedPage, normalizedPerPage);
        const baseFilters = {
            sort_by: sortOption.sort_by,
            sort_order: sortOption.sort_order,
            prioritize_in_stock: true,
            use_final_price: true
        };

        if (effectiveCategoryIds.length === 1) {
            baseFilters.category_id = effectiveCategoryIds[0];
        } else if (effectiveCategoryIds.length > 1) {
            baseFilters.category_ids = effectiveCategoryIds;
        }

        if (effectivePriceRanges.length > 0) {
            baseFilters.price_ranges = effectivePriceRanges;
        }

        if (normalizedRatings.length > 0) {
            baseFilters.ratings = normalizedRatings;
            baseFilters.rating = Math.min(...normalizedRatings);
        }

        if (normalizedPromotions.length > 0) {
            baseFilters.promotions = normalizedPromotions;
            baseFilters.promotion = normalizedPromotions.length === 1
                ? normalizedPromotions[0]
                : normalizedPromotions;
        }

        try {
            totalItems = await Product.count(baseFilters);
            pagination = buildPagination(totalItems, requestedPage, normalizedPerPage);
        } catch (err) {
            console.error('Product count error:', err);
        }

        try {
            products = await Product.findAll({
                ...baseFilters,
                limit: pagination.perPage,
                offset: pagination.offset
            });
        } catch (err) {
            console.error('Product findAll error:', err);
            products = []; // Trả về mảng rỗng nếu lỗi
        }

        // Nếu là AJAX request, trả về JSON
        if (req.xhr || req.headers.accept?.includes('application/json')) {
            return res.json({
                products,
                category,
                currentPage: pagination.currentPage,
                perPage: pagination.perPage,
                totalPages: pagination.totalPages,
                totalItems: pagination.totalItems
            });
        }

        const filterState = {
            category: selectedCategorySlugs,
            price_ranges: normalizedPricePresets.map((range) => range.key),
            min_price: minPrice !== null ? String(minPrice) : '',
            max_price: maxPrice !== null ? String(maxPrice) : '',
            rating: normalizedRatings.map((value) => String(value)),
            promotion: normalizedPromotions,
            currentSort: sortOption.currentSort,
            perPage: pagination.perPage
        };
        const paginationQuery = buildCatalogQueryState({
            categorySlugs: selectedCategorySlugs,
            priceRanges: normalizedPricePresets.map((range) => range.key),
            minPrice,
            maxPrice,
            ratings: normalizedRatings,
            promotions: normalizedPromotions,
            currentSort: sortOption.currentSort,
            perPage: pagination.perPage
        });

        // Render trang danh mục
        res.render('products/category', buildCatalogViewData({
            category,
            categories,
            products,
            currentSort: sortOption.currentSort,
            pagination,
            paginationPath: `/products/category/${category.slug}`,
            paginationQuery,
            user: req.user || null,
            isSalePage: isSaleFilterActive(normalizedPromotions),
            filters: filterState
        }));
    } catch (error) {
        console.error('Category products error:', error);
        res.status(500).render('error', {
            message: 'Lỗi tải sản phẩm theo danh mục: ' + error.message,
            user: req.user || null
        });
    }
};
