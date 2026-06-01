const crypto = require('crypto');
const pool = require('../config/database');

function safeJson(value) {
    if (!value || typeof value !== 'object') {
        return null;
    }

    return JSON.stringify(value);
}

class UserProductEvent {
    static hashSignals(rows = []) {
        return crypto
            .createHash('sha256')
            .update(JSON.stringify(rows.map((row) => [
                row.product_id,
                row.event_type,
                row.weight,
                row.created_at
            ])))
            .digest('hex');
    }

    static async record({ userId = null, sessionId = null, productId, eventType, weight = 1, metadata = null }) {
        const safeProductId = Number.parseInt(productId, 10);
        if (!Number.isInteger(safeProductId) || safeProductId <= 0) {
            return null;
        }

        const safeUserId = userId ? Number.parseInt(userId, 10) : null;
        const safeEventType = ['view', 'add_cart', 'checkout', 'purchase', 'review'].includes(eventType)
            ? eventType
            : 'view';

        const [result] = await pool.execute(
            `INSERT INTO user_product_events (
                user_id, session_id, product_id, event_type, weight, metadata
             ) VALUES (?, ?, ?, ?, ?, ?)`,
            [
                Number.isInteger(safeUserId) && safeUserId > 0 ? safeUserId : null,
                sessionId || null,
                safeProductId,
                safeEventType,
                Number(weight) || 1,
                safeJson(metadata)
            ]
        );

        return result.insertId;
    }

    static async listRecentByUser(userId, limit = 200) {
        const safeUserId = Number.parseInt(userId, 10);
        if (!Number.isInteger(safeUserId) || safeUserId <= 0) {
            return [];
        }

        const safeLimit = Math.min(500, Math.max(1, Number.parseInt(limit, 10) || 200));
        const [rows] = await pool.query(
            `SELECT e.*, p.category_id, p.name AS product_name, p.price,
                    GROUP_CONCAT(DISTINCT NULLIF(TRIM(pv.color), '') ORDER BY pv.color SEPARATOR ', ') AS variant_colors,
                    GROUP_CONCAT(DISTINCT NULLIF(TRIM(pv.size), '') ORDER BY pv.size SEPARATOR ', ') AS variant_sizes
             FROM user_product_events e
             JOIN products p ON p.id = e.product_id
             LEFT JOIN product_variants pv ON pv.product_id = p.id
             WHERE e.user_id = ?
             GROUP BY e.id
             ORDER BY e.created_at DESC, e.id DESC
             LIMIT ?`,
            [safeUserId, safeLimit]
        );

        return rows;
    }

    static async upsertRecommendationProfile(userId, profile, sourceHash) {
        const safeUserId = Number.parseInt(userId, 10);
        if (!Number.isInteger(safeUserId) || safeUserId <= 0) {
            return null;
        }

        await pool.execute(
            `INSERT INTO user_recommendation_profiles (user_id, profile_json, source_hash, refreshed_at)
             VALUES (?, ?, ?, NOW())
             ON DUPLICATE KEY UPDATE
                profile_json = VALUES(profile_json),
                source_hash = VALUES(source_hash),
                refreshed_at = VALUES(refreshed_at)`,
            [safeUserId, JSON.stringify(profile || {}), sourceHash || '']
        );
    }

    static async getRecommendationProfile(userId) {
        const [rows] = await pool.execute(
            'SELECT * FROM user_recommendation_profiles WHERE user_id = ? LIMIT 1',
            [userId]
        );
        const row = rows[0];
        if (!row) {
            return null;
        }

        try {
            row.profile = JSON.parse(row.profile_json || '{}');
        } catch (error) {
            row.profile = {};
        }
        return row;
    }
}

module.exports = UserProductEvent;
