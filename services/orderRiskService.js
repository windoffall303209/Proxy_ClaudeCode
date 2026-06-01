const pool = require('../config/database');
const Order = require('../models/Order');
const OrderRiskAssessment = require('../models/OrderRiskAssessment');
const { generateJson } = require('./aiJsonService');

function isBackgroundAutomationDisabled() {
    return process.env.NODE_ENV === 'test'
        || String(process.env.AI_AUTOMATION_ENABLED || 'true').toLowerCase() === 'false';
}

function addReason(reasons, code, label, points, detail = '') {
    reasons.push({ code, label, points, detail });
}

function getRiskLevel(score) {
    if (score >= 65) return 'high';
    if (score >= 35) return 'medium';
    return 'low';
}

function buildFallbackSummary(level, reasons) {
    if (!reasons.length) {
        return {
            summary: 'Không phát hiện dấu hiệu rủi ro đáng kể.',
            recommendedAction: 'Xử lý theo quy trình thông thường.'
        };
    }

    const topReasons = reasons
        .slice()
        .sort((left, right) => Number(right.points || 0) - Number(left.points || 0))
        .slice(0, 3)
        .map((reason) => reason.label.toLowerCase());

    return {
        summary: `Đơn có mức rủi ro ${level} do ${topReasons.join(', ')}.`,
        recommendedAction: level === 'high'
            ? 'Gọi xác nhận và kiểm tra lịch sử khách trước khi xử lý.'
            : level === 'medium'
                ? 'Kiểm tra nhanh thông tin giao hàng trước khi chuyển trạng thái.'
                : 'Xử lý theo quy trình thông thường.'
    };
}

function validateRiskAi(value, fallback) {
    return {
        summary: String(value?.summary || fallback.summary || '').trim().slice(0, 800),
        recommendedAction: String(value?.recommendedAction || value?.recommended_action || fallback.recommendedAction || '').trim().slice(0, 500)
    };
}

async function fetchRiskContext(order) {
    const phone = String(order.shipping_phone || '').trim();
    const addressLine = String(order.address_line || order.shipping_address_line || '').trim();
    const userId = Number.parseInt(order.user_id, 10);
    const [userStatsRows, phoneRows, addressRows, paymentRows, returnRows, productReturnRows] = await Promise.all([
        pool.execute(
            `SELECT
                COUNT(*) AS total_orders,
                SUM(status = 'cancelled') AS cancelled_orders,
                SUM(final_amount >= 2000000) AS high_value_orders
             FROM orders
             WHERE user_id = ?`,
            [userId]
        ),
        phone
            ? pool.execute(
                `SELECT COUNT(DISTINCT user_id) AS user_count, COUNT(*) AS order_count
                 FROM orders
                 WHERE shipping_phone = ?`,
                [phone]
            )
            : Promise.resolve([[{}]]),
        addressLine
            ? pool.execute(
                `SELECT COUNT(DISTINCT user_id) AS user_count, COUNT(*) AS order_count
                 FROM orders
                 WHERE shipping_address_line = ?`,
                [addressLine]
            )
            : Promise.resolve([[{}]]),
        pool.execute(
            `SELECT COUNT(*) AS failed_payments
             FROM payments
             WHERE order_id = ? AND status = 'failed'`,
            [order.id]
        ),
        pool.execute(
            `SELECT COUNT(*) AS return_requests
             FROM order_return_requests
             WHERE user_id = ?`,
            [userId]
        ),
        pool.execute(
            `SELECT COUNT(*) AS product_return_requests
             FROM order_items oi
             JOIN order_return_requests rr ON rr.order_id = oi.order_id
             WHERE oi.product_id IN (
                SELECT product_id FROM order_items WHERE order_id = ?
             )`,
            [order.id]
        )
    ]);

    return {
        userStats: userStatsRows[0][0] || {},
        phoneStats: phoneRows[0][0] || {},
        addressStats: addressRows[0][0] || {},
        paymentStats: paymentRows[0][0] || {},
        returnStats: returnRows[0][0] || {},
        productReturnStats: productReturnRows[0][0] || {}
    };
}

