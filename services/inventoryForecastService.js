const InventoryForecast = require('../models/InventoryForecast');
const pool = require('../config/database');

function isBackgroundAutomationDisabled() {
    return process.env.NODE_ENV === 'test'
        || String(process.env.AI_AUTOMATION_ENABLED || 'true').toLowerCase() === 'false';
}

function getRiskLevel(currentStock, avgDailySales7d, avgDailySales30d, daysUntilStockout) {
    const velocity = Math.max(Number(avgDailySales7d || 0), Number(avgDailySales30d || 0) * 0.7);

    if (currentStock <= 0) return 'out';
    if (velocity <= 0 && currentStock > 0) return 'slow';
    if (daysUntilStockout !== null && daysUntilStockout <= 7) return 'high';
    if (daysUntilStockout !== null && daysUntilStockout <= 14) return 'medium';
    return 'low';
}

function buildSummary(row, riskLevel, daysUntilStockout, suggestedRestockQty) {
    const name = row.product_name || 'Sản phẩm';
    if (riskLevel === 'out') {
        return `${name} đã hết hàng. Nên kiểm tra biến thể còn bán và nhập lại trước khi chạy khuyến mãi.`;
    }
    if (riskLevel === 'high') {
        return `${name} còn ${row.current_stock} sản phẩm, dự kiến hết trong ${Math.ceil(daysUntilStockout)} ngày. Nên nhập thêm khoảng ${suggestedRestockQty} sản phẩm.`;
    }
    if (riskLevel === 'medium') {
        return `${name} có nguy cơ thiếu hàng trong khoảng ${Math.ceil(daysUntilStockout)} ngày tới. Theo dõi thêm trước khi đẩy sale.`;
    }
    if (riskLevel === 'slow') {
        return `${name} chưa có tốc độ bán rõ trong 30 ngày gần đây. Có thể cân nhắc đưa vào chương trình hiển thị hoặc sale nhẹ.`;
    }
    return `${name} đang ở mức tồn kho ổn định.`;
}

function normalizeForecast(row) {
    const currentStock = Math.max(0, Number.parseInt(row.current_stock, 10) || 0);
    const avgDailySales7d = Number(row.sold_7d || 0) / 7;
    const avgDailySales30d = Number(row.sold_30d || 0) / 30;
    const velocity = Math.max(avgDailySales7d, avgDailySales30d * 0.7);
    const daysUntilStockout = velocity > 0 ? Number((currentStock / velocity).toFixed(2)) : null;
    const riskLevel = getRiskLevel(currentStock, avgDailySales7d, avgDailySales30d, daysUntilStockout);
    const suggestedRestockQty = ['out', 'high', 'medium'].includes(riskLevel)
        ? Math.max(0, Math.ceil(velocity * 21 - currentStock))
        : 0;

    return {
        productId: row.product_id,
        currentStock,
        avgDailySales7d: Number(avgDailySales7d.toFixed(3)),
        avgDailySales30d: Number(avgDailySales30d.toFixed(3)),
        daysUntilStockout,
        riskLevel,
        suggestedRestockQty,
        aiSummary: buildSummary({ ...row, current_stock: currentStock }, riskLevel, daysUntilStockout, suggestedRestockQty)
    };
}

async function calculateForecastRows(limit = 300) {
    const safeLimit = Math.min(1000, Math.max(1, Number.parseInt(limit, 10) || 300));
    const [rows] = await pool.query(
        `SELECT
            p.id AS product_id,
            p.name AS product_name,
            p.slug AS product_slug,
            p.stock_quantity AS current_stock,
            p.sold_count,
            c.name AS category_name,
            COALESCE(SUM(CASE WHEN o.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN oi.quantity ELSE 0 END), 0) AS sold_7d,
            COALESCE(SUM(CASE WHEN o.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN oi.quantity ELSE 0 END), 0) AS sold_30d,
            COALESCE(SUM(CASE WHEN o.created_at >= DATE_SUB(NOW(), INTERVAL 60 DAY) THEN oi.quantity ELSE 0 END), 0) AS sold_60d
         FROM products p
         LEFT JOIN categories c ON c.id = p.category_id
         LEFT JOIN order_items oi ON oi.product_id = p.id
         LEFT JOIN orders o ON o.id = oi.order_id
            AND o.status IN ('confirmed', 'processing', 'shipping', 'delivered', 'completed')
         WHERE p.is_active = TRUE
         GROUP BY p.id
         ORDER BY p.stock_quantity ASC, sold_30d DESC, p.sold_count DESC
         LIMIT ?`,
        [safeLimit]
    );

    return rows;
}

async function refreshInventoryForecasts(options = {}) {
    const rows = await calculateForecastRows(options.limit);
    const forecasts = rows.map(normalizeForecast);

    for (const forecast of forecasts) {
        await InventoryForecast.upsert(forecast);
    }

    return {
        processed: forecasts.length,
        highRisk: forecasts.filter((item) => ['out', 'high'].includes(item.riskLevel)).length
    };
}

async function getDashboardInventoryAlerts(limit = 8) {
    if (isBackgroundAutomationDisabled()) {
        return [];
    }

    let alerts = await InventoryForecast.listDashboardAlerts(limit).catch(() => []);
    const latest = await InventoryForecast.latestCalculatedAt().catch(() => null);
    const isStale = !latest || (Date.now() - new Date(latest).getTime()) > 30 * 60 * 1000;

    if (!alerts.length || isStale) {
        await refreshInventoryForecasts({ limit: 300 }).catch((error) => {
            console.error('Inventory forecast refresh error:', error.message || error);
        });
        alerts = await InventoryForecast.listDashboardAlerts(limit).catch(() => alerts);
    }

    return alerts;
}

function scheduleInventoryForecastRefresh() {
    if (isBackgroundAutomationDisabled()) {
        return;
    }

    setImmediate(() => {
        refreshInventoryForecasts({ limit: 300 }).catch((error) => {
            console.error('Inventory forecast background error:', error.message || error);
        });
    });
}

module.exports = {
    refreshInventoryForecasts,
    getDashboardInventoryAlerts,
    scheduleInventoryForecastRefresh
};
