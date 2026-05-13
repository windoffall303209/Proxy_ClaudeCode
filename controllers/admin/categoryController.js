// Controller admin xử lý nghiệp vụ quản trị categorycontroller và chuẩn bị dữ liệu cho view/API quản trị.
const legacy = require('./legacy');

// Xử lý CRUD, import/export và xóa hàng loạt danh mục.
module.exports = {
    getCategories: legacy.getCategories,
    createCategory: legacy.createCategory,
    downloadCategoryImportTemplate: legacy.downloadCategoryImportTemplate,
    exportCategories: legacy.exportCategories,
    importCategories: legacy.importCategories,
    updateCategory: legacy.updateCategory,
    deleteCategory: legacy.deleteCategory,
    deleteAllCategories: legacy.deleteAllCategories
};
