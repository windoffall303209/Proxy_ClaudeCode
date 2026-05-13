// Controller admin xử lý nghiệp vụ quản trị marketingcontroller và chuẩn bị dữ liệu cho view/API quản trị.
const legacy = require('./legacy');

// Xử lý khuyến mãi, voucher và email marketing trong admin.
module.exports = {
    getSales: legacy.getSales,
    createSale: legacy.createSale,
    updateSale: legacy.updateSale,
    deleteSale: legacy.deleteSale,
    sendSaleAnnouncementEmail: legacy.sendSaleAnnouncementEmail,
    sendMarketingEmail: legacy.sendMarketingEmail,
    getVouchers: legacy.getVouchers,
    createVoucher: legacy.createVoucher,
    updateVoucher: legacy.updateVoucher,
    deleteVoucher: legacy.deleteVoucher,
    updateVoucherStatus: legacy.updateVoucherStatus,
    sendVoucherAnnouncementEmail: legacy.sendVoucherAnnouncementEmail
};
