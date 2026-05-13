// Controller admin xử lý nghiệp vụ quản trị ordercontroller và chuẩn bị dữ liệu cho view/API quản trị.
const legacy = require('./legacy');

// Xử lý danh sách, chi tiết và cập nhật trạng thái đơn hàng.
module.exports = {
    getOrders: legacy.getOrders,
    getOrderDetail: legacy.getOrderDetail,
    updateOrderStatus: legacy.updateOrderStatus
};
