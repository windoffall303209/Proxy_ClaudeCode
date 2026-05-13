// Cấu hình upload ảnh chung và đẩy file lên Cloudinary sau khi multer nhận file.
const multer = require('multer');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { uploadToCloudinary, deleteFromCloudinary } = require('../config/cloudinary');

// Dùng thư mục tạm của hệ điều hành trước khi đẩy file lên Cloudinary.
const tempDir = path.join(os.tmpdir(), 'tmdt_uploads');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}

// Multer lưu file vào thư mục tạm, bước sau mới upload lên Cloudinary.
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, tempDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// Kiểm tra file upload có đúng định dạng ảnh được hỗ trợ hay không.
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

// Instance multer dùng chung cho các route nhận ảnh.
const upload = multer({
    storage: storage,
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024 // 5MB default
    },
    fileFilter: fileFilter
});

// Tải lên single tệp.
async function uploadSingleFile(file, folder) {
    const localPath = file.path;

    try {
        const result = await uploadToCloudinary(localPath, { folder });

        if (result.success) {
            file.cloudinaryUrl = result.url;
            file.cloudinaryPublicId = result.public_id;
        } else {
            console.error('âŒ Cloudinary upload failed:', result.error);
        }
    } finally {
        cleanupTempFile(localPath);
    }
}

/**
 * Middleware đẩy file đã được multer lưu tạm lên Cloudinary rồi xóa file local.
 */
const uploadToCloud = async (req, res, next) => {
    try {
        if (req.file) {
            await uploadSingleFile(req.file, 'tmdt_ecommerce/products');
            next();
            return;
        }

        if (req.files && Array.isArray(req.files)) {
            await Promise.all(
                req.files.map((file) => uploadSingleFile(file, 'tmdt_ecommerce/products'))
            );
            next();
            return;
        }

        if (req.files && !Array.isArray(req.files)) {
            const uploads = Object.entries(req.files).flatMap(([fieldName, files]) =>
                files.map((file) => uploadSingleFile(file, `tmdt_ecommerce/${fieldName}`))
            );

            await Promise.all(uploads);
            next();
            return;
        }

        // Nhánh fallback cho request chỉ có một file.
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

            // Xóa file tạm sau khi Cloudinary đã nhận dữ liệu.
            cleanupTempFile(localPath);
        }

        // Nhánh fallback cho nhiều file cùng một field.
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

                // Xóa file tạm sau khi Cloudinary đã nhận dữ liệu.
                cleanupTempFile(localPath);
            }
        }

        // Nhánh fallback cho nhiều field upload khác nhau.
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

                    // Xóa file tạm sau khi Cloudinary đã nhận dữ liệu.
                    cleanupTempFile(localPath);
                }
            }
        }

        next();
    } catch (error) {
        console.error('❌ Cloud lỗi upload:', error);
        next(error);
    }
};

/**
 * Lấy URL Cloudinary đã gắn vào đối tượng file sau khi upload.
 */
const getFileUrl = (file) => {
    if (file.cloudinaryUrl) {
        return file.cloudinaryUrl;
    }
    console.warn('⚠️ No Cloudinary URL found for file, upload may have failed');
    return null;
};

/**
 * Xóa file trên Cloudinary nếu request có public ID.
 */
const deleteFile = async (localPath, cloudinaryPublicId) => {
    // localPath được giữ trong chữ ký hàm để tương thích với code gọi hiện có.
    if (cloudinaryPublicId) {
        await deleteFromCloudinary(cloudinaryPublicId);
    }
};

/**
 * Xóa file tạm trên máy chủ sau khi xử lý upload.
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
