// Controller admin xử lý nghiệp vụ quản trị marketingcontroller và chuẩn bị dữ liệu cho view/API quản trị.
const legacy = require('./legacy');
const { generateDraft } = require('../../services/marketingAiDraftService');

function buildNoticeRedirect(path, message, type = 'success') {
    const separator = path.includes('?') ? '&' : '?';
    const params = new URLSearchParams();
    params.set('notice', message);
    params.set('notice_type', type);
    return `${path}${separator}${params.toString()}`;
}

async function generateMarketingDraft(req, res, sourceType) {
    try {
        await generateDraft({
            sourceType,
            sourceId: req.params.id,
            createdBy: req.user?.id || null
        });

        const target = sourceType === 'voucher' ? '/admin/vouchers' : '/admin/sales';
        return res.redirect(buildNoticeRedirect(target, 'Đã tạo bản nháp marketing AI.'));
    } catch (error) {
        const target = sourceType === 'voucher' ? '/admin/vouchers' : '/admin/sales';
        return res.redirect(buildNoticeRedirect(target, error.message || 'Không thể tạo bản nháp marketing AI.', 'error'));
    }
}

// Xử lý khuyến mãi, voucher và email marketing trong admin.
module.exports = {
    getSales: legacy.getSales,
    createSale: legacy.createSale,
    updateSale: legacy.updateSale,
    deleteSale: legacy.deleteSale,
    sendSaleAnnouncementEmail: legacy.sendSaleAnnouncementEmail,
    generateSaleMarketingDraft: (req, res) => generateMarketingDraft(req, res, 'sale'),
    sendMarketingEmail: legacy.sendMarketingEmail,
    getVouchers: legacy.getVouchers,
    createVoucher: legacy.createVoucher,
    updateVoucher: legacy.updateVoucher,
    deleteVoucher: legacy.deleteVoucher,
    updateVoucherStatus: legacy.updateVoucherStatus,
    sendVoucherAnnouncementEmail: legacy.sendVoucherAnnouncementEmail,
    generateVoucherMarketingDraft: (req, res) => generateMarketingDraft(req, res, 'voucher')
};
