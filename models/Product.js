/**
 * =============================================================================
 * PRODUCT MODEL - Model Sản phẩm
 * =============================================================================
 * File này chứa các phương thức tương tác với bảng products trong database:
 * - Lấy danh sách sản phẩm với bộ lọc và phân trang
 * - Tìm sản phẩm theo ID, slug
 * - Tìm kiếm sản phẩm
 * - Tính giá sau khuyến mãi
 * - Lấy sản phẩm bán chạy, mới nhất, nổi bật
 * - CRUD sản phẩm (Tạo, Đọc, Cập nhật, Xóa)
 * - Quản lý ảnh sản phẩm
 * - Cập nhật tồn kho
 * =============================================================================
 */

const pool = require('../config/database');

class Product {
    // Lấy optimized card ảnh URL.
    static getOptimizedCardImageUrl(imageUrl) {
        if (!imageUrl || typeof imageUrl !== 'string') {
            return imageUrl;
        }

        if (!imageUrl.includes('res.cloudinary.com') || !imageUrl.includes('/upload/')) {
            return imageUrl;
        }

        return imageUrl.replace(
            '/upload/',
            '/upload/f_auto,q_auto,c_fill,g_auto,w_720,h_960/'
        );
    }

    // Thao tác với to number.
    static toNumber(value, fallback = 0) {
        const numericValue = Number(value);
        return Number.isFinite(numericValue) ? numericValue : fallback;
    }

    // Chuẩn hóa sản phẩm numbers.
    static normalizeProductNumbers(product) {
        if (!product || typeof product !== 'object') {
            return product;
        }

        if (Object.prototype.hasOwnProperty.call(product, 'price')) {
            product.price = this.toNumber(product.price);
        }

        if (Object.prototype.hasOwnProperty.call(product, 'sale_value') && product.sale_value !== null) {
            product.sale_value = this.toNumber(product.sale_value);
        }

        if (Object.prototype.hasOwnProperty.call(product, 'stock_quantity') && product.stock_quantity !== null) {
            product.stock_quantity = Math.max(0, Number.parseInt(product.stock_quantity, 10) || 0);
        }

        if (Object.prototype.hasOwnProperty.call(product, 'final_price') && product.final_price !== null) {
            product.final_price = this.toNumber(product.final_price);
        }

        if (Object.prototype.hasOwnProperty.call(product, 'average_rating') && product.average_rating !== null) {
            product.average_rating = this.toNumber(product.average_rating);
        }

        if (Object.prototype.hasOwnProperty.call(product, 'review_count') && product.review_count !== null) {
            product.review_count = Math.max(0, Number.parseInt(product.review_count, 10) || 0);
        }

        if (Object.prototype.hasOwnProperty.call(product, 'sold_count') && product.sold_count !== null) {
            product.sold_count = Math.max(0, Number.parseInt(product.sold_count, 10) || 0);
        }

        return product;
    }

    // Chuẩn hóa biến thể numbers.
    static normalizeVariantNumbers(variants = []) {
        variants.forEach((variant) => {
            if (!variant || typeof variant !== 'object') {
                return;
            }

            if (Object.prototype.hasOwnProperty.call(variant, 'additional_price')) {
                variant.additional_price = this.toNumber(variant.additional_price);
            }

            if (Object.prototype.hasOwnProperty.call(variant, 'stock_quantity') && variant.stock_quantity !== null) {
                variant.stock_quantity = Math.max(0, Number.parseInt(variant.stock_quantity, 10) || 0);
            }
        });

        return variants;
    }

    // Thao tác với hydrate listing sản phẩm.
    static hydrateListingProducts(products = []) {
        products.forEach((product) => {
            this.normalizeProductNumbers(product);
            product.final_price = this.calculateFinalPrice(product.price, product.sale_type, product.sale_value);
            product.promotion_status = product.promotion_status || 'none';
            product.display_price = product.final_price;
            product.is_on_sale = product.promotion_status === 'active';
            product.has_upcoming_promotion = product.promotion_status === 'upcoming';
            product.card_image = this.getOptimizedCardImageUrl(product.primary_image);
        });

        return products;
    }

    // Lấy đang bật khuyến mãi condition.
    static getActiveSaleCondition(saleAlias = 'sale_ref', nowExpression = 'NOW()') {
        return `(
            ${saleAlias}.id IS NOT NULL
            AND ${saleAlias}.is_active = TRUE
            AND (${saleAlias}.start_date IS NULL OR ${nowExpression} >= ${saleAlias}.start_date)
            AND (${saleAlias}.end_date IS NULL OR ${nowExpression} <= ${saleAlias}.end_date)
        )`;
    }

    // Lấy upcoming khuyến mãi condition.
    static getUpcomingSaleCondition(saleAlias = 'sale_ref', nowExpression = 'NOW()') {
        return `(
            ${saleAlias}.id IS NOT NULL
            AND ${saleAlias}.is_active = TRUE
            AND ${saleAlias}.start_date IS NOT NULL
            AND ${nowExpression} < ${saleAlias}.start_date
        )`;
    }

    // Lấy promotion trạng thái expression.
    static getPromotionStatusExpression(saleAlias = 'sale_ref', nowExpression = 'NOW()') {
        const activeCondition = this.getActiveSaleCondition(saleAlias, nowExpression);
        const upcomingCondition = this.getUpcomingSaleCondition(saleAlias, nowExpression);

        return `CASE
            WHEN ${activeCondition} THEN 'active'
            WHEN ${upcomingCondition} THEN 'upcoming'
            ELSE 'none'
        END`;
    }

    // Lấy display giá expression.
    static getDisplayPriceExpression(productAlias = 'p', saleAlias = 'sale_ref', nowExpression = 'NOW()') {
        const activeCondition = this.getActiveSaleCondition(saleAlias, nowExpression);

        return `CASE
            WHEN ${activeCondition} AND ${saleAlias}.type = 'percentage' AND ${saleAlias}.value IS NOT NULL
                THEN ${productAlias}.price * (1 - LEAST(GREATEST(${saleAlias}.value, 0), 100) / 100)
            WHEN ${activeCondition} AND ${saleAlias}.type = 'fixed' AND ${saleAlias}.value IS NOT NULL
                THEN GREATEST(0, ${productAlias}.price - ${saleAlias}.value)
            ELSE ${productAlias}.price
        END`;
    }

    // Lấy review aggregate select.
    static getReviewAggregateSelect(productAlias = 'p') {
        return `
                   COALESCE((
                       SELECT ROUND(AVG(r.rating), 1)
                       FROM reviews r
                       WHERE r.product_id = ${productAlias}.id
                         AND r.is_approved = TRUE
                   ), 0) as average_rating,
                   (
                       SELECT COUNT(*)
                       FROM reviews r
                       WHERE r.product_id = ${productAlias}.id
                         AND r.is_approved = TRUE
                   ) as review_count`;
    }

    // Lấy listing select fields.
    static getListingSelectFields(productAlias = 'p', categoryAlias = 'c', saleAlias = 'sale_ref', nowExpression = 'NOW()') {
        const activeCondition = this.getActiveSaleCondition(saleAlias, nowExpression);

        return `
                   ${productAlias}.*,
                   ${categoryAlias}.name as category_name,
                   ${categoryAlias}.slug as category_slug,
                   (SELECT image_url FROM product_images WHERE product_id = ${productAlias}.id AND is_primary = TRUE LIMIT 1) as primary_image,
                   (SELECT COUNT(*) FROM product_images WHERE product_id = ${productAlias}.id) as image_count,
                   CASE WHEN ${activeCondition} THEN ${saleAlias}.type ELSE NULL END as sale_type,
                   CASE WHEN ${activeCondition} THEN ${saleAlias}.value ELSE NULL END as sale_value,
                   CASE WHEN ${activeCondition} THEN ${saleAlias}.name ELSE NULL END as sale_name,
                   ${saleAlias}.start_date as promotion_start_date,
                   ${saleAlias}.end_date as promotion_end_date,
                   ${this.getPromotionStatusExpression(saleAlias, nowExpression)} as promotion_status,
${this.getReviewAggregateSelect(productAlias)},
${this.getVariantAggregateSelect(productAlias)}`;
    }

    // Lấy promotion filter clause.
    static getPromotionFilterClause(promotionFilter, saleAlias = 'sale_ref', nowExpression = 'NOW()') {
        const activeCondition = this.getActiveSaleCondition(saleAlias, nowExpression);
        const upcomingCondition = this.getUpcomingSaleCondition(saleAlias, nowExpression);
        const normalizedPromotions = this.normalizePromotionSelections(promotionFilter);

        if (normalizedPromotions.length === 0) {
            return '';
        }

        const promotionClauses = [];
        if (normalizedPromotions.includes('active')) {
            promotionClauses.push(activeCondition);
        }

        if (normalizedPromotions.includes('upcoming')) {
            promotionClauses.push(upcomingCondition);
        }

        if (promotionClauses.length === 0) {
            return '';
        }

        return ` AND (${promotionClauses.join(' OR ')})`;
    }

    // Lấy availability đơn hàng expression.
    static getAvailabilityOrderExpression(productAlias = 'p') {
        return `CASE WHEN ${productAlias}.stock_quantity > 0 THEN 0 ELSE 1 END`;
    }

    // Tạo dữ liệu đơn hàng theo clause.
    static buildOrderByClause(orderSegments = [], options = {}) {
        const {
            prioritizeInStock = false,
            productAlias = 'p'
        } = options;

        const clauses = [];

        if (prioritizeInStock) {
            clauses.push(`${this.getAvailabilityOrderExpression(productAlias)} ASC`);
        }

        clauses.push(...orderSegments.filter(Boolean));
        clauses.push(`${productAlias}.id DESC`);

        return clauses.join(', ');
    }

