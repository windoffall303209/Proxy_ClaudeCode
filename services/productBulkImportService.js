// Service gom logic productbulkimportservice để controller không phải lặp xử lý nghiệp vụ.
const fs = require('fs');
const os = require('os');
const path = require('path');
const AdmZip = require('adm-zip');
const XLSX = require('xlsx');

const Product = require('../models/Product');
const Category = require('../models/Category');
const { uploadToCloudinary } = require('../config/cloudinary');
const { validateVariants } = require('./adminProductVariantService');

const BULK_IMPORT_FOLDER = 'tmdt_ecommerce/products/bulk-import';
const DEFAULT_IMAGE_URL = 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600';
const EXPORT_PRODUCT_LIMIT = 100000;

// Chuẩn hóa text.
function normalizeText(value) {
    return String(value ?? '').trim();
}

// Chuẩn hóa lookup key.
function normalizeLookupKey(value) {
    return normalizeText(value)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\u0111/g, 'd')
        .replace(/[^a-z0-9/._-]+/g, ' ')
        .trim();
}

// Chuẩn hóa import path.
function normalizeImportPath(value) {
    return normalizeText(value)
        .replace(/\\/g, '/')
        .replace(/^\.?\//, '')
        .replace(/^\/+/, '')
        .toLowerCase();
}

// Phân tích boolean.
function parseBoolean(value) {
    const normalized = normalizeLookupKey(value);
    return ['1', 'true', 'yes', 'y', 'co', 'x', 'on'].includes(normalized);
}

// Phân tích optional integer.
function parseOptionalInteger(value, fieldName) {
    const normalized = normalizeText(value);
    if (!normalized) {
        return null;
    }

    const parsed = Number.parseInt(normalized, 10);
    if (!Number.isInteger(parsed)) {
        throw new Error(`${fieldName} is invalid`);
    }

    return parsed;
}

// Phân tích optional decimal.
function parseOptionalDecimal(value, fieldName) {
    const normalized = normalizeText(value);
    if (!normalized) {
        return null;
    }

    const parsed = Number(normalized);
    if (!Number.isFinite(parsed)) {
        throw new Error(`${fieldName} is invalid`);
    }

    return parsed;
}

// Tạo slug chuẩn hóa từ chuỗi đầu vào.
function slugify(text) {
    return normalizeText(text)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\u0111/g, 'd')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}

// Dọn dẹp path.
function cleanupPath(targetPath) {
    if (!targetPath) {
        return;
    }

    try {
        fs.rmSync(targetPath, { recursive: true, force: true });
    } catch (error) {
        console.warn('Bulk import cleanup warning:', error.message);
    }
}

// Tìm sheet name.
function findSheetName(workbook, expectedName) {
    const normalizedExpectedName = normalizeLookupKey(expectedName);
    return workbook.SheetNames.find(
        (sheetName) => normalizeLookupKey(sheetName) === normalizedExpectedName
    ) || null;
}

// Xử lý read sheet rows.
function readSheetRows(workbook, sheetName) {
    const matchedSheetName = findSheetName(workbook, sheetName);
    if (!matchedSheetName) {
        return [];
    }

    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[matchedSheetName], {
        defval: '',
        raw: false
    });

    return rows.map((row, index) => ({
        ...Object.entries(row).reduce((normalizedRow, [key, value]) => {
            normalizedRow[normalizeLookupKey(key).replace(/\s+/g, '_')] = value;
            return normalizedRow;
        }, {}),
        __rowNumber: index + 2
    }));
}

// Kiểm tra meaningful row.
function isMeaningfulRow(row, keys) {
    return keys.some((key) => normalizeText(row[key]));
}

