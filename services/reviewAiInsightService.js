const pool = require('../config/database');
const ReviewAiInsight = require('../models/ReviewAiInsight');
const { generateJson } = require('./aiJsonService');

function isBackgroundAutomationDisabled() {
    return process.env.NODE_ENV === 'test'
        || String(process.env.AI_AUTOMATION_ENABLED || 'true').toLowerCase() === 'false';
}

function normalizeText(value) {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .trim();
}

function unique(values = []) {
    return [...new Set(values.filter(Boolean))];
}

const TOPIC_KEYWORDS = [
    { topic: 'size', keywords: ['size', 'kich co', 'rong', 'chat', 'vua', 'form', 'fit', 'ngan', 'dai'] },
    { topic: 'fabric', keywords: ['vai', 'chat lieu', 'mem', 'mong', 'day', 'co gian', 'thoang', 'nong'] },
    { topic: 'color', keywords: ['mau', 'lem', 'phai', 'khac anh', 'sai mau'] },
    { topic: 'delivery', keywords: ['giao', 'ship', 'van chuyen', 'dong goi', 'hop', 'nhanh', 'cham'] },
    { topic: 'price', keywords: ['gia', 'dat', 're', 'dang tien', 'khuyen mai'] },
    { topic: 'quality', keywords: ['loi', 'rach', 'bung chi', 'nut', 'duong may', 'kem', 'ben'] },
    { topic: 'service', keywords: ['tu van', 'ho tro', 'nhan vien', 'doi tra'] }
];

function inferTopics(comment = '') {
    const text = normalizeText(comment);
    return unique(TOPIC_KEYWORDS
        .filter((item) => item.keywords.some((keyword) => text.includes(keyword)))
        .map((item) => item.topic));
}

function inferSentiment(rating, comment = '') {
    const normalized = normalizeText(comment);
    const negativeWords = ['that vong', 'te', 'kem', 'loi', 'rach', 'cham', 'khong hai long', 'qua mong', 'sai'];
    const positiveWords = ['dep', 'tot', 'ung y', 'hai long', 'mem', 'nhanh', 'vua', 'xinh', 'dang tien'];
    const score = Number(rating || 0);

    if (score <= 2 || negativeWords.some((word) => normalized.includes(word))) {
        return 'negative';
    }

    if (score >= 4 && positiveWords.some((word) => normalized.includes(word))) {
        return 'positive';
    }

    if (score >= 4) {
        return 'positive';
    }

    if (score === 3) {
        return 'neutral';
    }

    return 'neutral';
}

function inferIssueFlags(sentiment, topics) {
    if (sentiment !== 'negative') {
        return [];
    }

    return unique(topics.map((topic) => {
        if (topic === 'size') return 'size_mismatch';
        if (topic === 'fabric') return 'fabric_complaint';
        if (topic === 'color') return 'image_or_color_mismatch';
        if (topic === 'delivery') return 'delivery_complaint';
        if (topic === 'quality') return 'quality_complaint';
        return `${topic}_complaint`;
    }));
}

function buildFallbackInsight(review) {
    const topics = inferTopics(review.comment);
    const sentiment = inferSentiment(review.rating, review.comment);
    const issueFlags = inferIssueFlags(sentiment, topics);
    const productName = review.product_name || 'sản phẩm';
    const summary = sentiment === 'negative'
        ? `Khách có phản hồi tiêu cực về ${topics.length ? topics.join(', ') : productName}.`
        : sentiment === 'positive'
            ? `Khách đánh giá tốt ${productName}${topics.length ? `, nổi bật ở ${topics.join(', ')}` : ''}.`
            : `Review trung tính cho ${productName}.`;

    return {
        sentiment,
        topics,
        summary,
        issueFlags,
        confidence: sentiment === 'neutral' && !topics.length ? 0.55 : 0.74
    };
}

function validateInsight(value, fallback) {
    const allowedSentiments = new Set(['positive', 'neutral', 'negative']);
    const sentiment = allowedSentiments.has(value?.sentiment) ? value.sentiment : fallback.sentiment;
    const topics = Array.isArray(value?.topics) ? value.topics.map((item) => String(item).trim()).filter(Boolean).slice(0, 8) : fallback.topics;
    const issueFlags = Array.isArray(value?.issueFlags)
        ? value.issueFlags.map((item) => String(item).trim()).filter(Boolean).slice(0, 8)
        : (Array.isArray(value?.issue_flags) ? value.issue_flags : fallback.issueFlags);

    return {
        sentiment,
        topics,
        summary: String(value?.summary || fallback.summary || '').trim().slice(0, 700),
        issueFlags,
        confidence: Math.max(0, Math.min(1, Number(value?.confidence || fallback.confidence || 0)))
    };
}

async function fetchReviewContext(reviewId) {
    const [rows] = await pool.execute(
        `SELECT r.*, p.name AS product_name, p.slug AS product_slug, u.full_name AS user_name, o.order_code
         FROM reviews r
         JOIN products p ON p.id = r.product_id
         JOIN users u ON u.id = r.user_id
         JOIN orders o ON o.id = r.order_id
         WHERE r.id = ?
         LIMIT 1`,
        [reviewId]
    );

    return rows[0] || null;
}

async function analyzeReview(reviewInput) {
    const review = reviewInput?.comment !== undefined
        ? reviewInput
        : await fetchReviewContext(reviewInput);

    if (!review) {
        return null;
    }

    const fallback = buildFallbackInsight(review);
    const systemPrompt = [
        'Bạn phân tích review thương mại điện tử thời trang.',
        'Chỉ trả về JSON hợp lệ theo schema: sentiment, topics, summary, issueFlags, confidence.',
        'topics nên dùng nhãn ngắn bằng tiếng Anh như size, fabric, color, delivery, price, quality, service.',
        'issueFlags chỉ dùng khi có rủi ro cần admin xử lý.'
    ].join('\n');
    const userPrompt = JSON.stringify({
        product: review.product_name,
        rating: review.rating,
        comment: review.comment || '',
        orderCode: review.order_code || ''
    });
    const result = await generateJson({
        systemPrompt,
        userPrompt,
        fallback,
        validate: validateInsight
    });

    return ReviewAiInsight.upsert({
        reviewId: review.id,
        ...result.data,
        model: result.model
    });
}

function scheduleReviewInsightAnalysis(reviewId) {
    if (isBackgroundAutomationDisabled()) {
        return;
    }

    const safeId = Number.parseInt(reviewId, 10);
    if (!Number.isInteger(safeId) || safeId <= 0) {
        return;
    }

    setImmediate(() => {
        analyzeReview(safeId).catch((error) => {
            console.error('Review AI insight error:', error.message || error);
        });
    });
}

module.exports = {
    analyzeReview,
    scheduleReviewInsightAnalysis
};
