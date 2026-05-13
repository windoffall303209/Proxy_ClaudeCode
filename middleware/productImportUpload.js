// Middleware xử lý productimportupload trước khi request đi vào controller.
const fs = require('fs');
const multer = require('multer');
const os = require('os');
const path = require('path');

const tempDir = path.join(os.tmpdir(), 'tmdt_product_import_uploads');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination(req, file, cb) {
        cb(null, tempDir);
    },
    filename(req, file, cb) {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});

const allowedExtensions = new Set(['.xlsx', '.xls', '.zip']);
const importFileSizeLimit = parseInt(process.env.MAX_IMPORT_FILE_SIZE, 10) || 200 * 1024 * 1024;

// Xử lý tệp filter.
function fileFilter(req, file, cb) {
    const extension = path.extname(file.originalname || '').toLowerCase();
    if (allowedExtensions.has(extension)) {
        cb(null, true);
        return;
    }

    cb(new Error('Only .xlsx, .xls, and .zip files are allowed for product import'));
}

const productImportUpload = multer({
    storage,
    limits: {
        fileSize: importFileSizeLimit
    },
    fileFilter
});

productImportUpload.fileSizeLimit = importFileSizeLimit;

module.exports = productImportUpload;
