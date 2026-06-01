// Admin review reporting controller.
const XLSX = require('xlsx');
const Review = require('../../models/Review');
const { scheduleReviewInsightAnalysis } = require('../../services/reviewAiInsightService');

function normalizeProductIds(value) {
    const values = Array.isArray(value) ? value : [value];
    return [...new Set(values
        .flatMap((item) => String(item || '').split(','))
        .map((item) => Number.parseInt(item, 10))
        .filter((id) => Number.isInteger(id) && id > 0)
    )];
}

function normalizeRatings(value) {
    const values = Array.isArray(value) ? value : [value];
    return [...new Set(values
        .flatMap((item) => String(item || '').split(','))
        .map((item) => Number.parseInt(item, 10))
        .filter((rating) => Number.isInteger(rating) && rating >= 1 && rating <= 5)
    )];
}

function getReviewFilters(query = {}) {
    const productIds = normalizeProductIds(query.product_ids || query.product_id);
    const ratings = normalizeRatings(query.ratings || query.rating);
    const sentiment = String(query.sentiment || '').trim().toLowerCase();
    return {
        product_ids: productIds,
        ratings,
        sentiment: ['positive', 'neutral', 'negative'].includes(sentiment) ? sentiment : '',
        search: typeof query.search === 'string' ? query.search.trim() : '',
        page: query.page || 1,
        limit: query.limit || 20
    };
}

function buildExportFilename(filters = {}) {
    const productIds = normalizeProductIds(filters.product_ids || filters.product_id);
    if (productIds.length === 1) {
        return `wind-of-fall-reviews-product-${productIds[0]}.xlsx`;
    }

    if (productIds.length > 1) {
        return 'wind-of-fall-reviews-products.xlsx';
    }

    if (filters.ratings?.length || filters.rating || filters.search) {
        return 'wind-of-fall-reviews-filtered.xlsx';
    }

    return 'wind-of-fall-reviews-all.xlsx';
}

function formatDateTime(value) {
    if (!value) return '';
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('vi-VN');
}

function buildReviewExportRows(reviews = []) {
    return reviews.map((review) => {
        const mediaUrls = Array.isArray(review.media)
            ? review.media.map((media) => media.media_url).filter(Boolean).join('\n')
            : '';

        return {
            'Mã review': review.id,
            'Mã sản phẩm': review.product_id,
            'Sản phẩm': review.product_name || '',
            'Slug sản phẩm': review.product_slug || '',
            'Khách hàng': review.user_name || '',
            Email: review.user_email || '',
            'Mã đơn hàng': review.order_code || '',
            'Số sao': review.rating,
            'Nội dung': review.comment || '',
            'Đã mua hàng': review.is_verified ? 'Có' : 'Không',
            'AI sentiment': review.ai_insight?.sentiment || '',
            'AI topics': Array.isArray(review.ai_insight?.topics) ? review.ai_insight.topics.join(', ') : '',
            'AI summary': review.ai_insight?.summary || '',
            'Media URL': mediaUrls,
            'Ngày tạo': formatDateTime(review.created_at),
            'Ngày cập nhật': formatDateTime(review.updated_at)
        };
    });
}

const REVIEW_EXPORT_HEADERS = [
    'Mã review',
    'Mã sản phẩm',
    'Sản phẩm',
    'Slug sản phẩm',
    'Khách hàng',
    'Email',
    'Mã đơn hàng',
    'Số sao',
    'Nội dung',
    'Đã mua hàng',
    'AI sentiment',
    'AI topics',
    'AI summary',
    'Media URL',
    'Ngày tạo',
    'Ngày cập nhật'
];

exports.getReviews = async (req, res) => {
    try {
        const filters = getReviewFilters(req.query);
        const [{ reviews, total, page, limit }, reviewStats, reviewProducts] = await Promise.all([
            Review.findAllForAdmin(filters),
            Review.getStats(filters),
            Review.getProductsWithReviewCounts()
        ]);
        const totalPages = Math.max(1, Math.ceil(total / limit));
        reviews
            .filter((review) => !review.ai_insight)
            .slice(0, 10)
            .forEach((review) => scheduleReviewInsightAnalysis(review.id));

        res.render('admin/reviews', {
            currentPage: 'reviews',
            reviews,
            reviewStats,
            reviewProducts,
            filters,
            notice: typeof req.query.notice === 'string' ? req.query.notice : '',
            noticeType: typeof req.query.notice_type === 'string' ? req.query.notice_type : 'success',
            pagination: {
                totalItems: total,
                totalPages,
                currentPage: Math.min(page, totalPages),
                limit
            },
            user: req.user
        });
    } catch (error) {
        console.error('Admin reviews page error:', error);
        res.status(500).render('error', {
            message: 'Lỗi tải trang quản lý đánh giá',
            user: req.user
        });
    }
};

exports.exportReviews = async (req, res) => {
    try {
        const filters = getReviewFilters(req.query);
        delete filters.page;
        delete filters.limit;

        const reviews = await Review.findAllForExport(filters);
        const worksheet = XLSX.utils.json_to_sheet(buildReviewExportRows(reviews), {
            header: REVIEW_EXPORT_HEADERS
        });
        worksheet['!cols'] = [
            { wch: 10 },
            { wch: 12 },
            { wch: 34 },
            { wch: 28 },
            { wch: 22 },
            { wch: 28 },
            { wch: 16 },
            { wch: 8 },
            { wch: 48 },
            { wch: 12 },
            { wch: 42 },
            { wch: 20 },
            { wch: 20 }
        ];
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Reviews');

        const workbookBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${buildExportFilename(filters)}"`);
        res.send(workbookBuffer);
    } catch (error) {
        console.error('Export reviews error:', error);
        res.status(500).json({
            success: false,
            message: 'Không thể xuất đánh giá ra Excel.'
        });
    }
};
