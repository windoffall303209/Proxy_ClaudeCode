// Cấu hình Cloudinary và helper upload/xóa ảnh dùng trong các luồng quản trị.
const cloudinary = require('cloudinary').v2;

// Cấu hình Cloudinary bằng biến môi trường để dùng chung cho upload và xóa ảnh.
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
});

/**
 * Tải file lên Cloudinary và chuẩn hóa dữ liệu trả về cho controller.
 * @param {string} filePath - Đường dẫn file tạm trên server
 * @param {object} options - Tùy chọn tải lên của Cloudinary
 * @returns {Promise<object>} Kết quả tải lên đã rút gọn
 */
const uploadToCloudinary = async (filePath, options = {}) => {
    try {
        const resourceType = options.resource_type || 'image';
        const defaultOptions = {
            folder: 'tmdt_ecommerce',
            resource_type: resourceType,
            transformation: [
                { quality: 'auto:good' },
                { fetch_format: 'auto' }
            ]
        };

        if (resourceType !== 'image') {
            delete defaultOptions.transformation;
        }

        const result = await cloudinary.uploader.upload(filePath, {
            ...defaultOptions,
            ...options
        });

        return {
            success: true,
            url: result.secure_url,
            public_id: result.public_id,
            width: result.width,
            height: result.height,
            format: result.format,
            bytes: result.bytes
        };
    } catch (error) {
        console.error('Cloudinary l?i upload:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Xóa asset khỏi Cloudinary theo public ID.
 * @param {string} publicId - Public ID của asset trên Cloudinary
 * @param {object} [options] - Tùy chọn xóa của Cloudinary
 * @returns {Promise<object>} Kết quả xóa đã chuẩn hóa
 */
const deleteFromCloudinary = async (publicId, options = {}) => {
    try {
        const result = await cloudinary.uploader.destroy(publicId, options);
        return {
            success: result.result === 'ok',
            result: result
        };
    } catch (error) {
        console.error('Cloudinary delete error:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Tạo URL ảnh tối ưu với transformation mặc định.
 * @param {string} publicId - Public ID của ảnh trên Cloudinary
 * @param {object} options - Tùy chọn transformation bổ sung
 * @returns {string} URL ảnh đã áp dụng transformation
 */
const getOptimizedUrl = (publicId, options = {}) => {
    const defaultTransformations = {
        quality: 'auto',
        fetch_format: 'auto'
    };

    return cloudinary.url(publicId, {
        ...defaultTransformations,
        ...options
    });
};

module.exports = {
    cloudinary,
    uploadToCloudinary,
    deleteFromCloudinary,
    getOptimizedUrl
};
