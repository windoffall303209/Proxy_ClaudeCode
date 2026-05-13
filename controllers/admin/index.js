// Controller admin xử lý nghiệp vụ quản trị index và chuẩn bị dữ liệu cho view/API quản trị.
module.exports = {
    ...require('./dashboardController'),
    ...require('./categoryController'),
    ...require('./productController'),
    ...require('./orderController'),
    ...require('./returnController'),
    ...require('./userController'),
    ...require('./bannerController'),
    ...require('./marketingController'),
    ...require('./storefrontController')
};