// Phân tích workbook.
function parseWorkbook(workbookPath) {
    if (!workbookPath || !fs.existsSync(workbookPath)) {
        throw new Error('Workbook file was not found');
    }

    const workbook = XLSX.readFile(workbookPath);
    const productRows = readSheetRows(workbook, 'Products')
        .filter((row) => isMeaningfulRow(row, ['product_key', 'name', 'category_id', 'category_name', 'price']));
    const imageRows = readSheetRows(workbook, 'Images')
        .filter((row) => isMeaningfulRow(row, ['product_key', 'image_file', 'image_url']));
    const variantRows = readSheetRows(workbook, 'Variants')
        .filter((row) => isMeaningfulRow(row, ['product_key', 'size', 'color', 'sku', 'image_file', 'image_url']));

    if (productRows.length === 0) {
        throw new Error('Workbook must include at least one row in the Products sheet');
    }

    return {
        products: productRows.map((row) => ({
            rowNumber: row.__rowNumber,
            productKey: normalizeText(row.product_key),
            name: normalizeText(row.name),
            slug: normalizeText(row.slug),
            categorySlug: normalizeText(row.category_slug),
            categoryId: normalizeText(row.category_id),
            categoryName: normalizeText(row.category_name),
            description: normalizeText(row.description),
            price: normalizeText(row.price),
            stockQuantity: normalizeText(row.stock_quantity),
            sku: normalizeText(row.sku),
            saleId: normalizeText(row.sale_id),
            isFeatured: normalizeText(row.is_featured)
        })),
        images: imageRows.map((row) => ({
            rowNumber: row.__rowNumber,
            productKey: normalizeText(row.product_key),
            imageFile: normalizeText(row.image_file),
            imageUrl: normalizeText(row.image_url),
            isPrimary: normalizeText(row.is_primary),
            displayOrder: normalizeText(row.display_order)
        })),
        variants: variantRows.map((row) => ({
            rowNumber: row.__rowNumber,
            productKey: normalizeText(row.product_key),
            size: normalizeText(row.size),
            color: normalizeText(row.color),
            additionalPrice: normalizeText(row.additional_price),
            stockQuantity: normalizeText(row.stock_quantity),
            sku: normalizeText(row.sku),
            imageFile: normalizeText(row.image_file),
            imageUrl: normalizeText(row.image_url)
        }))
    };
}

// Tạo dữ liệu instruction rows.
function buildInstructionRows() {
    return [
        ['Sheet', 'Purpose', 'Required columns', 'Notes'],
        ['Products', 'One row per product', 'product_key, name, category_slug/category_name/category_id, price', 'Prefer category_slug. product_key links all sheets together'],
        ['Images', 'One row per product image', 'product_key, image_file or image_url', 'Use image_file when the real file is inside the uploaded ZIP'],
        ['Variants', 'One row per variant', 'product_key, size or color', 'Variant image can reuse a file already listed in Images'],
        ['ZIP', 'Image source bundle', 'N/A', 'Upload a .zip containing the image files referenced by image_file']
    ];
}

// Tạo workbook buffer.
function createWorkbookBuffer({ productsRows, imagesRows, variantsRows }) {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(buildInstructionRows()), 'Instructions');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(productsRows), 'Products');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(imagesRows), 'Images');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(variantsRows), 'Variants');
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

// Tạo dữ liệu danh mục maps.
function buildCategoryMaps(categories = []) {
    const byId = new Map();
    const bySlug = new Map();
    const byName = new Map();

    categories.forEach((category) => {
        byId.set(String(category.id), category);
        bySlug.set(normalizeLookupKey(category.slug), category);

        const nameKey = normalizeLookupKey(category.name);
        const nameMatches = byName.get(nameKey) || [];
        nameMatches.push(category);
        byName.set(nameKey, nameMatches);
    });

    return { byId, bySlug, byName };
}

// Xác định danh mục id.
function resolveCategoryId(productRow, categoryMaps) {
    let resolvedFromSlug = null;
    let resolvedFromName = null;
    let resolvedFromId = null;

    if (productRow.categorySlug) {
        resolvedFromSlug = categoryMaps.bySlug.get(normalizeLookupKey(productRow.categorySlug)) || null;
        if (!resolvedFromSlug) {
            throw new Error(`Category slug "${productRow.categorySlug}" was not found`);
        }
    }

    if (productRow.categoryName) {
        const matches = categoryMaps.byName.get(normalizeLookupKey(productRow.categoryName)) || [];
        if (matches.length === 1) {
            [resolvedFromName] = matches;
        } else if (matches.length > 1) {
            throw new Error(
                `Category name "${productRow.categoryName}" is ambiguous; please provide category_slug or category_id`
            );
        } else if (!productRow.categorySlug && !productRow.categoryId) {
            throw new Error(`Category "${productRow.categoryName}" was not found`);
        }
    }

    if (productRow.categoryId) {
        resolvedFromId = categoryMaps.byId.get(String(productRow.categoryId)) || null;
        if (!resolvedFromId && !resolvedFromSlug && !resolvedFromName) {
            throw new Error(`Category ID "${productRow.categoryId}" was not found`);
        }
    }

    const chosenCategory = resolvedFromSlug || resolvedFromName || resolvedFromId;
    if (!chosenCategory) {
        throw new Error('Category is required');
    }

    if (resolvedFromSlug && resolvedFromName && Number(resolvedFromSlug.id) !== Number(resolvedFromName.id)) {
        throw new Error(
            `Category slug "${productRow.categorySlug}" does not match category name "${productRow.categoryName}"`
        );
    }

    return chosenCategory.id;
}