    // Lấy biến thể aggregate select.
    static getVariantAggregateSelect(productAlias = 'p') {
        return `
                   (
                       SELECT GROUP_CONCAT(DISTINCT NULLIF(TRIM(pv.color), '') ORDER BY pv.color SEPARATOR ', ')
                       FROM product_variants pv
                       WHERE pv.product_id = ${productAlias}.id
                   ) as variant_colors,
                   (
                       SELECT GROUP_CONCAT(DISTINCT NULLIF(TRIM(pv.size), '') ORDER BY pv.size SEPARATOR ', ')
                       FROM product_variants pv
                       WHERE pv.product_id = ${productAlias}.id
                   ) as variant_sizes`;
    }

    // Tạo dữ liệu search filter clause.
    static buildSearchFilterClause(searchValue, params = [], productAlias = 'p', options = {}) {
        const normalizedSearch = String(searchValue || '').trim();
        if (!normalizedSearch) {
            return '';
        }

        // accentSensitive (default true): dùng BINARY LOWER() phân biệt dấu tiếng Việt
        // Tắt khi caller đã strip dấu (ví dụ chatbot intent search)
        const accentSensitive = options.accentSensitive !== false;

        const searchBase = accentSensitive ? normalizedSearch.toLowerCase() : normalizedSearch;
        const exactSearchTerm = `%${searchBase}%`;
        const terms = Array.from(new Set(
            searchBase
                .split(/\s+/)
                .map((term) => term.trim())
                .filter((term) => term.length >= 2)
        )).slice(0, 8);

        const safeLike = accentSensitive
            ? (field) => `BINARY LOWER(${field}) LIKE ?`
            : (field) => `${field} LIKE ?`;

        const productFieldClause = `(
            ${safeLike(`${productAlias}.name`)}
            OR ${safeLike(`${productAlias}.description`)}
            OR ${safeLike(`${productAlias}.sku`)}
            OR EXISTS (
                SELECT 1
                FROM product_variants pv
                WHERE pv.product_id = ${productAlias}.id
                  AND (
                      ${safeLike('pv.color')}
                      OR ${safeLike('pv.size')}
                      OR ${safeLike('pv.sku')}
                  )
            )
        )`;

        const nameOnlyLike = safeLike(`${productAlias}.name`);

        const groups = [productFieldClause];
        params.push(
            exactSearchTerm,
            exactSearchTerm,
            exactSearchTerm,
            exactSearchTerm,
            exactSearchTerm,
            exactSearchTerm
        );

        if (terms.length > 1) {
            const allTermsClause = terms.map(() => productFieldClause).join(' AND ');
            const anyTermInName = terms.map(() => nameOnlyLike).join(' OR ');
            groups.push(`(${allTermsClause} AND (${anyTermInName}))`);
            terms.forEach((term) => {
                const likeTerm = `%${term}%`;
                params.push(likeTerm, likeTerm, likeTerm, likeTerm, likeTerm, likeTerm);
            });
            terms.forEach((term) => {
                params.push(`%${term}%`);
            });
        }

        return ` AND (${groups.join(' OR ')})`;
    }

    // Chuẩn hóa promotion selections.
    static normalizePromotionSelections(promotionFilter) {
        const rawValues = Array.isArray(promotionFilter) ? promotionFilter : [promotionFilter];
        const normalizedPromotions = new Set();

        rawValues.forEach((value) => {
            const normalizedValue = String(value || '').trim();

            if (normalizedValue === 'active_or_upcoming') {
                normalizedPromotions.add('active');
                normalizedPromotions.add('upcoming');
                return;
            }

            if (normalizedValue === 'active' || normalizedValue === 'upcoming') {
                normalizedPromotions.add(normalizedValue);
            }
        });

        return [...normalizedPromotions];
    }

    // Lấy effective rating threshold.
    static getEffectiveRatingThreshold(filters = {}) {
        if (Array.isArray(filters.ratings) && filters.ratings.length > 0) {
            const normalizedRatings = filters.ratings
                .map((value) => Number.parseInt(value, 10))
                .filter((value) => Number.isInteger(value) && value >= 1 && value <= 5);

            if (normalizedRatings.length > 0) {
                return Math.min(...normalizedRatings);
            }
        }

        const parsedRating = Number.parseInt(filters.rating, 10);
        return Number.isInteger(parsedRating) && parsedRating >= 1 && parsedRating <= 5
            ? parsedRating
            : null;
    }

    // Tạo dữ liệu danh mục filter clause.
    static buildCategoryFilterClause(filters = {}, params = [], productAlias = 'p') {
        const categoryIds = Array.isArray(filters.category_ids)
            ? filters.category_ids
            : (filters.category_id ? [filters.category_id] : []);
        const normalizedCategoryIds = [...new Set(
            categoryIds
                .map((value) => Number.parseInt(value, 10))
                .filter((value) => Number.isInteger(value) && value > 0)
        )];

        if (normalizedCategoryIds.length === 0) {
            return '';
        }

        if (normalizedCategoryIds.length === 1) {
            params.push(normalizedCategoryIds[0]);
            return ` AND ${productAlias}.category_id = ?`;
        }

        const placeholders = normalizedCategoryIds.map(() => '?').join(', ');
        params.push(...normalizedCategoryIds);
        return ` AND ${productAlias}.category_id IN (${placeholders})`;
    }

    // Chuẩn hóa giá ranges.
    static normalizePriceRanges(priceRanges = []) {
        const rawRanges = Array.isArray(priceRanges) ? priceRanges : [priceRanges];
        const normalizedRanges = [];
        const seenRanges = new Set();

        rawRanges.forEach((range) => {
            let minValue = range?.min ?? null;
            let maxValue = range?.max ?? null;

            if (typeof range === 'string') {
                const [rawMin = '', rawMax = ''] = range.split(':', 2);
                minValue = rawMin;
                maxValue = rawMax;
            }

            const parsedMin = minValue === '' || minValue === null || minValue === undefined
                ? null
                : Number(minValue);
            const parsedMax = maxValue === '' || maxValue === null || maxValue === undefined
                ? null
                : Number(maxValue);

            let normalizedMin = Number.isFinite(parsedMin) && parsedMin >= 0 ? parsedMin : null;
            let normalizedMax = Number.isFinite(parsedMax) && parsedMax >= 0 ? parsedMax : null;

            if (normalizedMin !== null && normalizedMax !== null && normalizedMin > normalizedMax) {
                [normalizedMin, normalizedMax] = [normalizedMax, normalizedMin];
            }

            if (normalizedMin === null && normalizedMax === null) {
                return;
            }

            const rangeKey = `${normalizedMin ?? ''}:${normalizedMax ?? ''}`;
            if (seenRanges.has(rangeKey)) {
                return;
            }

            seenRanges.add(rangeKey);
            normalizedRanges.push({
                min: normalizedMin,
                max: normalizedMax
            });
        });

        return normalizedRanges;
    }

    // Tạo dữ liệu giá filter clause.
    static buildPriceFilterClause(filters = {}, params = [], priceColumn = 'p.price') {
        const normalizedPriceRanges = this.normalizePriceRanges(filters.price_ranges);

        if (normalizedPriceRanges.length > 0) {
            const priceClauses = normalizedPriceRanges.map((range) => {
                const rangeClauses = [];

                if (range.min !== null) {
                    rangeClauses.push(`${priceColumn} >= ?`);
                    params.push(range.min);
                }

                if (range.max !== null) {
                    rangeClauses.push(`${priceColumn} <= ?`);
                    params.push(range.max);
                }

                return rangeClauses.length > 1
                    ? `(${rangeClauses.join(' AND ')})`
                    : rangeClauses[0];
            }).filter(Boolean);

            if (priceClauses.length > 0) {
                return ` AND (${priceClauses.join(' OR ')})`;
            }
        }

        let clause = '';
        if (filters.min_price !== undefined && filters.min_price !== null && filters.min_price !== '') {
            clause += ` AND ${priceColumn} >= ?`;
            params.push(filters.min_price);
        }

        if (filters.max_price !== undefined && filters.max_price !== null && filters.max_price !== '') {
            clause += ` AND ${priceColumn} <= ?`;
            params.push(filters.max_price);
        }

        return clause;
    }

    // Thao tác với group review media theo review ID.
    static groupReviewMediaByReviewId(mediaRows = []) {
        const mediaMap = new Map();

        mediaRows.forEach((media) => {
            if (!mediaMap.has(media.review_id)) {
                mediaMap.set(media.review_id, []);
            }

            mediaMap.get(media.review_id).push({
                id: media.id,
                review_id: media.review_id,
                media_type: media.media_type,
                media_url: media.media_url,
                public_id: media.public_id,
                display_order: Number.parseInt(media.display_order, 10) || 0,
                created_at: media.created_at || null
            });
        });

        return mediaMap;
    }

    // Lấy review media theo review ID.
    static async getReviewMediaByReviewIds(reviewIds = [], executor = pool) {
        if (!Array.isArray(reviewIds) || reviewIds.length === 0) {
            return new Map();
        }

        const placeholders = reviewIds.map(() => '?').join(', ');
        const [rows] = await executor.execute(
            `SELECT *
             FROM review_media
             WHERE review_id IN (${placeholders})
             ORDER BY display_order ASC, id ASC`,
            reviewIds
        );

        return this.groupReviewMediaByReviewId(rows);
    }

    // Thao tác với attach review media to reviews.
    static async attachReviewMediaToReviews(reviews = [], executor = pool) {
        if (!Array.isArray(reviews) || reviews.length === 0) {
            return reviews;
        }

        const reviewIds = [...new Set(
            reviews
                .map((review) => review?.id)
                .filter((reviewId) => Number.isInteger(Number(reviewId)))
        )];

        const mediaByReviewId = await this.getReviewMediaByReviewIds(reviewIds, executor);
        reviews.forEach((review) => {
            review.media = mediaByReviewId.get(review.id) || [];
        });

        return reviews;
    }

