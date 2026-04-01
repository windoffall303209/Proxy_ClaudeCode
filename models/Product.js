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

    static toNumber(value, fallback = 0) {
        const numericValue = Number(value);
        return Number.isFinite(numericValue) ? numericValue : fallback;
    }

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

        return product;
    }

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

    static hydrateListingProducts(products = []) {
        products.forEach((product) => {
            this.normalizeProductNumbers(product);
            product.final_price = this.calculateFinalPrice(product.price, product.sale_type, product.sale_value);
            product.card_image = this.getOptimizedCardImageUrl(product.primary_image);
        });

        return products;
    }

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
                   s.name as sale_name
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
        if (filters.min_price) {
            query += ' AND p.price >= ?';
            params.push(filters.min_price);
        }
        if (filters.max_price) {
            query += ' AND p.price <= ?';
            params.push(filters.max_price);
        }

        // Tìm kiếm theo từ khóa (an toàn SQL injection)
        if (filters.search) {
            query += ' AND (p.name LIKE ? OR p.description LIKE ? OR p.sku LIKE ?)';
            const searchTerm = `%${filters.search}%`;
            params.push(searchTerm, searchTerm, searchTerm);
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
        const sortOrder = filters.sort_order || 'DESC';
        const allowedSortFields = ['created_at', 'price', 'name', 'sold_count', 'view_count'];
        const allowedSortOrders = ['ASC', 'DESC'];

        if (allowedSortFields.includes(sortField) && allowedSortOrders.includes(sortOrder.toUpperCase())) {
            query += ` ORDER BY p.${sortField} ${sortOrder}`;
        }

        // Phân trang
        const limit = parseInt(filters.limit) || 12;
        const offset = parseInt(filters.offset) || 0;
        query += ` LIMIT ${limit} OFFSET ${offset}`;

        const [rows] = await pool.query(query, params);

        return this.hydrateListingProducts(rows);
    }

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
            query += ' AND (p.name LIKE ? OR p.description LIKE ? OR p.sku LIKE ?)';
            const searchTerm = `%${filters.search}%`;
            params.push(searchTerm, searchTerm, searchTerm);
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
            SELECT r.*, u.full_name as user_name
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
               AND o.status = 'delivered'
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
        const searchTerm = `%${searchQuery}%`;
        const exactSearchTerm = `${searchQuery}%`;
        const limitNum = parseInt(limit) || 20;

        // Query tìm kiếm chính xác
        const query = `
            SELECT p.*,
                   (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = TRUE LIMIT 1) as primary_image,
                   s.type as sale_type,
                   s.value as sale_value
            FROM products p
            LEFT JOIN sales s ON p.sale_id = s.id AND s.is_active = TRUE
                AND NOW() BETWEEN s.start_date AND s.end_date
            WHERE p.is_active = TRUE
              AND (p.name LIKE ? OR p.description LIKE ? OR p.sku LIKE ?)
            ORDER BY CASE
                WHEN p.name LIKE ? THEN 1
                WHEN p.description LIKE ? THEN 2
                ELSE 3
            END, p.sold_count DESC
            LIMIT ${limitNum}
        `;

        let [rows] = await pool.query(query, [
            searchTerm, searchTerm, searchTerm,
            exactSearchTerm, exactSearchTerm
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

        // Tách query thành các từ riêng lẻ
        const words = searchQuery.trim().split(/\s+/).filter(w => w.length >= 2);

        if (words.length === 0) {
            // Nếu query quá ngắn, trả về sản phẩm bán chạy
            return await this.getBestSellers(limitNum);
        }

        // Tạo điều kiện LIKE cho từng từ
        const likeConditions = words.map(() => 'p.name LIKE ?').join(' OR ');
        const likeParams = words.map(word => `%${word}%`);

        // Query fuzzy: tìm sản phẩm có chứa ít nhất 1 từ trong query
        const fuzzyQuery = `
            SELECT p.*,
                   (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = TRUE LIMIT 1) as primary_image,
                   s.type as sale_type,
                   s.value as sale_value,
                   (
                       ${words.map(() => `(CASE WHEN p.name LIKE ? THEN 1 ELSE 0 END)`).join(' + ')}
                   ) as match_score
            FROM products p
            LEFT JOIN sales s ON p.sale_id = s.id AND s.is_active = TRUE
                AND NOW() BETWEEN s.start_date AND s.end_date
            WHERE p.is_active = TRUE
              AND (${likeConditions})
            ORDER BY match_score DESC, p.sold_count DESC
            LIMIT ${limitNum}
        `;

        // Params: lặp lại likeParams 2 lần (cho match_score và điều kiện WHERE)
        const params = [...likeParams, ...likeParams];

        let [rows] = await pool.query(fuzzyQuery, params);

        // Nếu vẫn không có kết quả, tìm theo SOUNDEX (phát âm tương tự)
        if (rows.length === 0) {
            const soundexQuery = `
                SELECT p.*,
                       (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = TRUE LIMIT 1) as primary_image,
                       s.type as sale_type,
                       s.value as sale_value
                FROM products p
                LEFT JOIN sales s ON p.sale_id = s.id AND s.is_active = TRUE
                    AND NOW() BETWEEN s.start_date AND s.end_date
                WHERE p.is_active = TRUE
                  AND SOUNDEX(p.name) = SOUNDEX(?)
                ORDER BY p.sold_count DESC
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
            limit
        });
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
            limit
        });
    }

    // =============================================================================
    // TẠO SẢN PHẨM MỚI - CREATE PRODUCT
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
    // CẬP NHẬT SẢN PHẨM - UPDATE PRODUCT
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
    // XÓA SẢN PHẨM - DELETE PRODUCT (SOFT DELETE)
    // =============================================================================

    /**
     * Xóa sản phẩm (soft delete)
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

    static async getImages(productId) {
        const [rows] = await pool.execute(
            'SELECT * FROM product_images WHERE product_id = ? ORDER BY is_primary DESC, display_order ASC, id ASC',
            [productId]
        );
        return rows;
    }

    static async findImageById(productId, imageId) {
        const [rows] = await pool.execute(
            'SELECT * FROM product_images WHERE product_id = ? AND id = ? LIMIT 1',
            [productId, imageId]
        );
        return rows[0] || null;
    }

    // =============================================================================
    // CẬP NHẬT TỒN KHO - UPDATE STOCK
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

    static async deleteVariant(variantId) {
        await pool.execute('DELETE FROM product_variants WHERE id = ?', [variantId]);
    }

    static async isVariantReferenced(variantId) {
        const [rows] = await pool.execute(
            `SELECT
                EXISTS(SELECT 1 FROM cart_items WHERE variant_id = ? LIMIT 1) AS in_cart,
                EXISTS(SELECT 1 FROM order_items WHERE variant_id = ? LIMIT 1) AS in_order`,
            [variantId, variantId]
        );

        return Boolean(rows[0] && (rows[0].in_cart || rows[0].in_order));
    }

    static async updateVariantStock(variantId, quantity) {
        await pool.execute(
            'UPDATE product_variants SET stock_quantity = stock_quantity - ? WHERE id = ?',
            [quantity, variantId]
        );
    }

}

module.exports = Product;
