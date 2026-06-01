require('dotenv').config();

const pool = require('../config/database');
const { analyzeReview } = require('../services/reviewAiInsightService');
const { assessOrderRisk } = require('../services/orderRiskService');
const { refreshInventoryForecasts } = require('../services/inventoryForecastService');

async function syncReviewInsights(limit = 100) {
    const [rows] = await pool.query(
        `SELECT r.id
         FROM reviews r
         LEFT JOIN review_ai_insights rai ON rai.review_id = r.id
         WHERE rai.id IS NULL
         ORDER BY r.created_at DESC
         LIMIT ?`,
        [limit]
    );

    let processed = 0;
    for (const row of rows) {
        await analyzeReview(row.id);
        processed += 1;
    }
    return processed;
}

async function syncOrderRisks(limit = 100) {
    const [rows] = await pool.query(
        `SELECT o.id
         FROM orders o
         LEFT JOIN order_risk_assessments ora ON ora.order_id = o.id
         WHERE ora.id IS NULL
         ORDER BY o.created_at DESC
         LIMIT ?`,
        [limit]
    );

    let processed = 0;
    for (const row of rows) {
        await assessOrderRisk(row.id);
        processed += 1;
    }
    return processed;
}

async function main() {
    const reviewLimit = Number.parseInt(process.env.AI_SYNC_REVIEW_LIMIT, 10) || 100;
    const orderLimit = Number.parseInt(process.env.AI_SYNC_ORDER_LIMIT, 10) || 100;
    const inventoryLimit = Number.parseInt(process.env.AI_SYNC_INVENTORY_LIMIT, 10) || 300;

    const inventory = await refreshInventoryForecasts({ limit: inventoryLimit });
    const reviews = await syncReviewInsights(reviewLimit);
    const orders = await syncOrderRisks(orderLimit);

    console.log(JSON.stringify({ inventory, reviews, orders }, null, 2));
}

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await pool.end();
    });
