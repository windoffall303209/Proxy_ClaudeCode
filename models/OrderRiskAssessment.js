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

function normalize(row) {
    if (!row) {
        return null;
    }

    return {
        ...row,
        risk_score: Number(row.risk_score || 0),
        reasons: parseJson(row.reasons, [])
    };
}

class OrderRiskAssessment {
    static normalize(row) {
        return normalize(row);
    }

    static async upsert(assessment) {
        const orderId = Number.parseInt(assessment.orderId || assessment.order_id, 10);
        if (!Number.isInteger(orderId) || orderId <= 0) {
            throw new Error('orderId is required for order risk assessment');
        }

        await pool.execute(
            `INSERT INTO order_risk_assessments (
                order_id, risk_score, risk_level, reasons, ai_summary,
                recommended_action, model, assessed_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
             ON DUPLICATE KEY UPDATE
                risk_score = VALUES(risk_score),
                risk_level = VALUES(risk_level),
                reasons = VALUES(reasons),
                ai_summary = VALUES(ai_summary),
                recommended_action = VALUES(recommended_action),
                model = VALUES(model),
                assessed_at = VALUES(assessed_at)`,
            [
                orderId,
                Math.max(0, Math.min(100, Number.parseInt(assessment.riskScore || assessment.risk_score, 10) || 0)),
                assessment.riskLevel || assessment.risk_level || 'low',
                JSON.stringify(Array.isArray(assessment.reasons) ? assessment.reasons : []),
                assessment.aiSummary || assessment.ai_summary || null,
                assessment.recommendedAction || assessment.recommended_action || null,
                assessment.model || null
            ]
        );

        return this.findByOrderId(orderId);
    }

    static async findByOrderId(orderId) {
        const [rows] = await pool.execute(
            'SELECT * FROM order_risk_assessments WHERE order_id = ? LIMIT 1',
            [orderId]
        );

        return normalize(rows[0] || null);
    }

    static async findByOrderIds(orderIds = []) {
        const ids = [...new Set(orderIds
            .map((id) => Number.parseInt(id, 10))
            .filter((id) => Number.isInteger(id) && id > 0)
        )];

        if (!ids.length) {
            return new Map();
        }

        const placeholders = ids.map(() => '?').join(', ');
        const [rows] = await pool.query(
            `SELECT * FROM order_risk_assessments WHERE order_id IN (${placeholders})`,
            ids
        );

        return new Map(rows.map((row) => [Number(row.order_id), normalize(row)]));
    }
}

module.exports = OrderRiskAssessment;
