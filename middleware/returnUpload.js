// Middleware xử lý returnupload trước khi request đi vào controller.
const fs = require('fs');
const multer = require('multer');
const os = require('os');
const path = require('path');
const { uploadToCloudinary, deleteFromCloudinary } = require('../config/cloudinary');

const MAX_RETURN_IMAGES = 6;
const MAX_RETURN_VIDEOS = 1;
const MAX_RETURN_FILES = 7;
const MAX_RETURN_FILE_SIZE = Number.parseInt(process.env.MAX_RETURN_FILE_SIZE, 10) || 50 * 1024 * 1024;
const RETURN_UPLOAD_DIR = path.join(os.tmpdir(), 'tmdt_return_uploads');
const RETURN_IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']);
const RETURN_VIDEO_TYPES = new Set(['video/mp4', 'video/webm', 'video/quicktime']);

if (!fs.existsSync(RETURN_UPLOAD_DIR)) {
    fs.mkdirSync(RETURN_UPLOAD_DIR, { recursive: true });
}

class ReturnUploadError extends Error {
    constructor(code, message) {
        super(message);
        this.name = 'ReturnUploadError';
        this.code = code;
    }
}

// Tạo dữ liệu hoàn hàng điều hướng.
function buildReturnRedirect(orderCode, code) {
    return `/orders/${encodeURIComponent(orderCode)}/return-request?return=${encodeURIComponent(code)}`;
}

// Dọn dẹp temp tệp.
function cleanupTempFile(filePath) {
    try {
        if (filePath && fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    } catch (error) {
        console.warn('Return temp cleanup failed:', error.message);
    }
}

// Dọn dẹp temp tệp.
function cleanupTempFiles(files = []) {
    files.forEach((file) => cleanupTempFile(file?.path));
}

// Xử lý detect hoàn hàng media type.
function detectReturnMediaType(file) {
    if (!file) {
        return null;
    }

    if (RETURN_IMAGE_TYPES.has(file.mimetype)) {
        return 'image';
    }

    if (RETURN_VIDEO_TYPES.has(file.mimetype)) {
        return 'video';
    }

    return null;
}

// Xử lý map l?i upload vào feedback code.
function mapUploadErrorToFeedbackCode(error) {
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
        return 'file-too-large';
    }

    if (error?.code === 'TOO_MANY_RETURN_IMAGES' || error?.code === 'TOO_MANY_RETURN_VIDEOS') {
        return 'invalid-media';
    }

    return 'upload-failed';
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, RETURN_UPLOAD_DIR),
    filename: (req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        cb(null, `return-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});

const returnUpload = multer({
    storage,
    limits: {
        fileSize: MAX_RETURN_FILE_SIZE,
        files: MAX_RETURN_FILES
    },
    fileFilter: (req, file, cb) => {
        const mediaType = detectReturnMediaType(file);
        if (!mediaType) {
            cb(new ReturnUploadError('INVALID_RETURN_MEDIA_TYPE', 'Unsupported return media type.'));
            return;
        }

        const counts = req.returnUploadCounts || { image: 0, video: 0 };
        counts[mediaType] += 1;
        req.returnUploadCounts = counts;

        if (counts.image > MAX_RETURN_IMAGES) {
            cb(new ReturnUploadError('TOO_MANY_RETURN_IMAGES', 'Return request supports up to 6 images.'));
            return;
        }

        if (counts.video > MAX_RETURN_VIDEOS) {
            cb(new ReturnUploadError('TOO_MANY_RETURN_VIDEOS', 'Return request supports up to 1 video.'));
            return;
        }

        cb(null, true);
    }
});

// Dọn dẹp uploaded hoàn hàng media.
async function cleanupUploadedReturnMedia(mediaItems = []) {
    for (const media of mediaItems) {
        const publicId = media?.publicId || media?.public_id;
        if (!publicId) {
            continue;
        }

        const resourceType = media?.mediaType || media?.media_type || 'image';
        await deleteFromCloudinary(publicId, { resource_type: resourceType }).catch((error) => {
            console.error('Return Cloudinary cleanup failed:', error);
        });
    }
}

// Tải lên single hoàn hàng media tệp.
async function uploadSingleReturnMediaFile(file, index) {
    const mediaType = detectReturnMediaType(file);
    const result = await uploadToCloudinary(file.path, {
        folder: 'tmdt_ecommerce/returns',
        resource_type: mediaType
    });

    if (!result.success) {
        throw new Error(result.error || 'Cloudinary return upload failed.');
    }

    return {
        mediaType,
        mediaUrl: result.url,
        publicId: result.public_id,
        displayOrder: index
    };
}

// Tải lên hoàn hàng media tệp.
async function uploadReturnMediaFiles(files = []) {
    try {
        const uploadResults = await Promise.allSettled(
            files.map((file, index) => uploadSingleReturnMediaFile(file, index))
        );
        const uploadedMedia = uploadResults
            .filter((result) => result.status === 'fulfilled')
            .map((result) => result.value)
            .sort((a, b) => a.displayOrder - b.displayOrder);
        const failedUpload = uploadResults.find((result) => result.status === 'rejected');

        if (failedUpload) {
            await cleanupUploadedReturnMedia(uploadedMedia);
            throw failedUpload.reason;
        }

        return uploadedMedia;
    } finally {
        cleanupTempFiles(files);
    }
}

// Xử lý hoàn hàng media t?i l?n.
function handleReturnMediaUpload(req, res, next) {
    returnUpload.array('returnMedia', MAX_RETURN_FILES)(req, res, async (error) => {
        if (error) {
            cleanupTempFiles(req.files || []);
            return res.redirect(buildReturnRedirect(req.params.orderCode, mapUploadErrorToFeedbackCode(error)));
        }

        try {
            req.uploadedReturnMedia = Array.isArray(req.files) && req.files.length > 0
                ? await uploadReturnMediaFiles(req.files)
                : [];
            return next();
        } catch (uploadError) {
            console.error('Return media l?i upload:', uploadError);
            return res.redirect(buildReturnRedirect(req.params.orderCode, 'upload-failed'));
        }
    });
}

module.exports = {
    handleReturnMediaUpload,
    cleanupUploadedReturnMedia,
    MAX_RETURN_IMAGES,
    MAX_RETURN_VIDEOS
};