    // Chuẩn hóa review media input.
    static normalizeReviewMediaInput(mediaItems = []) {
        if (!Array.isArray(mediaItems)) {
            return [];
        }

        return mediaItems
            .map((media, index) => {
                const displayOrder = media?.displayOrder ?? media?.display_order;
                return {
                    mediaType: media?.mediaType || media?.media_type || null,
                    mediaUrl: media?.mediaUrl || media?.media_url || null,
                    publicId: media?.publicId || media?.public_id || null,
                    displayOrder: Number.isInteger(Number(displayOrder))
                        ? Number(displayOrder)
                        : index
                };
            })
            .filter((media) => media.mediaType && media.mediaUrl);
    }

    // Thao tác với insert review media.
    static async insertReviewMedia(connection, reviewId, mediaItems = []) {
        const normalizedMedia = this.normalizeReviewMediaInput(mediaItems);

        if (normalizedMedia.length === 0) {
            return [];
        }

        const placeholders = normalizedMedia.map(() => '(?, ?, ?, ?, ?)').join(', ');
        const params = [];

        normalizedMedia.forEach((media) => {
            params.push(
                reviewId,
                media.mediaType,
                media.mediaUrl,
                media.publicId,
                media.displayOrder
            );
        });

        await connection.execute(
            `INSERT INTO review_media (review_id, media_type, media_url, public_id, display_order)
             VALUES ${placeholders}`,
            params
        );

        return normalizedMedia.map((media) => ({
            review_id: reviewId,
            media_type: media.mediaType,
            media_url: media.mediaUrl,
            public_id: media.publicId,
            display_order: media.displayOrder
        }));
    }

    // =============================================================================
    // LẤY DANH SÁCH SẢN PHẨM - GET PRODUCTS LIST
    // =============================================================================

    /**
     * Lấy danh sách sản phẩm với bộ lọc và phân trang
     *
     * @description Query sản phẩm từ database với nhiều điều kiện lọc:
     *              danh mục, khoảng giá, từ khóa tìm kiếm, sản phẩm nổi bật.
     *              Kết quả bao gồm thông tin danh mục, ảnh chính và khuyến mãi.
     *
     * @param {Object} filters - Các điều kiện lọc
     * @param {number} [filters.category_id] - ID danh mục
     * @param {number} [filters.min_price] - Giá tối thiểu
     * @param {number} [filters.max_price] - Giá tối đa
     * @param {string} [filters.search] - Từ khóa tìm kiếm
     * @param {boolean} [filters.is_featured] - Chỉ lấy sản phẩm nổi bật
     * @param {string} [filters.sort_by='created_at'] - Sắp xếp theo trường
     * @param {string} [filters.sort_order='DESC'] - Thứ tự sắp xếp (ASC/DESC)
     * @param {number} [filters.limit=12] - Số sản phẩm mỗi trang
     * @param {number} [filters.offset=0] - Bỏ qua bao nhiêu sản phẩm
     *
     * @returns {Promise<Array>} Mảng sản phẩm với thông tin đầy đủ
     */
    static async findAll(filters = {}) {
        // Query cơ bản với JOIN để lấy thông tin liên quan
        let query = `
            SELECT p.*,
                   c.name as category_name,
                   c.slug as category_slug,
                   (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = TRUE LIMIT 1) as primary_image,
                   (SELECT COUNT(*) FROM product_images WHERE product_id = p.id) as image_count,
                   s.type as sale_type,
                   s.value as sale_value,
                   s.name as sale_name,
${this.getVariantAggregateSelect('p')}
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN sales s ON p.sale_id = s.id AND s.is_active = TRUE
                AND NOW() BETWEEN s.start_date AND s.end_date
            WHERE p.is_active = TRUE
        `;

        const params = [];

        // Lọc theo danh mục
        if (filters.category_id) {
            query += ' AND p.category_id = ?';
            params.push(filters.category_id);
        }

        // Lọc theo khoảng giá
        // use_final_price: lọc theo giá sau khuyến mãi (giá hiển thị) thay vì giá gốc
        const finalPriceExpr = `CASE
            WHEN s.type = 'percentage' AND s.value IS NOT NULL
                THEN p.price * (1 - s.value / 100)
            WHEN s.type = 'fixed' AND s.value IS NOT NULL
                THEN GREATEST(0, p.price - s.value)
            ELSE p.price
        END`;
        const priceCol = filters.use_final_price ? finalPriceExpr : 'p.price';
        if (filters.min_price) {
            query += ` AND ${priceCol} >= ?`;
            params.push(filters.min_price);
        }
        if (filters.max_price) {
            query += ` AND ${priceCol} <= ?`;
            params.push(filters.max_price);
        }

        // Tìm kiếm theo từ khóa (an toàn SQL injection)
        if (filters.search) {
            query += this.buildSearchFilterClause(filters.search, params, 'p', {
                accentSensitive: filters.accent_sensitive !== false
            });
        }

        // Lọc sản phẩm nổi bật
        if (filters.is_featured) {
            query += ' AND p.is_featured = TRUE';
        }

        // Lọc sản phẩm đang khuyến mãi (có sale_id và sale đang active)
        if (filters.on_sale) {
            query += ' AND p.sale_id IS NOT NULL AND s.is_active = TRUE AND NOW() BETWEEN s.start_date AND s.end_date';
        }

        // Xử lý sắp xếp (whitelist để tránh SQL injection)
        const sortField = filters.sort_by || 'created_at';
        const sortOrder = (filters.sort_order || 'DESC').toUpperCase();
        const prioritizeInStock = filters.prioritize_in_stock === true;
        const allowedSortFields = ['created_at', 'price', 'name', 'sold_count', 'view_count'];
        const allowedSortOrders = ['ASC', 'DESC'];

        const orderSegments = [];
        if (allowedSortFields.includes(sortField) && allowedSortOrders.includes(sortOrder.toUpperCase())) {
            orderSegments.push(`p.${sortField} ${sortOrder}`);
        } else {
            orderSegments.push('p.created_at DESC');
        }

        query += ` ORDER BY ${this.buildOrderByClause(orderSegments, {
            prioritizeInStock,
            productAlias: 'p'
        })}`;

        // Phuong thuc trang
        const limit = parseInt(filters.limit) || 12;
        const offset = parseInt(filters.offset) || 0;
        query += ` LIMIT ${limit} OFFSET ${offset}`;

        const [rows] = await pool.query(query, params);

        return this.hydrateListingProducts(rows);
    }

    // Đếm tổng số bản ghi.
    static async count(filters = {}) {
        let query = 'SELECT COUNT(*) AS total FROM products p WHERE p.is_active = TRUE';
        const params = [];

        if (filters.category_id) {
            query += ' AND p.category_id = ?';
            params.push(filters.category_id);
        }

        if (filters.min_price) {
            query += ' AND p.price >= ?';
            params.push(filters.min_price);
        }

        if (filters.max_price) {
            query += ' AND p.price <= ?';
            params.push(filters.max_price);
        }

        if (filters.search) {
            query += this.buildSearchFilterClause(filters.search, params, 'p');
        }

        if (filters.is_featured) {
            query += ' AND p.is_featured = TRUE';
        }

        if (filters.on_sale) {
            query += ` AND EXISTS (
                SELECT 1
                FROM sales s
                WHERE s.id = p.sale_id
                  AND s.is_active = TRUE
                  AND NOW() BETWEEN s.start_date AND s.end_date
            )`;
        }

        if (filters.stock_status === 'in_stock') {
            query += ' AND p.stock_quantity > 0';
        } else if (filters.stock_status === 'out_of_stock') {
            query += ' AND p.stock_quantity <= 0';
        }

        const [rows] = await pool.query(query, params);
        return rows[0]?.total || 0;
    }

    // Đếm tất cả records.
    static async countAllRecords() {
        const [rows] = await pool.query('SELECT COUNT(*) AS total FROM products');
        return rows[0]?.total || 0;
    }

    // Lấy theo ID.
    static async getByIds(ids = []) {
        const normalizedIds = Array.from(new Set(
            (Array.isArray(ids) ? ids : [])
                .map((id) => Number.parseInt(id, 10))
                .filter((id) => Number.isInteger(id) && id > 0)
        ));

        if (!normalizedIds.length) {
            return [];
        }

        const placeholders = normalizedIds.map(() => '?').join(', ');
        const [rows] = await pool.query(
            `SELECT p.*,
                    c.name as category_name,
                    c.slug as category_slug,
                    (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = TRUE LIMIT 1) as primary_image,
                    (SELECT COUNT(*) FROM product_images WHERE product_id = p.id) as image_count,
                    s.type as sale_type,
                    s.value as sale_value,
                    s.name as sale_name,
${this.getVariantAggregateSelect('p')}
             FROM products p
             LEFT JOIN categories c ON p.category_id = c.id
             LEFT JOIN sales s ON p.sale_id = s.id AND s.is_active = TRUE
                AND NOW() BETWEEN s.start_date AND s.end_date
             WHERE p.is_active = TRUE
               AND p.id IN (${placeholders})`,
            normalizedIds
        );

        const hydratedRows = this.hydrateListingProducts(rows);
        const productMap = new Map(hydratedRows.map((product) => [product.id, product]));

        return normalizedIds
            .map((id) => productMap.get(id))
            .filter(Boolean);
    }

    // Lấy đang bật chat catalog.
    static async getActiveChatCatalog() {
        const [rows] = await pool.query(
            `SELECT p.*,
                    c.name as category_name,
                    c.slug as category_slug,
                    (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = TRUE LIMIT 1) as primary_image,
                    (SELECT COUNT(*) FROM product_images WHERE product_id = p.id) as image_count,
                    s.type as sale_type,
                    s.value as sale_value,
                    s.name as sale_name,
${this.getVariantAggregateSelect('p')}
             FROM products p
             LEFT JOIN categories c ON p.category_id = c.id
             LEFT JOIN sales s ON p.sale_id = s.id AND s.is_active = TRUE
                AND NOW() BETWEEN s.start_date AND s.end_date
             WHERE p.is_active = TRUE
             ORDER BY ${this.buildOrderByClause(['p.created_at DESC'], {
                 prioritizeInStock: true,
                 productAlias: 'p'
             })}`
        );

        return this.hydrateListingProducts(rows);
    }

