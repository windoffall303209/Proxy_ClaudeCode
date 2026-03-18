const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
});

/**
 * Upload file to Cloudinary
 * @param {string} filePath - Local file path
 * @param {object} options - Upload options
 * @returns {Promise<object>} - Cloudinary upload result
 */
const uploadToCloudinary = async (filePath, options = {}) => {
    try {
        const defaultOptions = {
            folder: 'tmdt_ecommerce',
            resource_type: 'image',
            transformation: [
                { quality: 'auto:good' },
                { fetch_format: 'auto' }
            ]
        };

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
        console.error('Cloudinary upload error:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Delete file from Cloudinary
 * @param {string} publicId - Cloudinary public ID
 * @returns {Promise<object>} - Delete result
 */
const deleteFromCloudinary = async (publicId) => {
    try {
        const result = await cloudinary.uploader.destroy(publicId);
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
 * Get optimized URL with transformations
 * @param {string} publicId - Cloudinary public ID
 * @param {object} options - Transformation options
 * @returns {string} - Optimized URL
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
