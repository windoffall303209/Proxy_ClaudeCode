// Controller admin xử lý nghiệp vụ quản trị bannercontroller và chuẩn bị dữ liệu cho view/API quản trị.
const legacy = require('./legacy');

// Xử lý banner quảng cáo và sắp xếp thứ tự hiển thị.
module.exports = {
    getBanners: legacy.getBanners,
    createBanner: legacy.createBanner,
    deleteBanner: legacy.deleteBanner,
    toggleBannerActive: legacy.toggleBannerActive,
    reorderBanners: legacy.reorderBanners,
    updateBanner: legacy.updateBanner
};