function buildRuleAssessment(order, context) {
    const reasons = [];
    const finalAmount = Number(order.final_amount || 0);
    const totalOrders = Number(context.userStats.total_orders || 0);
    const cancelledOrders = Number(context.userStats.cancelled_orders || 0);
    const returnRequests = Number(context.returnStats.return_requests || 0);
    const phoneUserCount = Number(context.phoneStats.user_count || 0);
    const addressUserCount = Number(context.addressStats.user_count || 0);
    const failedPayments = Number(context.paymentStats.failed_payments || 0);
    const productReturnRequests = Number(context.productReturnStats.product_return_requests || 0);

    if (totalOrders <= 1 && finalAmount >= 1000000) {
        addReason(reasons, 'new_user_high_value', 'Tài khoản mới đặt đơn giá trị cao', 25, `${finalAmount.toLocaleString('vi-VN')}đ`);
    }

    if (String(order.payment_method).toLowerCase() === 'cod' && finalAmount >= 1500000) {
        addReason(reasons, 'high_value_cod', 'Đơn COD giá trị cao', 22, `${finalAmount.toLocaleString('vi-VN')}đ`);
    }

    if (cancelledOrders >= 2) {
        addReason(reasons, 'repeat_cancellation', 'Khách từng hủy nhiều đơn', Math.min(30, cancelledOrders * 8), `${cancelledOrders} đơn hủy`);
    }

    if (returnRequests >= 2) {
        addReason(reasons, 'repeat_returns', 'Khách có nhiều yêu cầu đổi trả', Math.min(25, returnRequests * 7), `${returnRequests} yêu cầu`);
    }

    if (phoneUserCount >= 3) {
        addReason(reasons, 'shared_phone', 'Số điện thoại dùng cho nhiều tài khoản', 18, `${phoneUserCount} tài khoản`);
    }

    if (addressUserCount >= 3) {
        addReason(reasons, 'shared_address', 'Địa chỉ từng xuất hiện ở nhiều tài khoản', 15, `${addressUserCount} tài khoản`);
    }

    if (failedPayments >= 2) {
        addReason(reasons, 'failed_payment_attempts', 'Có nhiều lần thanh toán online thất bại', 12, `${failedPayments} lần`);
    }

    if (productReturnRequests >= 3) {
        addReason(reasons, 'return_prone_products', 'Sản phẩm trong đơn từng có nhiều yêu cầu đổi trả', 12, `${productReturnRequests} yêu cầu liên quan`);
    }

    const score = Math.min(100, reasons.reduce((sum, reason) => sum + Number(reason.points || 0), 0));
    return {
        score,
        level: getRiskLevel(score),
        reasons
    };
}

async function assessOrderRisk(orderId) {
    const order = typeof orderId === 'object' ? orderId : await Order.findById(orderId);
    if (!order) {
        return null;
    }

    const context = await fetchRiskContext(order);
    const ruleAssessment = buildRuleAssessment(order, context);
    const fallback = buildFallbackSummary(ruleAssessment.level, ruleAssessment.reasons);
    const result = await generateJson({
        systemPrompt: [
            'Bạn là trợ lý vận hành đơn hàng thương mại điện tử.',
            'Dựa trên reason codes đã tính bằng rule, hãy tóm tắt rủi ro và hành động đề xuất.',
            'Chỉ trả JSON với summary và recommendedAction. Không tự thêm dữ kiện mới.'
        ].join('\n'),
        userPrompt: JSON.stringify({
            orderCode: order.order_code,
            total: order.final_amount,
            paymentMethod: order.payment_method,
            riskLevel: ruleAssessment.level,
            reasons: ruleAssessment.reasons
        }),
        fallback,
        validate: validateRiskAi
    });

    return OrderRiskAssessment.upsert({
        orderId: order.id,
        riskScore: ruleAssessment.score,
        riskLevel: ruleAssessment.level,
        reasons: ruleAssessment.reasons,
        aiSummary: result.data.summary,
        recommendedAction: result.data.recommendedAction,
        model: result.model
    });
}

function scheduleOrderRiskAssessment(orderId) {
    if (isBackgroundAutomationDisabled()) {
        return;
    }

    const safeId = Number.parseInt(orderId, 10);
    if (!Number.isInteger(safeId) || safeId <= 0) {
        return;
    }

    setImmediate(() => {
        assessOrderRisk(safeId).catch((error) => {
            console.error('Order risk assessment error:', error.message || error);
        });
    });
}

async function attachOrderRiskAssessments(orders = []) {
    const ids = orders.map((order) => order.id).filter(Boolean);
    const riskMap = await OrderRiskAssessment.findByOrderIds(ids).catch(() => new Map());

    orders.forEach((order) => {
        order.risk_assessment = riskMap.get(Number(order.id)) || null;
        if (!order.risk_assessment) {
            scheduleOrderRiskAssessment(order.id);
        }
    });

    return orders;
}

module.exports = {
    assessOrderRisk,
    attachOrderRiskAssessments,
    scheduleOrderRiskAssessment
};