// Tạo zip ảnh index.
function createZipImageIndex(zipPath) {
    if (!zipPath) {
        return {
            resolveImagePath() {
                return null;
            },
            cleanup() {}
        };
    }

    if (!fs.existsSync(zipPath)) {
        throw new Error('Image ZIP file was not found');
    }

    const extractRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tmdt-product-import-'));
    const zip = new AdmZip(zipPath);
    const exactMatches = new Map();
    const basenameCandidates = new Map();

    zip.getEntries().forEach((entry) => {
        if (entry.isDirectory) {
            return;
        }

        const normalizedEntryName = normalizeImportPath(entry.entryName);
        if (!normalizedEntryName) {
            return;
        }

        const destinationPath = path.resolve(extractRoot, normalizedEntryName);
        if (!destinationPath.startsWith(extractRoot)) {
            throw new Error(`Invalid ZIP entry path: ${entry.entryName}`);
        }

        fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
        fs.writeFileSync(destinationPath, entry.getData());

        exactMatches.set(normalizedEntryName, destinationPath);

        const basename = path.basename(normalizedEntryName);
        if (!basenameCandidates.has(basename)) {
            basenameCandidates.set(basename, []);
        }
        basenameCandidates.get(basename).push(destinationPath);
    });

    const basenameMatches = new Map();
    basenameCandidates.forEach((matches, basename) => {
        if (matches.length === 1) {
            basenameMatches.set(basename, matches[0]);
        }
    });

    return {
        resolveImagePath(imageReference) {
            const normalizedReference = normalizeImportPath(imageReference);
            if (!normalizedReference) {
                return null;
            }

            return exactMatches.get(normalizedReference)
                || basenameMatches.get(path.basename(normalizedReference))
                || null;
        },
        cleanup() {
            cleanupPath(extractRoot);
        }
    };
}

// Xử lý group rows theo sản phẩm key.
function groupRowsByProductKey(rows = [], label) {
    const groupedRows = new Map();

    rows.forEach((row) => {
        if (!row.productKey) {
            throw new Error(`${label} sheet row ${row.rowNumber} is missing product_key`);
        }

        if (!groupedRows.has(row.productKey)) {
            groupedRows.set(row.productKey, []);
        }
        groupedRows.get(row.productKey).push(row);
    });

    return groupedRows;
}

// Kiểm tra hợp lệ workbook links.
function validateWorkbookLinks(products, images, variants) {
    const productKeys = new Set();

    products.forEach((product) => {
        if (!product.productKey) {
            throw new Error(`Products sheet row ${product.rowNumber} is missing product_key`);
        }

        if (productKeys.has(product.productKey)) {
            throw new Error(`Duplicate product_key "${product.productKey}" in Products sheet`);
        }

        productKeys.add(product.productKey);
    });

    images.forEach((image) => {
        if (!productKeys.has(image.productKey)) {
            throw new Error(`Images sheet row ${image.rowNumber} references unknown product_key "${image.productKey}"`);
        }
    });

    variants.forEach((variant) => {
        if (!productKeys.has(variant.productKey)) {
            throw new Error(`Variants sheet row ${variant.rowNumber} references unknown product_key "${variant.productKey}"`);
        }
    });
}

