const Product = require('../models/Product');

function normalizeText(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function normalizeNullableText(value) {
    const normalized = normalizeText(value);
    return normalized === '' ? null : normalized;
}

function normalizeVariantPayload(variant) {
    return {
        id: variant.id ? parseInt(variant.id, 10) : null,
        size: normalizeNullableText(variant.size),
        color: normalizeNullableText(variant.color),
        additional_price: Math.max(0, parseFloat(variant.additional_price) || 0),
        stock_quantity: Math.max(0, parseInt(variant.stock_quantity, 10) || 0),
        sku: normalizeNullableText(variant.sku),
        image_id: variant.image_id ? parseInt(variant.image_id, 10) : null,
        image_key: normalizeText(variant.image_key) || null
    };
}

function parseVariantsPayload(rawVariants) {
    if (!rawVariants || rawVariants === '[]') {
        return [];
    }

    const parsed = typeof rawVariants === 'string' ? JSON.parse(rawVariants) : rawVariants;
    if (!Array.isArray(parsed)) {
        throw new Error('Variant payload is invalid');
    }

    return parsed
        .map(normalizeVariantPayload)
        .filter(variant => variant.size || variant.color || variant.sku || variant.image_id || variant.image_key);
}

function validateVariants(variants) {
    const comboKeys = new Set();
    const skuKeys = new Set();

    variants.forEach((variant, index) => {
        if (!variant.size && !variant.color) {
            throw new Error(`Variant #${index + 1} must have at least size or color`);
        }

        if (variant.additional_price < 0 || variant.stock_quantity < 0) {
            throw new Error(`Variant #${index + 1} has invalid price or stock`);
        }

        const comboKey = `${(variant.size || '').toLowerCase()}::${(variant.color || '').toLowerCase()}`;
        if (comboKeys.has(comboKey)) {
            throw new Error(`Duplicate variant combination detected at row #${index + 1}`);
        }
        comboKeys.add(comboKey);

        if (variant.sku) {
            const skuKey = variant.sku.toLowerCase();
            if (skuKeys.has(skuKey)) {
                throw new Error(`Duplicate variant SKU detected at row #${index + 1}`);
            }
            skuKeys.add(skuKey);
        }
    });
}

function getUploadedFileUrl(file) {
    return file.cloudinaryUrl || `/uploads/${file.filename}`;
}

function splitUploadedFiles(files) {
    const allFiles = Array.isArray(files)
        ? files
        : Object.values(files || {}).flat();

    return {
        productImages: allFiles.filter(file => file.fieldname === 'images'),
        variantImages: allFiles.filter(file => file.fieldname.startsWith('variant_image__'))
    };
}

async function attachUploadedImagesToProduct(productId, files) {
    const { productImages, variantImages } = splitUploadedFiles(files);
    const existingImages = await Product.getImages(productId);
    const imageKeyMap = new Map();
    let displayOrder = existingImages.length;
    let shouldSetPrimary = existingImages.length === 0;

    for (let index = 0; index < productImages.length; index += 1) {
        const file = productImages[index];
        const image = await Product.addImage(
            productId,
            getUploadedFileUrl(file),
            shouldSetPrimary,
            displayOrder
        );
        imageKeyMap.set(`main:${index}`, image.id);
        displayOrder += 1;
        shouldSetPrimary = false;
    }

    for (const file of variantImages) {
        const token = file.fieldname.replace('variant_image__', '');
        const image = await Product.addImage(
            productId,
            getUploadedFileUrl(file),
            shouldSetPrimary,
            displayOrder
        );
        imageKeyMap.set(`upload:${token}`, image.id);
        displayOrder += 1;
        shouldSetPrimary = false;
    }

    return imageKeyMap;
}

async function resolveVariantImageId(productId, variant, imageKeyMap) {
    if (variant.image_id) {
        const image = await Product.findImageById(productId, variant.image_id);
        if (!image) {
            throw new Error(`Variant image ${variant.image_id} does not belong to product ${productId}`);
        }
        return variant.image_id;
    }

    if (variant.image_key) {
        if (!imageKeyMap.has(variant.image_key)) {
            throw new Error(`Uploaded image for variant key ${variant.image_key} was not found`);
        }
        return imageKeyMap.get(variant.image_key);
    }

    return null;
}

async function syncVariants(productId, rawVariants, imageKeyMap) {
    const variants = parseVariantsPayload(rawVariants);
    validateVariants(variants);

    const existingVariants = await Product.getVariants(productId);
    const existingMap = new Map(existingVariants.map(variant => [String(variant.id), variant]));
    const submittedExistingIds = new Set(
        variants
            .filter(variant => variant.id)
            .map(variant => String(variant.id))
    );

    const variantsToDelete = existingVariants.filter(
        variant => !submittedExistingIds.has(String(variant.id))
    );

    for (const variant of variantsToDelete) {
        if (await Product.isVariantReferenced(variant.id)) {
            throw new Error(`Cannot remove variant ${variant.id} because it is already used in cart or order data`);
        }
    }

    for (const variant of variants) {
        const imageId = await resolveVariantImageId(productId, variant, imageKeyMap);
        const payload = {
            size: variant.size,
            color: variant.color,
            additional_price: variant.additional_price,
            stock_quantity: variant.stock_quantity,
            sku: variant.sku,
            image_id: imageId
        };

        if (variant.id) {
            if (!existingMap.has(String(variant.id))) {
                throw new Error(`Variant ${variant.id} does not belong to product ${productId}`);
            }
            await Product.updateVariant(variant.id, payload);
        } else {
            await Product.addVariant(productId, payload);
        }
    }

    for (const variant of variantsToDelete) {
        await Product.deleteVariant(variant.id);
    }

    return variants;
}

module.exports = {
    attachUploadedImagesToProduct,
    parseVariantsPayload,
    splitUploadedFiles,
    syncVariants,
    validateVariants
};