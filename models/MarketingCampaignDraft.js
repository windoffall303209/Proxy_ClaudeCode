const pool = require('../config/database');

function normalize(row) {
    if (!row) {
        return null;
    }

    return {
        ...row,
        source_id: row.source_id === null || row.source_id === undefined ? null : Number(row.source_id)
    };
}

class MarketingCampaignDraft {
    static async create(draft) {
        const [result] = await pool.execute(
            `INSERT INTO marketing_campaign_drafts (
                source_type, source_id, segment, subject, preview_text,
                email_html, sms_text, banner_copy, status, model, created_by
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)`,
            [
                draft.sourceType || draft.source_type || 'manual',
                draft.sourceId || draft.source_id || null,
                draft.segment || 'newsletter',
                draft.subject,
                draft.previewText || draft.preview_text || null,
                draft.emailHtml || draft.email_html,
                draft.smsText || draft.sms_text || null,
                draft.bannerCopy || draft.banner_copy || null,
                draft.model || null,
                draft.createdBy || draft.created_by || null
            ]
        );

        return this.findById(result.insertId);
    }

    static async findById(id) {
        const [rows] = await pool.execute(
            'SELECT * FROM marketing_campaign_drafts WHERE id = ? LIMIT 1',
            [id]
        );

        return normalize(rows[0] || null);
    }

    static async listBySource(sourceType, sourceIds = [], limit = 10) {
        const safeType = String(sourceType || '').trim();
        const ids = [...new Set(sourceIds
            .map((id) => Number.parseInt(id, 10))
            .filter((id) => Number.isInteger(id) && id > 0)
        )];

        if (!safeType || !ids.length) {
            return [];
        }

        const safeLimit = Math.min(50, Math.max(1, Number.parseInt(limit, 10) || 10));
        const placeholders = ids.map(() => '?').join(', ');
        const [rows] = await pool.query(
            `SELECT d.*, u.full_name AS created_by_name
             FROM marketing_campaign_drafts d
             LEFT JOIN users u ON u.id = d.created_by
             WHERE d.source_type = ? AND d.source_id IN (${placeholders})
             ORDER BY d.created_at DESC
             LIMIT ?`,
            [safeType, ...ids, safeLimit]
        );

        return rows.map(normalize);
    }

    static async mapLatestBySource(sourceType, sourceIds = []) {
        const drafts = await this.listBySource(sourceType, sourceIds, Math.max(sourceIds.length * 3, 10));
        const map = new Map();
        drafts.forEach((draft) => {
            const key = Number(draft.source_id);
            if (!map.has(key)) {
                map.set(key, draft);
            }
        });
        return map;
    }
}

module.exports = MarketingCampaignDraft;