// Tải lên ảnh từ source.
async function uploadImageFromSource(imageSource, zipIndex, uploadCache) {
    if (imageSource.imageUrl) {
        return imageSource.imageUrl;
    }

    if (!imageSource.imageFile) {
        throw new Error('Image source is missing image_file or image_url');
    }

    const normalizedReference = normalizeImportPath(imageSource.imageFile);
    if (uploadCache.has(normalizedReference)) {
        return uploadCache.get(normalizedReference);
    }

    const localPath = zipIndex.resolveImagePath(imageSource.imageFile);
    if (!localPath) {
        throw new Error(`Image file "${imageSource.imageFile}" was not found inside the ZIP`);
    }

    const uploadResult = await uploadToCloudinary(localPath, { folder: BULK_IMPORT_FOLDER });
    if (!uploadResult.success || !uploadResult.url) {
        throw new Error(uploadResult.error || `Failed to upload image "${imageSource.imageFile}"`);
    }

    uploadCache.set(normalizedReference, uploadResult.url);
    return uploadResult.url;
}

// Đảm bảo sản phẩm ảnh.
async function ensureProductImage(productId, imageSource, context) {
    const sourceKey = imageSource.imageUrl
        ? `url:${normalizeText(imageSource.imageUrl)}`
        : `file:${normalizeImportPath(imageSource.imageFile)}`;

    if (context.productImageRegistry.has(sourceKey)) {
        return context.productImageRegistry.get(sourceKey);
    }

    const imageUrl = await uploadImageFromSource(imageSource, context.zipIndex, context.uploadCache);
    const image = await Product.addImage(
        productId,
        imageUrl,
        !context.hasPrimaryImage && context.displayOrder === 0,
        context.displayOrder
    );
    context.displayOrder += 1;
    context.hasPrimaryImage = true;
    context.productImageRegistry.set(sourceKey, image.id);
    return image.id;
}

// Tạo dữ liệu biến thể payload.
function buildVariantPayload(variantRow) {
    return {
        size: normalizeText(variantRow.size) || null,
        color: normalizeText(variantRow.color) || null,
        additional_price: parseOptionalDecimal(variantRow.additionalPrice, `Variant row ${variantRow.rowNumber} additional_price`) || 0,
        stock_quantity: parseOptionalInteger(variantRow.stockQuantity, `Variant row ${variantRow.rowNumber} stock_quantity`) || 0,
        sku: normalizeText(variantRow.sku) || null
    };
}

