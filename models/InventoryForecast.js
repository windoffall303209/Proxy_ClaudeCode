const pool = require('../config/database');

function normalize(row) {
    if (!row) {
        return null;
    }

    return {
        ...row,
        current_stock: Number(row.current_stock || 0),
        avg_daily_sales_7d: Number(row.avg_daily_sales_7d || 0),
        avg_daily_sales_30d: Number(row.avg_daily_sales_30d || 0),
        days_until_stockout: row.days_until_stockout === null || row.days_until_stockout === undefined
            ? null
            : Number(row.days_until_stockout),
        suggested_restock_qty: Number(row.suggested_restock_qty || 0)
    };
}

class InventoryForecast {
    static normalize(row) {
        return normalize(row);
    }

    static async upsert(forecast) {
        const productId = Number.parseInt(forecast.productId || forecast.product_id, 10);
        if (!Number.isInteger(productId) || productId <= 0) {
            throw new Error('productId is required for inventory forecast');
        }

        const variantId = forecast.variantId || forecast.variant_id || null;
        await pool.execute(
            `INSERT INTO inventory_forecasts (
                product_id, variant_id, current_stock, avg_daily_sales_7d,
                avg_daily_sales_30d, days_until_stockout, risk_level,
                suggested_restock_qty, ai_summary, calculated_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
             ON DUPLICATE KEY UPDATE
                current_stock = VALUES(current_stock),
                avg_daily_sales_7d = VALUES(avg_daily_sales_7d),
                avg_daily_sales_30d = VALUES(avg_daily_sales_30d),
                days_until_stockout = VALUES(days_until_stockout),
                risk_level = VALUES(risk_level),
                suggested_restock_qty = VALUES(suggested_restock_qty),
                ai_summary = VALUES(ai_summary),
                calculated_at = VALUES(calculated_at)`,
            [
                productId,
                variantId,
                Number.parseInt(forecast.currentStock || forecast.current_stock, 10) || 0,
                Number(forecast.avgDailySales7d || forecast.avg_daily_sales_7d || 0),
                Number(forecast.avgDailySales30d || forecast.avg_daily_sales_30d || 0),
                forecast.daysUntilStockout || forecast.days_until_stockout || null,
                forecast.riskLevel || forecast.risk_level || 'low',
                Number.parseInt(forecast.suggestedRestockQty || forecast.suggested_restock_qty, 10) || 0,
                forecast.aiSummary || forecast.ai_summary || null
            ]
        );
    }

    static async listDashboardAlerts(limit = 8) {
        const safeLimit = Math.min(30, Math.max(1, Number.parseInt(limit, 10) || 8));
        const [rows] = await pool.query(
            `SELECT f.*, p.name AS product_name, p.slug AS product_slug,
                    p.price, p.is_active,
                    c.name AS category_name,
                    (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = TRUE LIMIT 1) AS product_image
             FROM inventory_forecasts f
             JOIN products p ON p.id = f.product_id
             LEFT JOIN categories c ON c.id = p.category_id
             WHERE p.is_active = TRUE
             ORDER BY FIELD(f.risk_level, 'out', 'high', 'medium', 'slow', 'low'),
                      f.days_until_stockout IS NULL ASC,
                      f.days_until_stockout ASC,
                      f.calculated_at DESC
             LIMIT ?`,
            [safeLimit]
        );

        return rows.map(normalize);
    }

    static async latestCalculatedAt() {
        const [rows] = await pool.query('SELECT MAX(calculated_at) AS latest FROM inventory_forecasts');
        return rows[0]?.latest || null;
    }
}

module.exports = InventoryForecast;
