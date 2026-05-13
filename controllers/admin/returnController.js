// Controller admin xử lý nghiệp vụ quản trị returncontroller và chuẩn bị dữ liệu cho view/API quản trị.
const legacy = require('./legacy');

// Xử lý danh sách, chi tiết và duyệt yêu cầu hoàn hàng.
module.exports = {
    getReturnRequests: legacy.getReturnRequests,
    getReturnRequestDetail: legacy.getReturnRequestDetail,
    updateReturnRequestStatus: legacy.updateReturnRequestStatus
};
