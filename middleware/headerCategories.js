// Nạp danh mục hiển thị trên header để mọi trang storefront dùng chung dữ liệu điều hướng.
const Category = require('../models/Category');

// Xử lý header danh mục.
async function headerCategories(req, res, next) {
    try {
        const categories = await Category.findAll();
        res.locals.headerCategories = Category.buildTree(categories);
    } catch (error) {
        console.error('Header categories error:', error);
        res.locals.headerCategories = [];
    }

    next();
}

module.exports = headerCategories;