// Nhập single sản phẩm.
async function importSingleProduct(productRow, groupedImages, groupedVariants, categoryMaps, zipIndex, uploadCache) {
    let createdProductId = null;

    try {
        if (!productRow.name) {
            throw new Error(`Products sheet row ${productRow.rowNumber} is missing name`);
        }

        const price = parseOptionalDecimal(productRow.price, `Products row ${productRow.rowNumber} price`);
        if (price === null) {
            throw new Error(`Products sheet row ${productRow.rowNumber} is missing price`);
        }

        const productData = {
            category_id: resolveCategoryId(productRow, categoryMaps),
            name: productRow.name,
            slug: productRow.slug || `${slugify(productRow.name)}-${Date.now()}`,
            description: productRow.description || null,
            price,
            stock_quantity: parseOptionalInteger(productRow.stockQuantity, `Products row ${productRow.rowNumber} stock_quantity`) || 0,
            sku: productRow.sku || null,
            sale_id: parseOptionalInteger(productRow.saleId, `Products row ${productRow.rowNumber} sale_id`),
            is_featured: parseBoolean(productRow.isFeatured)
        };

        const variants = groupedVariants.map((variantRow) => {
            const payload = buildVariantPayload(variantRow);
            return {
                ...payload,
                rowNumber: variantRow.rowNumber,
                imageFile: variantRow.imageFile,
                imageUrl: variantRow.imageUrl
            };
        });
        validateVariants(variants);

        const product = await Product.create(productData);
        createdProductId = product.id;

        const productImageRegistry = new Map();
        const sortedImages = [...groupedImages].sort((left, right) => {
            const leftOrder = parseOptionalInteger(left.displayOrder, `Images row ${left.rowNumber} display_order`) ?? Number.MAX_SAFE_INTEGER;
            const rightOrder = parseOptionalInteger(right.displayOrder, `Images row ${right.rowNumber} display_order`) ?? Number.MAX_SAFE_INTEGER;
            return leftOrder - rightOrder;
        });

        const imageContext = {
            zipIndex,
            uploadCache,
            productImageRegistry,
            displayOrder: 0,
            hasPrimaryImage: false
        };

        let imageCount = 0;
        let primaryImageAssigned = false;

        for (const imageRow of sortedImages) {
            if (!imageRow.imageFile && !imageRow.imageUrl) {
                throw new Error(`Images sheet row ${imageRow.rowNumber} is missing image_file or image_url`);
            }

            const imageUrl = await uploadImageFromSource(imageRow, zipIndex, uploadCache);
            const image = await Product.addImage(
                product.id,
                imageUrl,
                parseBoolean(imageRow.isPrimary) || (!primaryImageAssigned && imageCount === 0),
                imageContext.displayOrder
            );

            imageContext.displayOrder += 1;
            imageCount += 1;

            if (parseBoolean(imageRow.isPrimary) || imageCount === 1) {
                primaryImageAssigned = true;
                imageContext.hasPrimaryImage = true;
            }

            if (imageRow.imageFile) {
                productImageRegistry.set(`file:${normalizeImportPath(imageRow.imageFile)}`, image.id);
            }

            if (imageRow.imageUrl) {
                productImageRegistry.set(`url:${normalizeText(imageRow.imageUrl)}`, image.id);
            }
        }

        let variantCount = 0;
        for (const variant of variants) {
            let imageId = null;

            if (variant.imageFile || variant.imageUrl) {
                imageId = await ensureProductImage(product.id, {
                    imageFile: variant.imageFile,
                    imageUrl: variant.imageUrl
                }, imageContext);
                imageCount = Math.max(imageCount, imageContext.displayOrder);
            }

            await Product.addVariant(product.id, {
                size: variant.size,
                color: variant.color,
                additional_price: variant.additional_price,
                stock_quantity: variant.stock_quantity,
                sku: variant.sku,
                image_id: imageId
            });
            variantCount += 1;
        }

        if (imageContext.displayOrder === 0) {
            await Product.addImage(product.id, DEFAULT_IMAGE_URL, true, 0);
            imageCount = 1;
        } else {
            imageCount = imageContext.displayOrder;
        }

        return {
            success: true,
            productId: product.id,
            productKey: productRow.productKey,
            name: productRow.name,
            imageCount,
            variantCount
        };
    } catch (error) {
        if (createdProductId) {
            try {
                await Product.delete(createdProductId);
            } catch (cleanupError) {
                console.warn('Bulk import rollback warning:', cleanupError.message);
            }
        }

        return {
            success: false,
            productKey: productRow.productKey,
            name: productRow.name,
            message: error.message
        };
    }
}

// Nhập sản phẩm từ workbook.
async function importProductsFromWorkbook({ workbookPath, zipPath }) {
    const workbookData = parseWorkbook(workbookPath);
    validateWorkbookLinks(workbookData.products, workbookData.images, workbookData.variants);

    const categories = await Category.findAll();
    const categoryMaps = buildCategoryMaps(categories);
    const imagesByProductKey = groupRowsByProductKey(workbookData.images, 'Images');
    const variantsByProductKey = groupRowsByProductKey(workbookData.variants, 'Variants');
    const zipIndex = createZipImageIndex(zipPath);
    const uploadCache = new Map();

    try {
        const createdProducts = [];
        const errors = [];

        for (const productRow of workbookData.products) {
            const result = await importSingleProduct(
                productRow,
                imagesByProductKey.get(productRow.productKey) || [],
                variantsByProductKey.get(productRow.productKey) || [],
                categoryMaps,
                zipIndex,
                uploadCache
            );

            if (result.success) {
                createdProducts.push(result);
            } else {
                errors.push(result);
            }
        }

        return {
            totalProducts: workbookData.products.length,
            createdCount: createdProducts.length,
            failedCount: errors.length,
            createdProducts,
            errors
        };
    } finally {
        zipIndex.cleanup();
    }
}

// Tạo dữ liệu export sản phẩm key.
function buildExportProductKey(product) {
    if (product?.sku) {
        return normalizeText(product.sku);
    }

    return `PRD-${product.id}`;
}

