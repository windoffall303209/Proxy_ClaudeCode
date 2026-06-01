const Product = require('../models/Product');
const UserProductEvent = require('../models/UserProductEvent');
const pool = require('../config/database');

const EVENT_WEIGHTS = {
    view: 1,
    add_cart: 4,
    checkout: 5,
    purchase: 8,
    review: 6
};

function isAutomationDisabled() {
    return process.env.NODE_ENV === 'test'
        || String(process.env.AI_AUTOMATION_ENABLED || 'true').toLowerCase() === 'false';
}

function isMissingAutomationTableError(error) {
    return error?.code === 'ER_NO_SUCH_TABLE'
        || /user_product_events|user_recommendation_profiles/i.test(String(error?.message || ''));
}

function normalizeTokens(value) {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .split(/[^a-z0-9]+/i)
        .map((token) => token.trim())
        .filter((token) => token.length >= 2 && !['nam', 'nu', 'cho', 'the', 'and', 'voi', 'san', 'pham'].includes(token));
}

function getSessionId(req) {
    return req?.sessionID || null;
}

function getUserId(req) {
    return req?.user?.id || null;
}

async function recordProductEvent(req, { productId, eventType, weight, metadata } = {}) {
    if (isAutomationDisabled()) {
        return null;
    }

    return UserProductEvent.record({
        userId: getUserId(req),
        sessionId: getSessionId(req),
        productId,
        eventType,
        weight: weight || EVENT_WEIGHTS[eventType] || 1,
        metadata
    }).catch((error) => {
        if (!isMissingAutomationTableError(error)) {
            console.error('Product event tracking error:', error.message || error);
        }
        return null;
    });
}

async function recordOrderPurchaseEvents({ userId, sessionId = null, orderId }) {
    if (isAutomationDisabled()) {
        return;
    }

    const safeOrderId = Number.parseInt(orderId, 10);
    if (!Number.isInteger(safeOrderId) || safeOrderId <= 0) {
        return;
    }

    const [items] = await pool.execute(
        'SELECT product_id, variant_id, quantity, subtotal FROM order_items WHERE order_id = ?',
        [safeOrderId]
    );

    for (const item of items) {
        await UserProductEvent.record({
            userId,
            sessionId,
            productId: item.product_id,
            eventType: 'purchase',
            weight: EVENT_WEIGHTS.purchase * Math.max(1, Number(item.quantity || 1)),
            metadata: {
                orderId: safeOrderId,
                variantId: item.variant_id || null,
                subtotal: Number(item.subtotal || 0)
            }
        });
    }
}

function scheduleOrderPurchaseEvents({ userId, sessionId = null, orderId }) {
    if (isAutomationDisabled()) {
        return;
    }

    setImmediate(() => {
        recordOrderPurchaseEvents({ userId, sessionId, orderId }).catch((error) => {
            if (!isMissingAutomationTableError(error)) {
                console.error('Purchase event tracking error:', error.message || error);
            }
        });
    });
}

async function getPurchaseSignals(userId) {
    const [rows] = await pool.execute(
        `SELECT
            oi.product_id,
            oi.quantity,
            oi.price,
            p.category_id,
            p.name AS product_name,
            pv.color AS variant_color,
            pv.size AS variant_size,
            o.created_at
         FROM orders o
         JOIN order_items oi ON oi.order_id = o.id
         JOIN products p ON p.id = oi.product_id
         LEFT JOIN product_variants pv ON pv.id = oi.variant_id
         WHERE o.user_id = ?
           AND o.status IN ('pending', 'confirmed', 'processing', 'shipping', 'delivered', 'completed')
         ORDER BY o.created_at DESC
         LIMIT 120`,
        [userId]
    );

    return rows.map((row) => ({
        ...row,
        event_type: 'purchase',
        weight: EVENT_WEIGHTS.purchase * Math.max(1, Number(row.quantity || 1))
    }));
}

