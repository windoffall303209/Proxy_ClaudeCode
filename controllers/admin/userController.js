// Controller admin xử lý nghiệp vụ quản trị usercontroller và chuẩn bị dữ liệu cho view/API quản trị.
const legacy = require('./legacy');

// Xử lý danh sách, chi tiết và khóa/mở khóa tài khoản người dùng.
module.exports = {
    getUsers: legacy.getUsers,
    getUserDetail: legacy.getUserDetail,
    updateUserStatus: legacy.updateUserStatus
};