    // =============================================================================
    // TÌM SẢN PHẨM THEO ID - FIND BY ID
    // =============================================================================

    /**
     * Lấy thông tin chi tiết sản phẩm theo ID
     *
     * @description Lấy đầy đủ thông tin sản phẩm bao gồm:
     *              - Thông tin cơ bản và danh mục
     *              - Thông tin khuyến mãi đang áp dụng
     *              - Danh sách tất cả ảnh
     *              - Các biến thể (variants)
     *              - Đánh giá từ khách hàng
     *              - Tự động tăng lượt xem
     *
     * @param {number} id - ID sản phẩm
     *
     * @returns {Promise<Object|null>} Thông tin sản phẩm hoặc null nếu không tìm thấy
     */
    static async findById(id, options = {}) {
        const { incrementView = true } = options;

        // Query lấy thông tin sản phẩm với JOIN
        const query = `
            SELECT p.*,
                   c.name as category_name,
                   c.slug as category_slug,
                   s.type as sale_type,
                   s.value as sale_value,
                   s.name as sale_name,
                   s.end_date as sale_end_date
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN sales s ON p.sale_id = s.id AND s.is_active = TRUE
                AND NOW() BETWEEN s.start_date AND s.end_date
            WHERE p.id = ? AND p.is_active = TRUE
        `;

        const [rows] = await pool.execute(query, [id]);
        const product = rows[0];

        if (!product) return null;

        this.normalizeProductNumbers(product);

        // Lấy tất cả ảnh sản phẩm (ảnh chính lên đầu)
        const [images] = await pool.execute(
            'SELECT * FROM product_images WHERE product_id = ? ORDER BY is_primary DESC, display_order ASC',
            [id]
        );
        product.images = images;

        // Lấy các biến thể sản phẩm (size, color, etc.)
        const [variants] = await pool.execute(
            `SELECT pv.*, pi.image_url AS variant_image_url
             FROM product_variants pv
             LEFT JOIN product_images pi ON pi.id = pv.image_id
             WHERE pv.product_id = ?
             ORDER BY pv.color, pv.size, pv.id`,
            [id]
        );
        product.variants = this.normalizeVariantNumbers(variants);

        // Lấy đánh giá đã được duyệt kèm thông tin người dùng
        const [reviews] = await pool.execute(`
            SELECT r.*, u.full_name as user_name, u.avatar_url as user_avatar
            FROM reviews r
            JOIN users u ON r.user_id = u.id
            WHERE r.product_id = ? AND r.is_approved = TRUE
            ORDER BY r.created_at DESC
            LIMIT 10
        `, [id]);
        await this.attachReviewMediaToReviews(reviews);
        product.reviews = reviews;

        // Tính điểm đánh giá trung bình
        if (reviews.length > 0) {
            product.average_rating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
            product.review_count = reviews.length;
        } else {
            product.average_rating = 0;
            product.review_count = 0;
        }

        // Tính giá cuối cùng sau khuyến mãi
        product.final_price = this.calculateFinalPrice(product.price, product.sale_type, product.sale_value);

        if (incrementView) {
            await pool.execute('UPDATE products SET view_count = view_count + 1 WHERE id = ?', [id]);
        }

        return product;
    }

    // =============================================================================
    // TÌM SẢN PHẨM THEO SLUG - FIND BY SLUG
    // =============================================================================

    /**
     * Tìm sản phẩm theo slug URL
     *
     * @description Tìm sản phẩm bằng slug thân thiện URL,
     *              sau đó gọi findById để lấy thông tin đầy đủ
     *
     * @param {string} slug - Slug URL của sản phẩm (VD: 'ao-polo-classic')
     *
     * @returns {Promise<Object|null>} Thông tin sản phẩm hoặc null
     */
    static async findBySlug(slug, options = {}) {
        const query = 'SELECT id FROM products WHERE slug = ? AND is_active = TRUE';
        const [rows] = await pool.execute(query, [slug]);
        if (rows[0]) {
            return await this.findById(rows[0].id, options);
        }
        return null;
    }

    // Lấy review context.
    static async getReviewContext(productId, userId) {
        if (!productId || !userId) {
            return {
                canReview: false,
                eligibleOrder: null,
                existingReview: null
            };
        }

        const [existingReviews] = await pool.execute(
            `SELECT r.*, o.order_code
             FROM reviews r
             LEFT JOIN orders o ON o.id = r.order_id
             WHERE r.product_id = ? AND r.user_id = ?
             ORDER BY r.created_at DESC
             LIMIT 1`,
            [productId, userId]
        );

        const existingReview = existingReviews[0] || null;
        if (existingReview) {
            await this.attachReviewMediaToReviews([existingReview]);
            return {
                canReview: false,
                eligibleOrder: null,
                existingReview
            };
        }

        const [eligibleOrders] = await pool.execute(
            `SELECT DISTINCT o.id, o.order_code, o.created_at
             FROM orders o
             JOIN order_items oi ON oi.order_id = o.id
             WHERE o.user_id = ?
               AND oi.product_id = ?
               AND o.status IN ('delivered', 'completed')
             ORDER BY o.created_at DESC
             LIMIT 1`,
            [userId, productId]
        );

        return {
            canReview: Boolean(eligibleOrders[0]),
            eligibleOrder: eligibleOrders[0] || null,
            existingReview: null
        };
    }