function buildPreferenceProfile(signals = []) {
    const categoryScores = new Map();
    const tokenScores = new Map();
    const purchasedProductIds = new Set();
    const priceValues = [];

    signals.forEach((signal, index) => {
        const baseWeight = Number(signal.weight || EVENT_WEIGHTS[signal.event_type] || 1);
        const recencyMultiplier = Math.max(0.35, 1 - (index / Math.max(signals.length, 1)) * 0.5);
        const weight = baseWeight * recencyMultiplier;
        const productId = Number(signal.product_id);
        const categoryId = Number(signal.category_id);

        if (signal.event_type === 'purchase' && productId > 0) {
            purchasedProductIds.add(productId);
        }

        if (categoryId > 0) {
            categoryScores.set(categoryId, (categoryScores.get(categoryId) || 0) + weight);
        }

        [
            signal.product_name,
            signal.variant_color,
            signal.variant_size,
            signal.variant_colors,
            signal.variant_sizes
        ].flatMap(normalizeTokens).forEach((token) => {
            tokenScores.set(token, (tokenScores.get(token) || 0) + weight);
        });

        const price = Number(signal.price || 0);
        if (price > 0) {
            priceValues.push(price);
        }
    });

    const sortedPrices = priceValues.sort((left, right) => left - right);
    const medianPrice = sortedPrices.length
        ? sortedPrices[Math.floor(sortedPrices.length / 2)]
        : 0;

    return {
        categoryScores,
        tokenScores,
        purchasedProductIds,
        medianPrice,
        preferredCategories: [...categoryScores.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id]) => id),
        preferredTokens: [...tokenScores.entries()].sort((a, b) => b[1] - a[1]).slice(0, 16).map(([token]) => token)
    };
}

function scoreCandidate(product, profile) {
    const productId = Number(product.id);
    const categoryScore = profile.categoryScores.get(Number(product.category_id)) || 0;
    const tokens = [
        product.name,
        product.category_name,
        product.variant_colors,
        product.variant_sizes,
        product.description
    ].flatMap(normalizeTokens);
    const tokenScore = tokens.reduce((sum, token) => sum + (profile.tokenScores.get(token) || 0), 0);
    const soldScore = Math.min(20, Number(product.sold_count || 0) / 10);
    const ratingScore = Math.min(10, Number(product.average_rating || 0) * 2);
    const stockPenalty = Number(product.stock_quantity || 0) <= 0 ? -100 : 0;
    const purchasedPenalty = profile.purchasedProductIds.has(productId) ? -35 : 0;
    const price = Number(product.final_price || product.display_price || product.price || 0);
    const priceScore = profile.medianPrice > 0 && price > 0
        ? Math.max(-12, 12 - Math.abs(price - profile.medianPrice) / Math.max(profile.medianPrice, 1) * 16)
        : 0;

    return (categoryScore * 8) + (tokenScore * 2.5) + soldScore + ratingScore + priceScore + stockPenalty + purchasedPenalty;
}

async function getPersonalizedRecommendations(userId, limit = 30) {
    const safeUserId = Number.parseInt(userId, 10);
    const safeLimit = Math.min(60, Math.max(1, Number.parseInt(limit, 10) || 30));
    if (!Number.isInteger(safeUserId) || safeUserId <= 0) {
        return [];
    }

    if (isAutomationDisabled()) {
        return Product.getForYouRecommendations(safeUserId, safeLimit);
    }

    const [eventSignals, purchaseSignals] = await Promise.all([
        UserProductEvent.listRecentByUser(safeUserId, 220).catch(() => []),
        getPurchaseSignals(safeUserId).catch(() => [])
    ]);
    const signals = [...eventSignals, ...purchaseSignals];

    if (!signals.length) {
        return Product.getForYouRecommendations(safeUserId, safeLimit);
    }

    const profile = buildPreferenceProfile(signals);
    await UserProductEvent.upsertRecommendationProfile(safeUserId, {
        preferredCategories: profile.preferredCategories,
        preferredTokens: profile.preferredTokens,
        medianPrice: profile.medianPrice
    }, UserProductEvent.hashSignals(signals)).catch(() => {});

    const categoryIds = profile.preferredCategories.length ? profile.preferredCategories : null;
    const candidates = await Product.findAll({
        ...(categoryIds ? { category_ids: categoryIds } : {}),
        sort_by: 'sold_count',
        sort_order: 'DESC',
        prioritize_in_stock: true,
        use_final_price: true,
        limit: Math.max(safeLimit * 4, 80),
        offset: 0
    });

    const ranked = candidates
        .map((product) => ({
            ...product,
            recommendation_score: scoreCandidate(product, profile)
        }))
        .sort((left, right) => Number(right.recommendation_score || 0) - Number(left.recommendation_score || 0));

    if (ranked.length >= safeLimit) {
        return ranked.slice(0, safeLimit);
    }

    const fallback = await Product.getBestSellers(safeLimit + ranked.length);
    const seenIds = new Set(ranked.map((product) => Number(product.id)));
    return [
        ...ranked,
        ...fallback.filter((product) => !seenIds.has(Number(product.id)))
    ].slice(0, safeLimit);
}

module.exports = {
    recordProductEvent,
    scheduleOrderPurchaseEvents,
    getPersonalizedRecommendations
};
