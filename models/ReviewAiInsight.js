const pool = require('../config/database');

function parseJson(value, fallback) {
    if (value === null || value === undefined || value === '') {
        return fallback;
    }

    if (typeof value === 'object') {
        return value;
    }

    try {
        return JSON.parse(value);
    } catch (error) {
        return fallback;
    }
}

function normalizeInsight(row) {
    if (!row) {
        return null;
    }

    return {
        ...row,
        topics: parseJson(row.topics, []),
        issue_flags: parseJson(row.issue_flags, []),
        confidence: Number(row.confidence || 0)
    };
}

class ReviewAiInsight {
    static normalizeInsight(row) {
        return normalizeInsight(row);
    }

    static async upsert(insight) {
        const reviewId = Number.parseInt(insight.reviewId || insight.review_id, 10);
        if (!Number.isInteger(reviewId) || reviewId <= 0) {
            throw new Error('reviewId is required for review AI insight');
        }

        const topics = JSON.stringify(Array.isArray(insight.topics) ? insight.topics : []);
        const issueFlags = JSON.stringify(Array.isArray(insight.issueFlags || insight.issue_flags) ? (insight.issueFlags || insight.issue_flags) : []);

        await pool.execute(
            `INSERT INTO review_ai_insights (
                review_id, sentiment, topics, summary, issue_flags, confidence, model, analyzed_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
             ON DUPLICATE KEY UPDATE
                sentiment = VALUES(sentiment),
                topics = VALUES(topics),
                summary = VALUES(summary),
                issue_flags = VALUES(issue_flags),
                confidence = VALUES(confidence),
                model = VALUES(model),
                analyzed_at = VALUES(analyzed_at)`,
            [
                reviewId,
                insight.sentiment || 'neutral',
                topics,
                insight.summary || null,
                issueFlags,
                Math.max(0, Math.min(1, Number(insight.confidence || 0))),
                insight.model || null
            ]
        );

        return this.findByReviewId(reviewId);
    }

    static async findByReviewId(reviewId) {
        const [rows] = await pool.execute(
            'SELECT * FROM review_ai_insights WHERE review_id = ? LIMIT 1',
            [reviewId]
        );

        return normalizeInsight(rows[0] || null);
    }

    static async findByReviewIds(reviewIds = []) {
        const ids = [...new Set(reviewIds
            .map((id) => Number.parseInt(id, 10))
            .filter((id) => Number.isInteger(id) && id > 0)
        )];

        if (!ids.length) {
            return new Map();
        }

        const placeholders = ids.map(() => '?').join(', ');
        const [rows] = await pool.query(
            `SELECT * FROM review_ai_insights WHERE review_id IN (${placeholders})`,
            ids
        );

        return new Map(rows.map((row) => [Number(row.review_id), normalizeInsight(row)]));
    }

    static async getStats(filters = {}) {
        const params = [];
        const clauses = [];

        if (filters.sentiment) {
            clauses.push('sentiment = ?');
            params.push(filters.sentiment);
        }

        const whereClause = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
        const [rows] = await pool.query(
            `SELECT
                COUNT(*) AS total,
                SUM(sentiment = 'positive') AS positive,
                SUM(sentiment = 'neutral') AS neutral,
                SUM(sentiment = 'negative') AS negative
             FROM review_ai_insights
             ${whereClause}`,
            params
        );
        const row = rows[0] || {};

        return {
            total: Number(row.total || 0),
            positive: Number(row.positive || 0),
            neutral: Number(row.neutral || 0),
            negative: Number(row.negative || 0)
        };
    }
}

module.exports = ReviewAiInsight;
