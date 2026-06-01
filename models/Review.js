// Admin review reporting model.
const pool = require('../config/database');
const ReviewAiInsight = require('./ReviewAiInsight');

const REVIEW_AI_JOIN = 'LEFT JOIN review_ai_insights rai ON rai.review_id = r.id';
const VALID_SENTIMENTS = new Set(['positive', 'neutral', 'negative']);

function normalizePositiveInteger(value, fallback = 1) {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeRatings(value) {
    const values = Array.isArray(value) ? value : [value];
    const ratings = values
        .flatMap((item) => String(item || '').split(','))
        .map((item) => Number.parseInt(item, 10))
        .filter((rating) => Number.isInteger(rating) && rating >= 1 && rating <= 5);

    return [...new Set(ratings)];
}

function normalizeProductIds(value) {
    const values = Array.isArray(value) ? value : [value];
    const ids = values
        .flatMap((item) => String(item || '').split(','))
        .map((item) => Number.parseInt(item, 10))
        .filter((id) => Number.isInteger(id) && id > 0);

    return [...new Set(ids)];
}

function groupMediaByReviewId(rows = []) {
    const mediaMap = new Map();
    rows.forEach((row) => {
        const reviewId = Number(row.review_id);
        if (!mediaMap.has(reviewId)) {
            mediaMap.set(reviewId, []);
        }

        mediaMap.get(reviewId).push(row);
    });

    return mediaMap;
}

class Review {
    static buildWhereClause(filters = {}, params = []) {
        const clauses = [];
        const productIds = normalizeProductIds(filters.product_ids || filters.product_id);
        const ratings = normalizeRatings(filters.ratings || filters.rating);
        const search = String(filters.search || '').trim();
        const sentiment = String(filters.sentiment || '').trim().toLowerCase();

        if (productIds.length) {
            clauses.push(`r.product_id IN (${productIds.map(() => '?').join(', ')})`);
            params.push(...productIds);
        }

        if (ratings.length) {
            clauses.push(`r.rating IN (${ratings.map(() => '?').join(', ')})`);
            params.push(...ratings);
        }

        if (search) {
            clauses.push(`(
                p.name LIKE ?
                OR p.slug LIKE ?
                OR u.full_name LIKE ?
                OR u.email LIKE ?
                OR o.order_code LIKE ?
                OR r.comment LIKE ?
            )`);
            const like = `%${search}%`;
            params.push(like, like, like, like, like, like);
        }

        if (VALID_SENTIMENTS.has(sentiment)) {
            clauses.push('rai.sentiment = ?');
            params.push(sentiment);
        }

        return clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    }

    static attachAiInsights(reviews = []) {
        reviews.forEach((review) => {
            if (!review.ai_sentiment) {
                review.ai_insight = null;
                return;
            }

            review.ai_insight = ReviewAiInsight.normalizeInsight({
                review_id: review.id,
                sentiment: review.ai_sentiment,
                topics: review.ai_topics,
                summary: review.ai_summary,
                issue_flags: review.ai_issue_flags,
                confidence: review.ai_confidence,
                model: review.ai_model,
                analyzed_at: review.ai_analyzed_at
            });

            delete review.ai_sentiment;
            delete review.ai_topics;
            delete review.ai_summary;
            delete review.ai_issue_flags;
            delete review.ai_confidence;
            delete review.ai_model;
            delete review.ai_analyzed_at;
        });

        return reviews;
    }

    static async attachMedia(reviews = []) {
        const ids = reviews
            .map((review) => Number.parseInt(review.id, 10))
            .filter((id) => Number.isInteger(id) && id > 0);

        if (!ids.length) {
            return reviews;
        }

        const placeholders = ids.map(() => '?').join(', ');
        const [mediaRows] = await pool.query(
            `SELECT *
             FROM review_media
             WHERE review_id IN (${placeholders})
             ORDER BY display_order ASC, id ASC`,
            ids
        );
        const mediaMap = groupMediaByReviewId(mediaRows);

        reviews.forEach((review) => {
            review.media = mediaMap.get(Number(review.id)) || [];
        });

        return reviews;
    }

    static async queryReviewRows(filters = {}, pagination = null) {
        const params = [];
        const whereClause = this.buildWhereClause(filters, params);
        const limitClause = pagination ? 'LIMIT ? OFFSET ?' : '';
        const limitParams = pagination ? [pagination.limit, pagination.offset] : [];

        const [rows] = await pool.query(
            `SELECT
                r.*,
                p.name AS product_name,
                p.slug AS product_slug,
                (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = TRUE LIMIT 1) AS product_image,
                u.full_name AS user_name,
                u.email AS user_email,
                u.avatar_url AS user_avatar,
                o.order_code,
                rai.sentiment AS ai_sentiment,
                rai.topics AS ai_topics,
                rai.summary AS ai_summary,
                rai.issue_flags AS ai_issue_flags,
                rai.confidence AS ai_confidence,
                rai.model AS ai_model,
                rai.analyzed_at AS ai_analyzed_at
             FROM reviews r
             JOIN products p ON p.id = r.product_id
             JOIN users u ON u.id = r.user_id
             JOIN orders o ON o.id = r.order_id
             ${REVIEW_AI_JOIN}
             ${whereClause}
             ORDER BY r.created_at DESC, r.id DESC
             ${limitClause}`,
            [...params, ...limitParams]
        );

        await this.attachMedia(rows);
        return this.attachAiInsights(rows);
    }

    static async findAllForAdmin(filters = {}) {
        const page = normalizePositiveInteger(filters.page, 1);
        const limit = Math.min(100, normalizePositiveInteger(filters.limit, 20));
        const offset = (page - 1) * limit;
        const params = [];
        const whereClause = this.buildWhereClause(filters, params);

        const [rows, countRows] = await Promise.all([
            this.queryReviewRows(filters, { limit, offset }),
            pool.query(
                `SELECT COUNT(*) AS total
                 FROM reviews r
                 JOIN products p ON p.id = r.product_id
                 JOIN users u ON u.id = r.user_id
                 JOIN orders o ON o.id = r.order_id
                 ${REVIEW_AI_JOIN}
                 ${whereClause}`,
                params
            )
        ]);

        return {
            reviews: rows,
            total: Number(countRows[0][0]?.total || 0),
            page,
            limit
        };
    }

    static async findAllForExport(filters = {}) {
        return this.queryReviewRows(filters);
    }

    static async getStats(filters = {}) {
        const params = [];
        const whereClause = this.buildWhereClause(filters, params);
        const [rows] = await pool.query(
            `SELECT
                COUNT(*) AS total,
                COUNT(DISTINCT r.product_id) AS reviewed_products,
                SUM(CASE WHEN r.is_verified = TRUE THEN 1 ELSE 0 END) AS verified,
                COALESCE(AVG(r.rating), 0) AS average_rating
             FROM reviews r
             JOIN products p ON p.id = r.product_id
             JOIN users u ON u.id = r.user_id
             JOIN orders o ON o.id = r.order_id
             ${REVIEW_AI_JOIN}
             ${whereClause}`,
            params
        );

        const stats = rows[0] || {};
        return {
            total: Number(stats.total || 0),
            reviewedProducts: Number(stats.reviewed_products || 0),
            verified: Number(stats.verified || 0),
            averageRating: Number(stats.average_rating || 0)
        };
    }

    static async getProductsWithReviewCounts() {
        const [rows] = await pool.query(`
            SELECT
                p.id,
                p.name,
                p.slug,
                COUNT(r.id) AS review_count,
                COALESCE(AVG(r.rating), 0) AS average_rating
            FROM reviews r
            JOIN products p ON p.id = r.product_id
            GROUP BY p.id, p.name, p.slug
            ORDER BY p.name ASC
        `);

        return rows.map((row) => ({
            ...row,
            review_count: Number(row.review_count || 0),
            average_rating: Number(row.average_rating || 0)
        }));
    }
}

module.exports = Review;
