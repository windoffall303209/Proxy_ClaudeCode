const fs = require('fs');
const multer = require('multer');
const os = require('os');
const path = require('path');
const { uploadToCloudinary, deleteFromCloudinary } = require('../config/cloudinary');

const MAX_CHAT_FILES = Number.parseInt(process.env.MAX_CHAT_FILES, 10) || 4;
const MAX_CHAT_FILE_SIZE = Number.parseInt(process.env.MAX_CHAT_FILE_SIZE, 10)
    || Number.parseInt(process.env.MAX_REVIEW_FILE_SIZE, 10)
    || 30 * 1024 * 1024;
const CHAT_UPLOAD_DIR = path.join(os.tmpdir(), 'tmdt_chat_uploads');
const CHAT_IMAGE_TYPES = new Set([
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp'
]);
const CHAT_VIDEO_TYPES = new Set([
    'video/mp4',
    'video/webm',
    'video/quicktime'
]);

if (!fs.existsSync(CHAT_UPLOAD_DIR)) {
    fs.mkdirSync(CHAT_UPLOAD_DIR, { recursive: true });
}

class ChatUploadError extends Error {
    constructor(code, message) {
        super(message);
        this.name = 'ChatUploadError';
        this.code = code;
    }
}

function cleanupTempFile(filePath) {
    try {
        if (filePath && fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    } catch (error) {
        console.warn('Chat temp cleanup failed:', error.message);
    }
}

function cleanupTempFiles(files = []) {
    files.forEach((file) => cleanupTempFile(file?.path));
}

function detectChatMediaType(file) {
    if (!file) {
        return null;
    }

    if (CHAT_IMAGE_TYPES.has(file.mimetype)) {
        return 'image';
    }

    if (CHAT_VIDEO_TYPES.has(file.mimetype)) {
        return 'video';
    }

    return null;
}

function mapUploadErrorMessage(error) {
    if (!error) {
        return 'Không thể tải media lên lúc này.';
    }

    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return 'File quá lớn. Vui lòng chọn file nhỏ hơn.';
        }

        if (error.code === 'LIMIT_FILE_COUNT') {
            return `Chỉ được gửi tối đa ${MAX_CHAT_FILES} file trong một tin nhắn.`;
        }
    }

    if (error.code === 'INVALID_CHAT_MEDIA_TYPE') {
        return 'Chat chỉ hỗ trợ ảnh GIF/JPG/PNG/WEBP hoặc video MP4/WEBM/MOV.';
    }

    return 'Không thể tải media lên lúc này.';
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, CHAT_UPLOAD_DIR),
    filename: (req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        cb(null, `chat-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});

const chatUpload = multer({
    storage,
    limits: {
        fileSize: MAX_CHAT_FILE_SIZE,
        files: MAX_CHAT_FILES
    },
    fileFilter: (req, file, cb) => {
        const mediaType = detectChatMediaType(file);
        if (!mediaType) {
            cb(new ChatUploadError('INVALID_CHAT_MEDIA_TYPE', 'Unsupported chat media type.'));
            return;
        }

        cb(null, true);
    }
});

async function cleanupUploadedChatMedia(mediaItems = []) {
    for (const media of mediaItems) {
        const publicId = media?.publicId || media?.public_id;
        if (!publicId) {
            continue;
        }

        const resourceType = media?.mediaType || media?.media_type || 'image';
        await deleteFromCloudinary(publicId, { resource_type: resourceType }).catch((error) => {
            console.error('Chat Cloudinary cleanup failed:', error);
        });
    }
}

async function uploadChatMediaFiles(files = []) {
    const uploadedMedia = [];

    try {
        for (const [index, file] of files.entries()) {
            const mediaType = detectChatMediaType(file);
            const result = await uploadToCloudinary(file.path, {
                folder: 'tmdt_ecommerce/chat',
                resource_type: mediaType
            });

            if (!result.success) {
                throw new Error(result.error || 'Cloudinary chat upload failed.');
            }

            uploadedMedia.push({
                mediaType,
                mediaUrl: result.url,
                publicId: result.public_id,
                mimeType: file.mimetype,
                originalName: file.originalname,
                bytes: Number(file.size) || 0,
                width: Number(result.width) || null,
                height: Number(result.height) || null,
                format: result.format || null,
                displayOrder: index
            });
        }

        return uploadedMedia;
    } catch (error) {
        await cleanupUploadedChatMedia(uploadedMedia);
        throw error;
    } finally {
        cleanupTempFiles(files);
    }
}

function handleChatMediaUpload(req, res, next) {
    chatUpload.array('messageMedia', MAX_CHAT_FILES)(req, res, async (error) => {
        if (error) {
            cleanupTempFiles(req.files || []);
            return res.status(400).json({
                success: false,
                message: mapUploadErrorMessage(error)
            });
        }

        try {
            req.uploadedChatMedia = Array.isArray(req.files) && req.files.length > 0
                ? await uploadChatMediaFiles(req.files)
                : [];
            return next();
        } catch (uploadError) {
            console.error('Chat media upload error:', uploadError);
            return res.status(500).json({
                success: false,
                message: 'Không thể tải media lên lúc này. Vui lòng thử lại.'
            });
        }
    });
}

module.exports = {
    handleChatMediaUpload,
    cleanupUploadedChatMedia,
    MAX_CHAT_FILES
};
