// Controller admin xử lý nghiệp vụ quản trị dashboardcontroller và chuẩn bị dữ liệu cho view/API quản trị.
const legacy = require('./legacy');

// Xử lý trang tổng quan quản trị và số liệu dashboard.
module.exports = {
    getDashboard: legacy.getDashboard
};
