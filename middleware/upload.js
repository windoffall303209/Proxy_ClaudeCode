const multer = require('multer');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { uploadToCloudinary, deleteFromCloudinary } = require('../config/cloudinary');

// Use OS temp directory for temporary local storage before uploading to Cloudinary
const tempDir = path.join(os.tmpdir(), 'tmdt_uploads');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}

// Storage configuration - save to temp directory before uploading to Cloudinary
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, tempDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// File filter - only images
const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb(new Error('Only image files are allowed!'));
    }
};

// Create multer upload instance
const upload = multer({
    storage: storage,
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024 // 5MB default
    },
    fileFilter: fileFilter
});

/**
 * Middleware to upload files to Cloudinary (cloud only)
 * After multer saves to temp, this uploads to Cloudinary then deletes the temp file
 */
const uploadToCloud = async (req, res, next) => {
    try {
        // Handle single file
        if (req.file) {
            const localPath = req.file.path;
            const result = await uploadToCloudinary(localPath, {
                folder: 'tmdt_ecommerce/products'
            });

            if (result.success) {
                req.file.cloudinaryUrl = result.url;
                req.file.cloudinaryPublicId = result.public_id;
            } else {
                console.error('❌ Cloudinary upload failed:', result.error);
            }

            // Delete temp file after upload
            cleanupTempFile(localPath);
        }

        // Handle multiple files (array)
        if (req.files && Array.isArray(req.files)) {
            for (const file of req.files) {
                const localPath = file.path;
                const result = await uploadToCloudinary(localPath, {
                    folder: 'tmdt_ecommerce/products'
                });

                if (result.success) {
                    file.cloudinaryUrl = result.url;
                    file.cloudinaryPublicId = result.public_id;
                } else {
                    console.error('❌ Cloudinary upload failed:', result.error);
                }

                // Delete temp file after upload
                cleanupTempFile(localPath);
            }
        }

        // Handle files object (multiple fields)
        if (req.files && !Array.isArray(req.files)) {
            for (const fieldName in req.files) {
                for (const file of req.files[fieldName]) {
                    const localPath = file.path;
                    const result = await uploadToCloudinary(localPath, {
                        folder: `tmdt_ecommerce/${fieldName}`
                    });

                    if (result.success) {
                        file.cloudinaryUrl = result.url;
                        file.cloudinaryPublicId = result.public_id;
                    } else {
                        console.error('❌ Cloudinary upload failed:', result.error);
                    }

                    // Delete temp file after upload
                    cleanupTempFile(localPath);
                }
            }
        }

        next();
    } catch (error) {
        console.error('❌ Cloud upload error:', error);
        next(error);
    }
};

/**
 * Get the Cloudinary URL for an uploaded file
 */
const getFileUrl = (file) => {
    if (file.cloudinaryUrl) {
        return file.cloudinaryUrl;
    }
    console.warn('⚠️ No Cloudinary URL found for file, upload may have failed');
    return null;
};

/**
 * Delete file from Cloudinary
 */
const deleteFile = async (localPath, cloudinaryPublicId) => {
    // Delete from Cloudinary
    if (cloudinaryPublicId) {
        await deleteFromCloudinary(cloudinaryPublicId);
    }
};

/**
 * Cleanup temporary local file
 */
const cleanupTempFile = (filePath) => {
    try {
        if (filePath && fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    } catch (error) {
        console.warn('⚠️ Could not delete temp file:', filePath, error.message);
    }
};

module.exports = upload;
module.exports.uploadToCloud = uploadToCloud;
module.exports.getFileUrl = getFileUrl;
module.exports.deleteFile = deleteFile;