// Xuất sản phẩm vào workbook buffer.
async function exportProductsToWorkbookBuffer(options = {}) {
    const search = normalizeText(options.search);
    const products = await Product.findAll({
        limit: EXPORT_PRODUCT_LIMIT,
        offset: 0,
        sort_by: 'created_at',
        sort_order: 'DESC',
        ...(search ? { search } : {})
    });

    const productsRows = [];
    const imagesRows = [];
    const variantsRows = [];

    for (const product of products) {
        const productKey = buildExportProductKey(product);
        const images = await Product.getImages(product.id);
        const variants = await Product.getVariants(product.id);
        const imageIdToUrlMap = new Map(
            images.map((image) => [image.id, image.image_url])
        );

        productsRows.push({
            product_key: productKey,
            name: product.name || '',
            slug: product.slug || '',
            category_slug: product.category_slug || '',
            category_name: product.category_name || '',
            category_id: product.category_id ?? '',
            description: product.description || '',
            price: Number(product.price) || 0,
            stock_quantity: Number(product.stock_quantity) || 0,
            sku: product.sku || '',
            sale_id: product.sale_id ?? '',
            is_featured: product.is_featured ? 'TRUE' : 'FALSE'
        });

        images.forEach((image, index) => {
            imagesRows.push({
                product_key: productKey,
                image_file: '',
                image_url: image.image_url || '',
                is_primary: image.is_primary ? 'TRUE' : 'FALSE',
                display_order: image.display_order ?? index
            });
        });

        variants.forEach((variant) => {
            variantsRows.push({
                product_key: productKey,
                size: variant.size || '',
                color: variant.color || '',
                additional_price: Number(variant.additional_price) || 0,
                stock_quantity: Number(variant.stock_quantity) || 0,
                sku: variant.sku || '',
                image_file: '',
                image_url: variant.image_id ? (imageIdToUrlMap.get(variant.image_id) || '') : ''
            });
        });
    }

    return createWorkbookBuffer({ productsRows, imagesRows, variantsRows });
}

// Tạo sản phẩm import template buffer.
function createProductImportTemplateBuffer() {
    const productsRows = [
        {
            product_key: 'NU-CROPTOP-01',
            name: 'Ao Croptop Nu',
            slug: '',
            category_slug: 'nu',
            category_name: 'Nu',
            category_id: '',
            description: 'Ao croptop tay ngan co V',
            price: 280000,
            stock_quantity: 20,
            sku: 'NU-CROP-01',
            sale_id: '',
            is_featured: 'FALSE'
        },
        {
            product_key: 'NU-VAY-MIDI-01',
            name: 'Vay Midi Xoe',
            slug: '',
            category_slug: 'nu',
            category_name: 'Nu',
            category_id: '',
            description: 'Vay midi hoa tiet',
            price: 480000,
            stock_quantity: 12,
            sku: 'NU-VAY-01',
            sale_id: '',
            is_featured: 'TRUE'
        }
    ];

    const imagesRows = [
        {
            product_key: 'NU-CROPTOP-01',
            image_file: 'nu/croptop-01-main.jpg',
            image_url: '',
            is_primary: 'TRUE',
            display_order: 0
        },
        {
            product_key: 'NU-CROPTOP-01',
            image_file: 'nu/croptop-01-side.jpg',
            image_url: '',
            is_primary: 'FALSE',
            display_order: 1
        },
        {
            product_key: 'NU-VAY-MIDI-01',
            image_file: 'nu/vay-midi-01-main.jpg',
            image_url: '',
            is_primary: 'TRUE',
            display_order: 0
        }
    ];

    const variantsRows = [
        {
            product_key: 'NU-CROPTOP-01',
            size: 'S',
            color: 'Trang',
            additional_price: 0,
            stock_quantity: 5,
            sku: 'NU-CROP-01-S-TRANG',
            image_file: 'nu/croptop-01-main.jpg',
            image_url: ''
        },
        {
            product_key: 'NU-CROPTOP-01',
            size: 'M',
            color: 'Den',
            additional_price: 20000,
            stock_quantity: 4,
            sku: 'NU-CROP-01-M-DEN',
            image_file: 'nu/croptop-01-black.jpg',
            image_url: ''
        },
        {
            product_key: 'NU-VAY-MIDI-01',
            size: 'M',
            color: 'Hoa',
            additional_price: 0,
            stock_quantity: 6,
            sku: 'NU-VAY-01-M-HOA',
            image_file: 'nu/vay-midi-01-main.jpg',
            image_url: ''
        }
    ];

    return createWorkbookBuffer({ productsRows, imagesRows, variantsRows });
}

module.exports = {
    createProductImportTemplateBuffer,
    exportProductsToWorkbookBuffer,
    importProductsFromWorkbook,
    parseWorkbook
};