    // Tạo review.
    static async createReview({ productId, userId, orderId, rating, comment = '', isVerified = true, isApproved = true, media = [] }) {
        const trimmedComment = typeof comment === 'string' ? comment.trim() : '';
        const normalizedRating = Number.parseInt(rating, 10);
        const connection = await pool.getConnection();

        try {
            await connection.beginTransaction();

            const [result] = await connection.execute(
                `INSERT INTO reviews (product_id, user_id, order_id, rating, comment, is_verified, is_approved)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    productId,
                    userId,
                    orderId,
                    normalizedRating,
                    trimmedComment || null,
                    Boolean(isVerified),
                    Boolean(isApproved)
                ]
            );

            const insertedMedia = await this.insertReviewMedia(connection, result.insertId, media);
            await connection.commit();

            return {
                id: result.insertId,
                product_id: productId,
                user_id: userId,
                order_id: orderId,
                rating: normalizedRating,
                comment: trimmedComment,
                is_verified: Boolean(isVerified),
                is_approved: Boolean(isApproved),
                media: insertedMedia
            };
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    // Cập nhật review.
    static async updateReview({ reviewId, userId, rating, comment = '', removeMediaIds = [], media = [] }) {
        const normalizedRating = Number.parseInt(rating, 10);
        const trimmedComment = typeof comment === 'string' ? comment.trim() : '';
        const normalizedRemoveMediaIds = [...new Set(
            (Array.isArray(removeMediaIds) ? removeMediaIds : [removeMediaIds])
                .map((mediaId) => Number.parseInt(mediaId, 10))
                .filter((mediaId) => Number.isInteger(mediaId))
        )];
        const connection = await pool.getConnection();

        try {
            await connection.beginTransaction();

            const [reviews] = await connection.execute(
                `SELECT *
                 FROM reviews
                 WHERE id = ? AND user_id = ?
                 LIMIT 1`,
                [reviewId, userId]
            );

            const existingReview = reviews[0];
            if (!existingReview) {
                await connection.rollback();
                return null;
            }

            let removedMedia = [];
            if (normalizedRemoveMediaIds.length > 0) {
                const placeholders = normalizedRemoveMediaIds.map(() => '?').join(', ');
                const [mediaRows] = await connection.execute(
                    `SELECT *
                     FROM review_media
                     WHERE review_id = ?
                       AND id IN (${placeholders})
                     ORDER BY id ASC`,
                    [reviewId, ...normalizedRemoveMediaIds]
                );
                removedMedia = mediaRows;

                if (removedMedia.length > 0) {
                    const removableIds = removedMedia.map((mediaItem) => mediaItem.id);
                    const removablePlaceholders = removableIds.map(() => '?').join(', ');
                    await connection.execute(
                        `DELETE FROM review_media
                         WHERE review_id = ?
                           AND id IN (${removablePlaceholders})`,
                        [reviewId, ...removableIds]
                    );
                }
            }

            await connection.execute(
                `UPDATE reviews
                 SET rating = ?, comment = ?
                 WHERE id = ? AND user_id = ?`,
                [normalizedRating, trimmedComment || null, reviewId, userId]
            );

            const insertedMedia = await this.insertReviewMedia(connection, reviewId, media);
            await connection.commit();

            return {
                id: reviewId,
                rating: normalizedRating,
                comment: trimmedComment,
                removedMedia,
                media: insertedMedia
            };
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    // =============================================================================
    // TÌM KIẾM SẢN PHẨM - SEARCH PRODUCTS
    // =============================================================================

    /**
     * Tìm kiếm sản phẩm theo từ khóa (hỗ trợ fuzzy search)
     *
     * @description Tìm kiếm trong tên, mô tả và SKU sản phẩm.
     *              Hỗ trợ fuzzy search - tìm kiếm gần đúng khi:
     *              - Người dùng nhập sai chính tả
     *              - Không tìm thấy kết quả chính xác
     *              Kết quả được sắp xếp theo độ liên quan.
     *
     * @param {string} searchQuery - Từ khóa tìm kiếm
     * @param {number} [limit=20] - Số kết quả tối đa
     *
     * @returns {Promise<Array>} Mảng sản phẩm khớp với từ khóa
     */
    static async search(searchQuery, limit = 20) {
        const limitNum = parseInt(limit) || 20;
        const params = [];
        const searchClause = this.buildSearchFilterClause(searchQuery, params, 'p');
        const lowerSearch = String(searchQuery || '').trim().toLowerCase();
        const exactPrefixTerm = `${lowerSearch}%`;
        const looseSearchTerm = `%${lowerSearch}%`;

        const terms = Array.from(new Set(
            lowerSearch
                .split(/\s+/)
                .map((t) => t.trim())
                .filter((t) => t.length >= 2)
        )).slice(0, 8);

        const safeName = 'BINARY LOWER(p.name)';
        const safeDesc = 'BINARY LOWER(p.description)';

        const nameMatchScore = terms.length > 0
            ? terms.map(() => `(CASE WHEN ${safeName} LIKE ? THEN 1 ELSE 0 END)`).join(' + ')
            : '0';

        const nameMatchParams = terms.map((t) => `%${t}%`);

        const query = `
            SELECT p.*,
                   c.name as category_name,
                   c.slug as category_slug,
                   (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = TRUE LIMIT 1) as primary_image,
                   s.type as sale_type,
                   s.value as sale_value,
                   s.name as sale_name,
${this.getVariantAggregateSelect('p')}
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN sales s ON p.sale_id = s.id AND s.is_active = TRUE
                AND NOW() BETWEEN s.start_date AND s.end_date
            WHERE p.is_active = TRUE
              ${searchClause}
            ORDER BY ${this.buildOrderByClause([
                `CASE
                    WHEN ${safeName} LIKE ? THEN 0
                    WHEN ${safeName} LIKE ? THEN 1
                    WHEN ${safeDesc} LIKE ? THEN 3
                    ELSE 2
                END`,
                `(${nameMatchScore}) DESC`,
                'p.sold_count DESC'
            ], {
                prioritizeInStock: true,
                productAlias: 'p'
            })}
            LIMIT ${limitNum}
        `;

        let [rows] = await pool.query(query, [
            ...params,
            ...nameMatchParams,
            exactPrefixTerm,
            looseSearchTerm,
            looseSearchTerm
        ]);

        // Nếu không tìm thấy kết quả, thực hiện fuzzy search
        if (rows.length === 0) {
            rows = await this.fuzzySearch(searchQuery, limitNum);
        }

        return this.hydrateListingProducts(rows);
    }

    /**
     * Tìm kiếm mờ (Fuzzy Search) - tìm sản phẩm gần đúng
     *
     * @description Sử dụng SOUNDEX và tách từ để tìm sản phẩm
     *              khi người dùng nhập sai chính tả hoặc từ khóa không chính xác.
     *              Thuật toán:
     *              1. Tìm theo SOUNDEX (phát âm tương tự)
     *              2. Tìm theo từng từ trong query
     *              3. Tìm sản phẩm phổ biến trong cùng danh mục
     *
     * @param {string} searchQuery - Từ khóa tìm kiếm
     * @param {number} [limit=20] - Số kết quả tối đa
     *
     * @returns {Promise<Array>} Mảng sản phẩm gần đúng
     */
    static async fuzzySearch(searchQuery, limit = 20) {
        const limitNum = parseInt(limit) || 20;

        const lowerQuery = String(searchQuery || '').trim().toLowerCase();
        const words = lowerQuery.split(/\s+/).filter(w => w.length >= 2);

        if (words.length === 0) {
            return await this.getBestSellers(limitNum);
        }

        // Xử lý an toàn like.
        const safeLike = (field) => `BINARY LOWER(${field}) LIKE ?`;

        // Tạo dữ liệu biến thể exists clause.
        const buildVariantExistsClause = () => `EXISTS (
            SELECT 1
            FROM product_variants pv
            WHERE pv.product_id = p.id
              AND (
                  ${safeLike('pv.color')}
                  OR ${safeLike('pv.size')}
                  OR ${safeLike('pv.sku')}
              )
        )`;
        // Tạo dữ liệu field clause.
        const buildFieldClause = () => `(
            ${safeLike('p.name')}
            OR ${safeLike('p.description')}
            OR ${safeLike('p.sku')}
            OR ${buildVariantExistsClause()}
        )`;
        // Xử lý name match clause.
        const nameMatchClause = () => `(CASE WHEN ${safeLike('p.name')} THEN 1 ELSE 0 END)`;
        const likeConditions = words.map(() => buildFieldClause()).join(' OR ');
        const matchScoreClauses = words.map(() => nameMatchClause()).join(' + ');
        const params = [];
        // Xử lý append like tham số.
        const appendLikeParams = (word) => {
            const likeTerm = `%${word}%`;
            params.push(likeTerm, likeTerm, likeTerm, likeTerm, likeTerm, likeTerm);
        };
        // Xử lý append name param.
        const appendNameParam = (word) => {
            params.push(`%${word}%`);
        };
        words.forEach((word) => appendNameParam(word));
        words.forEach((word) => appendLikeParams(word));

        // Query fuzzy: tìm sản phẩm có chứa ít nhất 1 từ trong query
        const fuzzyQuery = `
            SELECT p.*,
                   c.name as category_name,
                   c.slug as category_slug,
                   (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = TRUE LIMIT 1) as primary_image,
                   s.type as sale_type,
                   s.value as sale_value,
                   s.name as sale_name,
${this.getVariantAggregateSelect('p')},
                   (
                       ${matchScoreClauses}
                   ) as match_score
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN sales s ON p.sale_id = s.id AND s.is_active = TRUE
                AND NOW() BETWEEN s.start_date AND s.end_date
            WHERE p.is_active = TRUE
              AND (${likeConditions})
            ORDER BY ${this.buildOrderByClause([
                'match_score DESC',
                'p.sold_count DESC'
            ], {
                prioritizeInStock: true,
                productAlias: 'p'
            })}
            LIMIT ${limitNum}
        `;

        // Params: lặp lại likeParams 2 lần (cho match_score và điều kiện WHERE)
        let [rows] = await pool.query(fuzzyQuery, params);

        // Nếu vẫn không có kết quả, tìm theo SOUNDEX (phát âm tương tự)
        if (rows.length === 0) {
            const soundexQuery = `
                SELECT p.*,
                       c.name as category_name,
                       c.slug as category_slug,
                       (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = TRUE LIMIT 1) as primary_image,
                       s.type as sale_type,
                       s.value as sale_value,
                       s.name as sale_name,
${this.getVariantAggregateSelect('p')}
                FROM products p
                LEFT JOIN categories c ON p.category_id = c.id
                LEFT JOIN sales s ON p.sale_id = s.id AND s.is_active = TRUE
                    AND NOW() BETWEEN s.start_date AND s.end_date
                WHERE p.is_active = TRUE
                  AND SOUNDEX(p.name) = SOUNDEX(?)
                ORDER BY ${this.buildOrderByClause(['p.sold_count DESC'], {
                    prioritizeInStock: true,
                    productAlias: 'p'
                })}
                LIMIT ${limitNum}
            `;

            [rows] = await pool.query(soundexQuery, [searchQuery]);
        }

        // Nếu vẫn không có, trả về sản phẩm bán chạy làm gợi ý
        if (rows.length === 0) {
            rows = await this.getBestSellers(limitNum);
            // Đánh dấu là kết quả gợi ý
            rows.forEach(p => p.is_suggestion = true);
        }

        return rows;
    }

    // =============================================================================
    // TÍNH GIÁ SAU KHUYẾN MÃI - CALCULATE FINAL PRICE
    // =============================================================================

    /**
     * Tính giá cuối cùng sau khi áp dụng khuyến mãi
     *
     * @description Hỗ trợ 3 loại khuyến mãi:
     *              - percentage: Giảm theo phần trăm (VD: giảm 20%)
     *              - fixed: Giảm số tiền cố định (VD: giảm 50,000đ)
     *              - bogo: Buy One Get One (xử lý ở giỏ hàng)
     *
     * @param {number} originalPrice - Giá gốc sản phẩm
     * @param {string} saleType - Loại khuyến mãi ('percentage', 'fixed', 'bogo')
     * @param {number} saleValue - Giá trị khuyến mãi
     *
     * @returns {number} Giá cuối cùng sau khuyến mãi
     */
    static calculateFinalPrice(originalPrice, saleType, saleValue) {
        const basePrice = this.toNumber(originalPrice);
        const normalizedSaleValue = this.toNumber(saleValue);

        // Nếu không có khuyến mãi, trả về giá gốc
        if (!saleType || !normalizedSaleValue) return basePrice;

        switch (saleType) {
            case 'percentage':
                // Giảm theo phần trăm: giá * (1 - %/100)
                return basePrice * (1 - normalizedSaleValue / 100);
            case 'fixed':
                // Giảm số tiền cố định, đảm bảo không âm
                return Math.max(0, basePrice - normalizedSaleValue);
            case 'bogo':
                // BOGO được xử lý ở tầng giỏ hàng
                return basePrice;
            default:
                return basePrice;
        }
    }

    // =============================================================================
    // LẤY SẢN PHẨM BÁN CHẠY - GET BEST SELLERS
    // =============================================================================

    /**
     * Lấy danh sách sản phẩm bán chạy nhất
     *
     * @description Sắp xếp theo số lượng đã bán (sold_count) giảm dần
     *
     * @param {number} [limit=8] - Số sản phẩm cần lấy
     *
     * @returns {Promise<Array>} Mảng sản phẩm bán chạy
     */
    static async getBestSellers(limit = 8) {
        return await this.findAll({
            sort_by: 'sold_count',
            sort_order: 'DESC',
            prioritize_in_stock: true,
            limit
        });
    }

    // Lấy for you recommendations.
    static async getForYouRecommendations(userId, limit = 30) {
        const normalizedUserId = Number.parseInt(userId, 10);
        const safeLimit = Math.min(
            60,
            Math.max(1, Number.parseInt(limit, 10) || 30)
        );

        if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) {
            return [];
        }

        const [recentOrders] = await pool.execute(
            `SELECT id, created_at
             FROM orders
             WHERE user_id = ?
               AND status IN ('pending', 'confirmed', 'processing', 'shipping', 'delivered', 'completed')
             ORDER BY created_at DESC, id DESC
             LIMIT 5`,
            [normalizedUserId]
        );

        if (!Array.isArray(recentOrders) || recentOrders.length === 0) {
            return [];
        }

        const recentOrderIds = recentOrders.map((order) => Number.parseInt(order.id, 10)).filter((id) => Number.isInteger(id));
        const orderRecencyScore = new Map(recentOrderIds.map((orderId, index) => [orderId, recentOrderIds.length - index]));
        const placeholders = recentOrderIds.map(() => '?').join(', ');

        const [purchaseRows] = await pool.execute(
            `SELECT
                o.id AS order_id,
                p.category_id,
                c.name AS category_name,
                oi.product_id,
                p.name AS product_name,
                pv.color AS variant_color,
                pv.size AS variant_size,
                oi.quantity AS purchased_quantity,
                o.created_at AS purchased_at
             FROM orders o
             JOIN order_items oi ON oi.order_id = o.id
             JOIN products p ON p.id = oi.product_id
             LEFT JOIN categories c ON c.id = p.category_id
             LEFT JOIN product_variants pv ON pv.id = oi.variant_id
             WHERE o.id IN (${placeholders})
             ORDER BY o.created_at DESC, o.id DESC`,
            recentOrderIds
        );

        if (!Array.isArray(purchaseRows) || purchaseRows.length === 0) {
            return [];
        }

        const purchasedProductIds = new Set();
        const categoryScores = new Map();
        const tokenScores = new Map();
        // Chuẩn hóa tokens.
        const normalizeTokens = (value) => String(value || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/đ/g, 'd')
            .split(/[^a-z0-9]+/i)
            .map((token) => token.trim())
            .filter((token) => token.length >= 2 && !['nam', 'nu', 'cho', 'the', 'and', 'voi'].includes(token));

        purchaseRows.forEach((row) => {
            const productId = Number.parseInt(row.product_id, 10);
            const categoryId = Number.parseInt(row.category_id, 10);
            const purchasedQuantity = Math.max(1, Number.parseInt(row.purchased_quantity, 10) || 1);
            const recencyScore = orderRecencyScore.get(Number.parseInt(row.order_id, 10)) || 1;
            const weightedScore = purchasedQuantity * recencyScore;

            if (Number.isInteger(productId) && productId > 0) {
                purchasedProductIds.add(productId);
            }

            if (!Number.isInteger(categoryId) || categoryId <= 0) {
                return;
            }

            categoryScores.set(
                categoryId,
                (categoryScores.get(categoryId) || 0) + weightedScore
            );

            [
                row.product_name,
                row.category_name,
                row.variant_color,
                row.variant_size
            ].flatMap(normalizeTokens).forEach((token) => {
                tokenScores.set(token, (tokenScores.get(token) || 0) + weightedScore);
            });
        });

        const rankedCategoryIds = [...categoryScores.entries()]
            .sort((left, right) => right[1] - left[1])
            .map(([categoryId]) => categoryId)
            .slice(0, 6);

        if (rankedCategoryIds.length === 0) {
            return [];
        }

        const fetchLimit = Math.max(safeLimit * 3, safeLimit + 12);
        const candidates = await this.findAll({
            category_ids: rankedCategoryIds,
            sort_by: 'sold_count',
            sort_order: 'DESC',
            prioritize_in_stock: true,
            use_final_price: true,
            limit: fetchLimit,
            offset: 0
        });

        const rankedCandidates = candidates
            .filter((product) => !purchasedProductIds.has(Number(product.id)))
            .map((product) => {
                const productTokens = [
                    product.name,
                    product.category_name,
                    product.variant_colors,
                    product.variant_sizes
                ].flatMap(normalizeTokens);
                const tokenScore = productTokens.reduce((sum, token) => sum + (tokenScores.get(token) || 0), 0);
                const categoryScore = categoryScores.get(Number(product.category_id)) || 0;

                return {
                    ...product,
                    recommendation_score: (categoryScore * 10) + (tokenScore * 3) + ((Number(product.sold_count) || 0) / 10)
                };
            })
            .sort((left, right) => {
                const scoreDifference = (Number(right.recommendation_score) || 0) - (Number(left.recommendation_score) || 0);
                if (scoreDifference !== 0) {
                    return scoreDifference;
                }

                const leftCategoryScore = categoryScores.get(Number(left.category_id)) || 0;
                const rightCategoryScore = categoryScores.get(Number(right.category_id)) || 0;
                if (rightCategoryScore !== leftCategoryScore) {
                    return rightCategoryScore - leftCategoryScore;
                }

                const soldCountDifference = (Number(right.sold_count) || 0) - (Number(left.sold_count) || 0);
                if (soldCountDifference !== 0) {
                    return soldCountDifference;
                }

                return new Date(right.created_at || 0).getTime() - new Date(left.created_at || 0).getTime();
            });

        if (rankedCandidates.length >= safeLimit) {
            return rankedCandidates.slice(0, safeLimit);
        }

        const fallbackProducts = await this.getBestSellers(safeLimit + purchasedProductIds.size);
        const fallback = fallbackProducts.filter((product) => (
            !purchasedProductIds.has(Number(product.id)) &&
            !rankedCandidates.some((candidate) => Number(candidate.id) === Number(product.id))
        ));

        return [...rankedCandidates, ...fallback].slice(0, safeLimit);
    }

    // =============================================================================
    // LẤY SẢN PHẨM MỚI - GET NEW PRODUCTS
    // =============================================================================

    /**
     * Lấy danh sách sản phẩm mới nhất
     *
     * @description Sắp xếp theo ngày tạo (created_at) giảm dần
     *
     * @param {number} [limit=8] - Số sản phẩm cần lấy
     *
     * @returns {Promise<Array>} Mảng sản phẩm mới nhất
     */
    static async getNewProducts(limit = 8) {
        return await this.findAll({
            sort_by: 'created_at',
            sort_order: 'DESC',
            prioritize_in_stock: true,
            limit
        });
    }

    // =============================================================================
    // LẤY SẢN PHẨM NỔI BẬT - GET FEATURED PRODUCTS
    // =============================================================================

    /**
     * Lấy danh sách sản phẩm nổi bật
     *
     * @description Lấy các sản phẩm có flag is_featured = true
     *
     * @param {number} [limit=8] - Số sản phẩm cần lấy
     *
     * @returns {Promise<Array>} Mảng sản phẩm nổi bật
     */
    static async getFeaturedProducts(limit = 8) {
        return await this.findAll({
            is_featured: true,
            prioritize_in_stock: true,
            limit
        });
    }

    // =============================================================================
    // Tạo sản phẩm mới từ dữ liệu quản trị.
    // =============================================================================

    /**
     * Tạo sản phẩm mới trong database
     *
     * @description Thêm một sản phẩm mới với các thông tin cơ bản.
     *              Ảnh sản phẩm được thêm riêng qua hàm addImage.
     *
     * @param {Object} productData - Dữ liệu sản phẩm
     * @param {number} productData.category_id - ID danh mục
     * @param {string} productData.name - Tên sản phẩm
     * @param {string} productData.slug - Slug URL
     * @param {string} [productData.description] - Mô tả sản phẩm
     * @param {number} productData.price - Giá sản phẩm
     * @param {number} [productData.stock_quantity=0] - Số lượng tồn kho
     * @param {string} [productData.sku] - Mã SKU
     * @param {number} [productData.sale_id] - ID chương trình khuyến mãi
     * @param {boolean} [productData.is_featured=false] - Sản phẩm nổi bật
     *
     * @returns {Promise<Object>} Sản phẩm vừa tạo với ID
     */
    static async create(productData) {
        const { category_id, name, slug, description, price, stock_quantity, sku, sale_id, is_featured } = productData;

        const query = `
            INSERT INTO products (category_id, name, slug, description, price, stock_quantity, sku, sale_id, is_featured)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const [result] = await pool.execute(query, [
            category_id,
            name,
            slug,
            description || null,
            price,
            stock_quantity || 0,
            sku || null,
            sale_id || null,
            is_featured || false
        ]);

        return { id: result.insertId, ...productData };
    }

    // =============================================================================
    // Cập nhật thông tin sản phẩm hiện có.
    // =============================================================================

    /**
     * Cập nhật thông tin sản phẩm
     *
     * @description Cập nhật tất cả thông tin sản phẩm theo ID
     *
     * @param {number} id - ID sản phẩm cần cập nhật
     * @param {Object} productData - Dữ liệu cập nhật
     *
     * @returns {Promise<Object>} Sản phẩm sau khi cập nhật
     */
    static async update(id, productData) {
        const { category_id, name, slug, description, price, stock_quantity, sku, sale_id, is_featured } = productData;

        const query = `
            UPDATE products
            SET category_id = ?, name = ?, slug = ?, description = ?, price = ?,
                stock_quantity = ?, sku = ?, sale_id = ?, is_featured = ?
            WHERE id = ?
        `;

        await pool.execute(query, [
            category_id,
            name,
            slug,
            description || null,
            price,
            stock_quantity || 0,
            sku || null,
            sale_id || null,
            is_featured || false,
            id
        ]);

        return await this.findById(id);
    }

    // =============================================================================
    // Xóa mềm sản phẩm để giữ lịch sử đơn hàng.
    // =============================================================================

    /**
     * Xóa mềm sản phẩm khỏi danh sách đang bán.
     *
     * @description Không xóa thật sự mà chỉ đánh dấu is_active = FALSE.
     *              Giúp giữ lại dữ liệu để báo cáo và có thể khôi phục.
     *
     * @param {number} id - ID sản phẩm cần xóa
     *
     * @returns {Promise<void>}
     */
    static async delete(id) {
        const query = 'UPDATE products SET is_active = FALSE WHERE id = ?';
        await pool.execute(query, [id]);
    }

    // Xóa tất cả.
    static async deleteAll() {
        const query = 'UPDATE products SET is_active = FALSE WHERE is_active = TRUE';
        const [result] = await pool.execute(query);
        return Number(result?.affectedRows || 0);
    }

    // Xóa tất cả permanently.
    static async deleteAllPermanently() {
        const connection = await pool.getConnection();

        try {
            await connection.beginTransaction();

            const [[summary]] = await connection.query(`
                SELECT
                    COUNT(*) AS total_products,
                    SUM(CASE WHEN order_refs.product_id IS NOT NULL THEN 1 ELSE 0 END) AS blocked_products
                FROM products p
                LEFT JOIN (
                    SELECT DISTINCT product_id
                    FROM order_items
                ) order_refs ON order_refs.product_id = p.id
            `);

            const [deleteResult] = await connection.query(`
                DELETE p
                FROM products p
                LEFT JOIN (
                    SELECT DISTINCT product_id
                    FROM order_items
                ) order_refs ON order_refs.product_id = p.id
                WHERE order_refs.product_id IS NULL
            `);

            await connection.commit();

            const totalProducts = Number(summary?.total_products || 0);
            const blockedProducts = Number(summary?.blocked_products || 0);
            const deletedProducts = Number(deleteResult?.affectedRows || 0);

            return {
                totalProducts,
                deletedProducts,
                blockedProducts
            };
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    // =============================================================================
    // THÊM ẢNH SẢN PHẨM - ADD PRODUCT IMAGE
    // =============================================================================

    /**
     * Thêm ảnh cho sản phẩm
     *
     * @description Thêm một ảnh mới vào sản phẩm.
     *              Nếu đặt làm ảnh chính, tự động bỏ flag của các ảnh khác.
     *
     * @param {number} productId - ID sản phẩm
     * @param {string} imageUrl - URL hoặc đường dẫn ảnh
     * @param {boolean} [isPrimary=false] - Đặt làm ảnh chính
     * @param {number} [displayOrder=0] - Thứ tự hiển thị
     *
     * @returns {Promise<Object>} Thông tin ảnh vừa thêm
     */
    static async addImage(productId, imageUrl, isPrimary = false, displayOrder = 0) {
        if (isPrimary) {
            await pool.execute(
                'UPDATE product_images SET is_primary = FALSE WHERE product_id = ?',
                [productId]
            );
        }

        const query = `
            INSERT INTO product_images (product_id, image_url, is_primary, display_order)
            VALUES (?, ?, ?, ?)
        `;

        const [result] = await pool.execute(query, [productId, imageUrl, isPrimary, displayOrder]);
        return { id: result.insertId, product_id: productId, image_url: imageUrl, is_primary: isPrimary, display_order: displayOrder };
    }

    // Lấy ảnh.
    static async getImages(productId) {
        const [rows] = await pool.execute(
            'SELECT * FROM product_images WHERE product_id = ? ORDER BY is_primary DESC, display_order ASC, id ASC',
            [productId]
        );
        return rows;
    }

    // Tìm ảnh theo ID.
    static async findImageById(productId, imageId) {
        const [rows] = await pool.execute(
            'SELECT * FROM product_images WHERE product_id = ? AND id = ? LIMIT 1',
            [productId, imageId]
        );
        return rows[0] || null;
    }

    // =============================================================================
    // Cập nhật tồn kho sau khi có thay đổi đơn hàng hoặc nhập hàng.
    // =============================================================================

    /**
     * Cập nhật số lượng tồn kho sau khi bán
     *
     * @description Giảm số lượng tồn kho và tăng số lượng đã bán.
     *              Thường được gọi sau khi đơn hàng được xác nhận.
     *
     * @param {number} productId - ID sản phẩm
     * @param {number} quantity - Số lượng đã bán
     *
     * @returns {Promise<void>}
     */
    static async updateStock(productId, quantity) {
        const query = 'UPDATE products SET stock_quantity = stock_quantity - ?, sold_count = sold_count + ? WHERE id = ?';
        await pool.execute(query, [quantity, quantity, productId]);
    }

    // =========================================================================
    // QUẢN LÝ BIẾN THỂ SẢN PHẨM - PRODUCT VARIANTS
    // =========================================================================

    static async getVariants(productId) {
        const [rows] = await pool.execute(
            `SELECT pv.*, pi.image_url AS variant_image_url
             FROM product_variants pv
             LEFT JOIN product_images pi ON pi.id = pv.image_id
             WHERE pv.product_id = ?
             ORDER BY pv.color, pv.size, pv.id`,
            [productId]
        );
        return this.normalizeVariantNumbers(rows);
    }

    // Thêm biến thể.
    static async addVariant(productId, variantData) {
        const { size, color, additional_price, stock_quantity, sku, image_id } = variantData;
        const query = `
            INSERT INTO product_variants (product_id, size, color, additional_price, stock_quantity, sku, image_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        const [result] = await pool.execute(query, [
            productId,
            size || null,
            color || null,
            parseFloat(additional_price) || 0,
            parseInt(stock_quantity, 10) || 0,
            sku || null,
            image_id || null
        ]);
        return { id: result.insertId, product_id: productId, ...variantData };
    }

    // Cập nhật biến thể.
    static async updateVariant(variantId, variantData) {
        const { size, color, additional_price, stock_quantity, sku, image_id } = variantData;
        const query = `
            UPDATE product_variants
            SET size = ?, color = ?, additional_price = ?, stock_quantity = ?, sku = ?, image_id = ?
            WHERE id = ?
        `;
        await pool.execute(query, [
            size || null,
            color || null,
            parseFloat(additional_price) || 0,
            parseInt(stock_quantity, 10) || 0,
            sku || null,
            image_id || null,
            variantId
        ]);
        return { id: variantId, ...variantData };
    }

    // Xóa biến thể.
    static async deleteVariant(variantId) {
        await pool.execute('DELETE FROM product_variants WHERE id = ?', [variantId]);
    }

    // Kiểm tra biến thể referenced.
    static async isVariantReferenced(variantId) {
        const [rows] = await pool.execute(
            `SELECT
                EXISTS(SELECT 1 FROM cart_items WHERE variant_id = ? LIMIT 1) AS in_cart,
                EXISTS(SELECT 1 FROM order_items WHERE variant_id = ? LIMIT 1) AS in_order`,
            [variantId, variantId]
        );

        return Boolean(rows[0] && (rows[0].in_cart || rows[0].in_order));
    }

    // Cập nhật biến thể stock.
    static async updateVariantStock(variantId, quantity) {
        await pool.execute(
            'UPDATE product_variants SET stock_quantity = stock_quantity - ? WHERE id = ?',
            [quantity, variantId]
        );
    }

    // Tìm tất cả.
    static async findAll(filters = {}) {
        const displayPriceExpr = this.getDisplayPriceExpression('p', 'sale_ref');
        const effectivePromotionFilter = filters.on_sale
            ? 'active_or_upcoming'
            : (filters.promotions?.length ? filters.promotions : filters.promotion);
        const effectiveRatingThreshold = this.getEffectiveRatingThreshold(filters);
        let query = `
            SELECT
${this.getListingSelectFields('p', 'c', 'sale_ref')}
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN sales sale_ref ON p.sale_id = sale_ref.id
            WHERE p.is_active = TRUE
        `;

        const params = [];

        query += this.buildCategoryFilterClause(filters, params, 'p');

        const priceCol = filters.use_final_price ? displayPriceExpr : 'p.price';
        query += this.buildPriceFilterClause(filters, params, priceCol);

        if (filters.search) {
            query += this.buildSearchFilterClause(filters.search, params, 'p', {
                accentSensitive: filters.accent_sensitive !== false
            });
        }

        if (filters.is_featured) {
            query += ' AND p.is_featured = TRUE';
        }

        if (effectiveRatingThreshold !== null) {
            query += ` AND COALESCE((
                SELECT AVG(r.rating)
                FROM reviews r
                WHERE r.product_id = p.id
                  AND r.is_approved = TRUE
            ), 0) >= ?`;
            params.push(effectiveRatingThreshold);
        }

        query += this.getPromotionFilterClause(effectivePromotionFilter, 'sale_ref');

        const sortField = filters.sort_by || 'created_at';
        const sortOrder = (filters.sort_order || 'DESC').toUpperCase();
        const prioritizeInStock = filters.prioritize_in_stock === true;
        const allowedSortFields = ['created_at', 'price', 'name', 'sold_count', 'view_count'];
        const allowedSortOrders = ['ASC', 'DESC'];

        const orderSegments = [];
        if (allowedSortFields.includes(sortField) && allowedSortOrders.includes(sortOrder)) {
            if (sortField === 'price' && filters.use_final_price) {
                orderSegments.push(`${displayPriceExpr} ${sortOrder}`);
            } else {
                orderSegments.push(`p.${sortField} ${sortOrder}`);
            }
        } else {
            orderSegments.push('p.created_at DESC');
        }

        query += ` ORDER BY ${this.buildOrderByClause(orderSegments, {
            prioritizeInStock,
            productAlias: 'p'
        })}`;

        const limit = parseInt(filters.limit, 10) || 12;
        const offset = parseInt(filters.offset, 10) || 0;
        query += ` LIMIT ${limit} OFFSET ${offset}`;

        const [rows] = await pool.query(query, params);
        return this.hydrateListingProducts(rows);
    }

    // Đếm tổng số bản ghi.
    static async count(filters = {}) {
        const displayPriceExpr = this.getDisplayPriceExpression('p', 'sale_ref');
        const effectivePromotionFilter = filters.on_sale
            ? 'active_or_upcoming'
            : (filters.promotions?.length ? filters.promotions : filters.promotion);
        const effectiveRatingThreshold = this.getEffectiveRatingThreshold(filters);
        let query = `
            SELECT COUNT(*) AS total
            FROM products p
            LEFT JOIN sales sale_ref ON p.sale_id = sale_ref.id
            WHERE p.is_active = TRUE
        `;
        const params = [];

        query += this.buildCategoryFilterClause(filters, params, 'p');

        const priceCol = filters.use_final_price ? displayPriceExpr : 'p.price';
        query += this.buildPriceFilterClause(filters, params, priceCol);

        if (filters.search) {
            query += this.buildSearchFilterClause(filters.search, params, 'p');
        }

        if (filters.is_featured) {
            query += ' AND p.is_featured = TRUE';
        }

        if (effectiveRatingThreshold !== null) {
            query += ` AND COALESCE((
                SELECT AVG(r.rating)
                FROM reviews r
                WHERE r.product_id = p.id
                  AND r.is_approved = TRUE
            ), 0) >= ?`;
            params.push(effectiveRatingThreshold);
        }

        query += this.getPromotionFilterClause(effectivePromotionFilter, 'sale_ref');

        if (filters.stock_status === 'in_stock') {
            query += ' AND p.stock_quantity > 0';
        } else if (filters.stock_status === 'out_of_stock') {
            query += ' AND p.stock_quantity <= 0';
        }

        const [rows] = await pool.query(query, params);
        return rows[0]?.total || 0;
    }

    // Lấy theo ID.
    static async getByIds(ids = []) {
        const normalizedIds = Array.from(new Set(
            (Array.isArray(ids) ? ids : [])
                .map((id) => Number.parseInt(id, 10))
                .filter((id) => Number.isInteger(id) && id > 0)
        ));

        if (!normalizedIds.length) {
            return [];
        }

        const placeholders = normalizedIds.map(() => '?').join(', ');
        const [rows] = await pool.query(
            `SELECT
${this.getListingSelectFields('p', 'c', 'sale_ref')}
             FROM products p
             LEFT JOIN categories c ON p.category_id = c.id
             LEFT JOIN sales sale_ref ON p.sale_id = sale_ref.id
             WHERE p.is_active = TRUE
               AND p.id IN (${placeholders})`,
            normalizedIds
        );

        const hydratedRows = this.hydrateListingProducts(rows);
        const productMap = new Map(hydratedRows.map((product) => [product.id, product]));

        return normalizedIds
            .map((id) => productMap.get(id))
            .filter(Boolean);
    }

    // Lấy đang bật chat catalog.
    static async getActiveChatCatalog() {
        const [rows] = await pool.query(
            `SELECT
${this.getListingSelectFields('p', 'c', 'sale_ref')}
             FROM products p
             LEFT JOIN categories c ON p.category_id = c.id
             LEFT JOIN sales sale_ref ON p.sale_id = sale_ref.id
             WHERE p.is_active = TRUE
             ORDER BY ${this.buildOrderByClause(['p.created_at DESC'], {
                 prioritizeInStock: true,
                 productAlias: 'p'
             })}`
        );

        return this.hydrateListingProducts(rows);
    }

    // Tìm theo ID.
    static async findById(id, options = {}) {
        const { incrementView = true } = options;
        const query = `
            SELECT
${this.getListingSelectFields('p', 'c', 'sale_ref')}
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN sales sale_ref ON p.sale_id = sale_ref.id
            WHERE p.id = ? AND p.is_active = TRUE
        `;

        const [rows] = await pool.execute(query, [id]);
        const product = rows[0];

        if (!product) {
            return null;
        }

        this.normalizeProductNumbers(product);

        const [images] = await pool.execute(
            'SELECT * FROM product_images WHERE product_id = ? ORDER BY is_primary DESC, display_order ASC',
            [id]
        );
        product.images = images;

        const [variants] = await pool.execute(
            `SELECT pv.*, pi.image_url AS variant_image_url
             FROM product_variants pv
             LEFT JOIN product_images pi ON pi.id = pv.image_id
             WHERE pv.product_id = ?
             ORDER BY pv.color, pv.size, pv.id`,
            [id]
        );
        product.variants = this.normalizeVariantNumbers(variants);

        const [reviews] = await pool.execute(
            `SELECT r.*, u.full_name as user_name, u.avatar_url as user_avatar
             FROM reviews r
             JOIN users u ON r.user_id = u.id
             WHERE r.product_id = ? AND r.is_approved = TRUE
             ORDER BY r.created_at DESC
             LIMIT 10`,
            [id]
        );
        await this.attachReviewMediaToReviews(reviews);
        product.reviews = reviews;
        product.final_price = this.calculateFinalPrice(product.price, product.sale_type, product.sale_value);
        product.promotion_status = product.promotion_status || 'none';

        if (incrementView) {
            await pool.execute('UPDATE products SET view_count = view_count + 1 WHERE id = ?', [id]);
        }

        return product;
    }

    // Tìm kiếm search.
    static async search(searchQuery, limit = 20) {
        const limitNum = parseInt(limit, 10) || 20;
        const params = [];
        const searchClause = this.buildSearchFilterClause(searchQuery, params, 'p');
        const lowerSearch = String(searchQuery || '').trim().toLowerCase();
        const exactPrefixTerm = `${lowerSearch}%`;
        const looseSearchTerm = `%${lowerSearch}%`;

        const terms = Array.from(new Set(
            lowerSearch
                .split(/\s+/)
                .map((term) => term.trim())
                .filter((term) => term.length >= 2)
        )).slice(0, 8);

        const safeName = 'BINARY LOWER(p.name)';
        const safeDesc = 'BINARY LOWER(p.description)';
        const nameMatchScore = terms.length > 0
            ? terms.map(() => `(CASE WHEN ${safeName} LIKE ? THEN 1 ELSE 0 END)`).join(' + ')
            : '0';
        const nameMatchParams = terms.map((term) => `%${term}%`);

        const query = `
            SELECT
${this.getListingSelectFields('p', 'c', 'sale_ref')}
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN sales sale_ref ON p.sale_id = sale_ref.id
            WHERE p.is_active = TRUE
              ${searchClause}
            ORDER BY ${this.buildOrderByClause([
                `CASE
                    WHEN ${safeName} LIKE ? THEN 0
                    WHEN ${safeName} LIKE ? THEN 1
                    WHEN ${safeDesc} LIKE ? THEN 3
                    ELSE 2
                END`,
                `(${nameMatchScore}) DESC`,
                'p.sold_count DESC'
            ], {
                prioritizeInStock: true,
                productAlias: 'p'
            })}
            LIMIT ${limitNum}
        `;

        let [rows] = await pool.query(query, [
            ...params,
            ...nameMatchParams,
            exactPrefixTerm,
            looseSearchTerm,
            looseSearchTerm
        ]);

        if (rows.length === 0) {
            rows = await this.fuzzySearch(searchQuery, limitNum);
        }

        return this.hydrateListingProducts(rows);
    }

    // Thao tác với fuzzy search.
    static async fuzzySearch(searchQuery, limit = 20) {
        const limitNum = parseInt(limit, 10) || 20;
        const lowerQuery = String(searchQuery || '').trim().toLowerCase();
        const words = lowerQuery.split(/\s+/).filter((word) => word.length >= 2);

        if (words.length === 0) {
            return await this.getBestSellers(limitNum);
        }

        // Xử lý an toàn like.
        const safeLike = (field) => `BINARY LOWER(${field}) LIKE ?`;
        // Tạo dữ liệu biến thể exists clause.
        const buildVariantExistsClause = () => `EXISTS (
            SELECT 1
            FROM product_variants pv
            WHERE pv.product_id = p.id
              AND (
                  ${safeLike('pv.color')}
                  OR ${safeLike('pv.size')}
                  OR ${safeLike('pv.sku')}
              )
        )`;
        // Tạo dữ liệu field clause.
        const buildFieldClause = () => `(
            ${safeLike('p.name')}
            OR ${safeLike('p.description')}
            OR ${safeLike('p.sku')}
            OR ${buildVariantExistsClause()}
        )`;
        // Xử lý name match clause.
        const nameMatchClause = () => `(CASE WHEN ${safeLike('p.name')} THEN 1 ELSE 0 END)`;
        const likeConditions = words.map(() => buildFieldClause()).join(' OR ');
        const matchScoreClauses = words.map(() => nameMatchClause()).join(' + ');
        const params = [];

        // Xử lý append like tham số.
        const appendLikeParams = (word) => {
            const likeTerm = `%${word}%`;
            params.push(likeTerm, likeTerm, likeTerm, likeTerm, likeTerm, likeTerm);
        };
        // Xử lý append name param.
        const appendNameParam = (word) => {
            params.push(`%${word}%`);
        };

        words.forEach((word) => appendNameParam(word));
        words.forEach((word) => appendLikeParams(word));

        const fuzzyQuery = `
            SELECT
${this.getListingSelectFields('p', 'c', 'sale_ref')},
                   (
                       ${matchScoreClauses}
                   ) as match_score
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN sales sale_ref ON p.sale_id = sale_ref.id
            WHERE p.is_active = TRUE
              AND (${likeConditions})
            ORDER BY ${this.buildOrderByClause([
                'match_score DESC',
                'p.sold_count DESC'
            ], {
                prioritizeInStock: true,
                productAlias: 'p'
            })}
            LIMIT ${limitNum}
        `;

        let [rows] = await pool.query(fuzzyQuery, params);

        if (rows.length === 0) {
            const soundexQuery = `
                SELECT
${this.getListingSelectFields('p', 'c', 'sale_ref')}
                FROM products p
                LEFT JOIN categories c ON p.category_id = c.id
                LEFT JOIN sales sale_ref ON p.sale_id = sale_ref.id
                WHERE p.is_active = TRUE
                  AND SOUNDEX(p.name) = SOUNDEX(?)
                ORDER BY ${this.buildOrderByClause(['p.sold_count DESC'], {
                    prioritizeInStock: true,
                    productAlias: 'p'
                })}
                LIMIT ${limitNum}
            `;

            [rows] = await pool.query(soundexQuery, [searchQuery]);
        }

        if (rows.length === 0) {
            rows = await this.getBestSellers(limitNum);
            rows.forEach((product) => {
                product.is_suggestion = true;
            });
        }

        return rows;
    }

    // Tính final giá.
    static calculateFinalPrice(originalPrice, saleType, saleValue) {
        const basePrice = this.toNumber(originalPrice);
        const normalizedSaleValue = this.toNumber(saleValue);

        if (!saleType || !normalizedSaleValue) {
            return basePrice;
        }

        switch (saleType) {
            case 'percentage':
                return Math.max(0, basePrice * (1 - Math.min(Math.max(normalizedSaleValue, 0), 100) / 100));
            case 'fixed':
                return Math.max(0, basePrice - normalizedSaleValue);
            case 'bogo':
                return basePrice;
            default:
                return basePrice;
        }
    }

}

module.exports = Product;
