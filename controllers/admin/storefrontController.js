// Controller admin xử lý nghiệp vụ quản trị storefrontcontroller và chuẩn bị dữ liệu cho view/API quản trị.
const legacy = require('./legacy');

// Xử lý cấu hình giao diện storefront trong admin.
module.exports = {
    getStorefrontSettings: legacy.getStorefrontSettings,
    updateStorefrontSettings: legacy.updateStorefrontSettings,
    saveStorefrontSettingsDraft: legacy.saveStorefrontSettingsDraft,
    publishStorefrontSettings: legacy.publishStorefrontSettings,
    discardStorefrontSettingsDraft: legacy.discardStorefrontSettingsDraft,
    resetStorefrontSettingsDraft: legacy.resetStorefrontSettingsDraft,
    uploadStorefrontAsset: legacy.uploadStorefrontAsset,
    requestBulkDeleteVerification: legacy.requestBulkDeleteVerification
};
