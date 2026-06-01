const MarketingCampaignDraft = require('../models/MarketingCampaignDraft');
const Sale = require('../models/Sale');
const Voucher = require('../models/Voucher');
const { generateJson } = require('./aiJsonService');

function formatDiscount(type, value) {
    if (type === 'percentage') {
        return `${Number(value || 0)}%`;
    }
    return `${Number(value || 0).toLocaleString('vi-VN')}đ`;
}

function sanitizeHtmlSnippet(value) {
    return String(value || '')
        .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
        .trim();
}

function buildFallbackDraft(sourceType, source) {
    const isVoucher = sourceType === 'voucher';
    const name = source.name || source.code || 'Ưu đãi mới';
    const discount = formatDiscount(source.type, source.value);
    const codeLine = isVoucher && source.code ? `<p>Mã ưu đãi: <strong>${source.code}</strong></p>` : '';
    const subject = isVoucher
        ? `${source.code || name}: ưu đãi ${discount} tại WIND OF FALL`
        : `${name}: giảm ${discount} cho bộ sưu tập bạn thích`;

    return {
        segment: 'newsletter',
        subject,
        previewText: isVoucher
            ? `Dùng mã ${source.code || name} trước khi hết hạn.`
            : `Chọn nhanh các sản phẩm đang có ưu đãi ${discount}.`,
        emailHtml: `
            <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto;">
                <h2>${name}</h2>
                <p>${source.description || 'WIND OF FALL đang có ưu đãi mới dành cho bạn.'}</p>
                <p>Ưu đãi: <strong>${discount}</strong></p>
                ${codeLine}
                <p>Truy cập website để chọn sản phẩm còn hàng và áp dụng ưu đãi trước khi chương trình kết thúc.</p>
                <a href="${process.env.BASE_URL || 'http://localhost:3000'}" style="display:inline-block;padding:10px 18px;background:#111;color:#fff;text-decoration:none;border-radius:6px;">Mua sắm ngay</a>
            </div>
        `.trim(),
        smsText: isVoucher
            ? `WIND OF FALL: dùng mã ${source.code || name} để nhận ưu đãi ${discount}.`
            : `WIND OF FALL có ưu đãi ${discount}: ${name}.`,
        bannerCopy: isVoucher
            ? `${source.code || name} - giảm ${discount}`
            : `${name} - giảm ${discount}`
    };
}

function validateDraft(value, fallback) {
    return {
        segment: String(value?.segment || fallback.segment || 'newsletter').trim().slice(0, 100),
        subject: String(value?.subject || fallback.subject || '').trim().slice(0, 255),
        previewText: String(value?.previewText || value?.preview_text || fallback.previewText || '').trim().slice(0, 255),
        emailHtml: sanitizeHtmlSnippet(value?.emailHtml || value?.email_html || fallback.emailHtml),
        smsText: String(value?.smsText || value?.sms_text || fallback.smsText || '').trim().slice(0, 500),
        bannerCopy: String(value?.bannerCopy || value?.banner_copy || fallback.bannerCopy || '').trim().slice(0, 255)
    };
}

async function getAssignedProductNames(sourceType, sourceId) {
    if (!sourceId) {
        return [];
    }

    try {
        const assignmentMap = sourceType === 'sale'
            ? await Sale.getAssignedProductsMap([sourceId])
            : await Voucher.getApplicableProductsMap([sourceId]);
        const products = assignmentMap.get(Number(sourceId)) || [];
        return products.map((product) => product.name).filter(Boolean).slice(0, 12);
    } catch (error) {
        return [];
    }
}

async function generateDraft({ sourceType, sourceId, createdBy }) {
    const normalizedType = sourceType === 'voucher' ? 'voucher' : 'sale';
    const source = normalizedType === 'voucher'
        ? await Voucher.findById(sourceId)
        : await Sale.findById(sourceId);

    if (!source) {
        throw new Error(normalizedType === 'voucher' ? 'Voucher không tồn tại' : 'Khuyến mãi không tồn tại');
    }

    const productNames = await getAssignedProductNames(normalizedType, source.id);
    const fallback = buildFallbackDraft(normalizedType, source);
    const result = await generateJson({
        systemPrompt: [
            'Bạn viết nội dung marketing cho shop thời trang WIND OF FALL.',
            'Chỉ trả JSON: segment, subject, previewText, emailHtml, smsText, bannerCopy.',
            'Giọng văn ngắn gọn, tự nhiên, không phóng đại, không hứa điều không có trong dữ liệu.',
            'emailHtml phải là đoạn HTML email an toàn, không script.'
        ].join('\n'),
        userPrompt: JSON.stringify({
            sourceType: normalizedType,
            name: source.name,
            code: source.code || '',
            description: source.description || '',
            discountType: source.type,
            discountValue: source.value,
            minOrderAmount: source.min_order_amount || 0,
            startDate: source.start_date,
            endDate: source.end_date,
            assignedProducts: productNames
        }),
        fallback,
        validate: validateDraft
    });

    return MarketingCampaignDraft.create({
        sourceType: normalizedType,
        sourceId: source.id,
        ...result.data,
        model: result.model,
        createdBy
    });
}

async function attachLatestDrafts(sourceType, items = []) {
    const ids = items.map((item) => item.id).filter(Boolean);
    const map = await MarketingCampaignDraft.mapLatestBySource(sourceType, ids).catch(() => new Map());
    items.forEach((item) => {
        item.ai_marketing_draft = map.get(Number(item.id)) || null;
    });
    return items;
}

module.exports = {
    generateDraft,
    attachLatestDrafts
};
