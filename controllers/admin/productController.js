// Controller admin xử lý nghiệp vụ quản trị productcontroller và chuẩn bị dữ liệu cho view/API quản trị.
const legacy = require('./legacy');

// Xử lý sản phẩm, ảnh sản phẩm và biến thể trong trang quản trị.
module.exports = {
    getProducts: legacy.getProducts,
    downloadProductImportTemplate: legacy.downloadProductImportTemplate,
    exportProducts: legacy.exportProducts,
    importProducts: legacy.importProducts,
    getProductImportJob: legacy.getProductImportJob,
    createProduct: legacy.createProduct,
    updateProduct: legacy.updateProduct,
    deleteProduct: legacy.deleteProduct,
    deleteAllProducts: legacy.deleteAllProducts,
    getProductImages: legacy.getProductImages,
    addProductImageUrl: legacy.addProductImageUrl,
    uploadProductImage: legacy.uploadProductImage,
    deleteProductImage: legacy.deleteProductImage,
    setPrimaryImage: legacy.setPrimaryImage,
    getProductVariants: legacy.getProductVariants,
    addProductVariant: legacy.addProductVariant,
    deleteProductVariant: legacy.deleteProductVariant
};
