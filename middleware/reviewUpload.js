// Middleware xử lý reviewupload trước khi request đi vào controller.
const fs = require('fs');
const multer = require('multer');
const os = require('os');
const path = require('path');
const { uploadToCloudinary, deleteFromCloudinary } = require('../config/cloudinary');

const MAX_REVIEW_IMAGES = 5;
const MAX_REVIEW_VIDEOS = 1;
const MAX_REVIEW_FILES = 6;
const MAX_REVIEW_FILE_SIZE = Number.parseInt(process.env.MAX_REVIEW_FILE_SIZE, 10) || 30 * 1024 * 1024;
const REVIEW_UPLOAD_DIR = path.join(os.tmpdir(), 'tmdt_review_uploads');
const REVIEW_IMAGE_TYPES = new Set([
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp'
]);
const REVIEW_VIDEO_TYPES = new Set([
    'video/mp4',
    'video/webm',
    'video/quicktime'
]);

if (!fs.existsSync(REVIEW_UPLOAD_DIR)) {
    fs.mkdirSync(REVIEW_UPLOAD_DIR, { recursive: true });
}

class ReviewUploadError extends Error {
    constructor(code, message) {
        super(message);
        this.name = 'ReviewUploadError';
        this.code = code;
    }
}

// Tạo dữ liệu đánh giá điều hướng.
function buildReviewRedirect(slug, code) {
    return `/products/${encodeURIComponent(slug)}?review=${encodeURIComponent(code)}`;
}

// Dọn dẹp temp tệp.
function cleanupTempFile(filePath) {
    try {
        if (filePath && fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    } catch (error) {
        console.warn('Review temp cleanup failed:', error.message);
    }
}

// Dọn dẹp temp tệp.
function cleanupTempFiles(files = []) {
    files.forEach((file) => cleanupTempFile(file?.path));
}

// Xử lý detect đánh giá media type.
function detectReviewMediaType(file) {
    if (!file) {
        return null;
    }

    if (REVIEW_IMAGE_TYPES.has(file.mimetype)) {
        return 'image';
    }

    if (REVIEW_VIDEO_TYPES.has(file.mimetype)) {
        return 'video';
    }

    return null;
}

// Xử lý map l?i upload vào feedback code.
function mapUploadErrorToFeedbackCode(error) {
    if (!error) {
        return 'invalid-media';
    }

    if (error instanceof multer.MulterError) {
        return error.code === 'LIMIT_FILE_SIZE' ? 'file-too-large' : 'invalid-media';
    }

    if (error.code === 'TOO_MANY_REVIEW_IMAGES' || error.code === 'TOO_MANY_REVIEW_VIDEOS') {
        return 'invalid-media';
    }

    if (error.code === 'INVALID_REVIEW_MEDIA_TYPE') {
        return 'invalid-media';
    }

    return 'upload-failed';
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, REVIEW_UPLOAD_DIR),
    filename: (req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        cb(null, `review-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});

const reviewUpload = multer({
    storage,
    limits: {
        fileSize: MAX_REVIEW_FILE_SIZE,
        files: MAX_REVIEW_FILES
    },
    fileFilter: (req, file, cb) => {
        const mediaType = detectReviewMediaType(file);

        if (!mediaType) {
            cb(new ReviewUploadError('INVALID_REVIEW_MEDIA_TYPE', 'Unsupported review media type.'));
            return;
        }

        const counts = req.reviewUploadCounts || { image: 0, video: 0 };
        counts[mediaType] += 1;
        req.reviewUploadCounts = counts;

        if (counts.image > MAX_REVIEW_IMAGES) {
            cb(new ReviewUploadError('TOO_MANY_REVIEW_IMAGES', 'Review supports up to 5 images.'));
            return;
        }

        if (counts.video > MAX_REVIEW_VIDEOS) {
            cb(new ReviewUploadError('TOO_MANY_REVIEW_VIDEOS', 'Review supports up to 1 video.'));
            return;
        }

        cb(null, true);
    }
});

// Dọn dẹp uploaded cloudinary media.
async function cleanupUploadedCloudinaryMedia(mediaItems = []) {
    for (const media of mediaItems) {
        const publicId = media?.publicId || media?.public_id;
        if (!publicId) {
            continue;
        }

        const resourceType = media?.mediaType || media?.media_type || 'image';
        await deleteFromCloudinary(publicId, { resource_type: resourceType }).catch((error) => {
            console.error('Review Cloudinary cleanup failed:', error);
        });
    }
}

// Tải lên đánh giá media tệp.
async function uploadReviewMediaFiles(files = []) {
    const uploadedMedia = [];

    try {
        for (const [index, file] of files.entries()) {
            const mediaType = detectReviewMediaType(file);
            const result = await uploadToCloudinary(file.path, {
                folder: 'tmdt_ecommerce/reviews',
                resource_type: mediaType
            });

            if (!result.success) {
                throw new Error(result.error || 'Cloudinary review upload failed.');
            }

            uploadedMedia.push({
                mediaType,
                mediaUrl: result.url,
                publicId: result.public_id,
                displayOrder: index
            });
        }

        return uploadedMedia;
    } catch (error) {
        await cleanupUploadedCloudinaryMedia(uploadedMedia);
        throw error;
    } finally {
        cleanupTempFiles(files);
    }
}

// Xử lý đánh giá media t?i l?n.
function handleReviewMediaUpload(req, res, next) {
    reviewUpload.array('reviewMedia', MAX_REVIEW_FILES)(req, res, async (error) => {
        if (error) {
            cleanupTempFiles(req.files || []);
            return res.redirect(buildReviewRedirect(req.params.slug, mapUploadErrorToFeedbackCode(error)));
        }

        try {
            req.uploadedReviewMedia = Array.isArray(req.files) && req.files.length > 0
                ? await uploadReviewMediaFiles(req.files)
                : [];
            return next();
        } catch (uploadError) {
            console.error('Review media l?i upload:', uploadError);
            return res.redirect(buildReviewRedirect(req.params.slug, 'upload-failed'));
        }
    });
}

module.exports = {
    handleReviewMediaUpload,
    cleanupUploadedCloudinaryMedia,
    MAX_REVIEW_IMAGES,
    MAX_REVIEW_VIDEOS
};
