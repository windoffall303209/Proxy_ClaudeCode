// Script bảo trì reconcile sản phẩm danh mục ids, dùng khi cần kiểm tra hoặc đồng bộ dữ liệu dự án.
const path = require('path');
const XLSX = require('xlsx');

const pool = require('../config/database');

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

// Phân tích args.
function parseArgs(argv) {
    const args = {
        workbookPath: path.resolve(process.cwd(), 'yody-products-import.xlsx'),
        apply: false
    };

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg === '--apply') {
            args.apply = true;
            continue;
        }

        if (arg === '--workbook' && argv[index + 1]) {
            args.workbookPath = path.resolve(process.cwd(), argv[index + 1]);
            index += 1;
        }
    }

    return args;
}

// Xử lý read workbook sản phẩm.
function readWorkbookProducts(workbookPath) {
    const workbook = XLSX.readFile(workbookPath);
    const sheet = workbook.Sheets.Products || workbook.Sheets.products;
    if (!sheet) {
        throw new Error('Workbook does not contain a Products sheet');
    }

    return XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false }).map((row) => ({
        sku: normalizeText(row.sku),
        slug: normalizeText(row.slug),
        name: normalizeText(row.name),
        categorySlug: normalizeText(row.category_slug),
        categoryName: normalizeText(row.category_name),
        categoryId: normalizeText(row.category_id)
    }));
}

// Tạo dữ liệu workbook indexes.
function buildWorkbookIndexes(rows) {
    const bySku = new Map();
    const bySlug = new Map();
    const byName = new Map();

    rows.forEach((row) => {
        if (row.sku) {
            bySku.set(normalizeLookupKey(row.sku), row);
        }
        if (row.slug) {
            bySlug.set(normalizeLookupKey(row.slug), row);
        }
        if (row.name) {
            byName.set(normalizeLookupKey(row.name), row);
        }
    });

    return { bySku, bySlug, byName };
}

// Tạo dữ liệu danh mục maps.
function buildCategoryMaps(categories) {
    const byId = new Map();
    const bySlug = new Map();
    const byName = new Map();

    categories.forEach((category) => {
        byId.set(String(category.id), category);
        bySlug.set(normalizeLookupKey(category.slug), category);
        const nameKey = normalizeLookupKey(category.name);
        const matches = byName.get(nameKey) || [];
        matches.push(category);
        byName.set(nameKey, matches);
    });

    return { byId, bySlug, byName };
}

// Xác định target danh mục.
function resolveTargetCategory(row, categoryMaps) {
    if (row.categorySlug) {
        return categoryMaps.bySlug.get(normalizeLookupKey(row.categorySlug)) || null;
    }

    if (row.categoryName) {
        const matches = categoryMaps.byName.get(normalizeLookupKey(row.categoryName)) || [];
        if (matches.length === 1) {
            return matches[0];
        }
        if (matches.length > 1) {
            throw new Error(`Ambiguous category name "${row.categoryName}"`);
        }
    }

    if (row.categoryId) {
        return categoryMaps.byId.get(String(row.categoryId)) || null;
    }

    return null;
}

// Tìm workbook row.
function findWorkbookRow(product, indexes) {
    if (product.sku) {
        const bySku = indexes.bySku.get(normalizeLookupKey(product.sku));
        if (bySku) {
            return bySku;
        }
    }

    if (product.slug) {
        const bySlug = indexes.bySlug.get(normalizeLookupKey(product.slug));
        if (bySlug) {
            return bySlug;
        }
    }

    if (product.name) {
        return indexes.byName.get(normalizeLookupKey(product.name)) || null;
    }

    return null;
}

// Chạy luồng chính của script.
async function main() {
    const { workbookPath, apply } = parseArgs(process.argv.slice(2));
    const workbookRows = readWorkbookProducts(workbookPath);
    const indexes = buildWorkbookIndexes(workbookRows);

    const [categories] = await pool.query(`
        SELECT id, name, slug
        FROM categories
        WHERE is_active = TRUE
        ORDER BY id ASC
    `);
    const [products] = await pool.query(`
        SELECT id, name, slug, sku, category_id
        FROM products
        WHERE is_active = TRUE
        ORDER BY id ASC
    `);

    const categoryMaps = buildCategoryMaps(categories);
    const updates = [];
    const skipped = [];

    for (const product of products) {
        const workbookRow = findWorkbookRow(product, indexes);
        if (!workbookRow) {
            skipped.push({
                productId: product.id,
                reason: 'no workbook row found',
                sku: product.sku,
                slug: product.slug
            });
            continue;
        }

        let targetCategory = null;
        try {
            targetCategory = resolveTargetCategory(workbookRow, categoryMaps);
        } catch (error) {
            skipped.push({
                productId: product.id,
                reason: error.message,
                sku: product.sku,
                slug: product.slug
            });
            continue;
        }

        if (!targetCategory) {
            skipped.push({
                productId: product.id,
                reason: 'target category not found',
                sku: product.sku,
                slug: product.slug
            });
            continue;
        }

        if (Number(product.category_id) !== Number(targetCategory.id)) {
            updates.push({
                productId: product.id,
                name: product.name,
                fromCategoryId: product.category_id,
                toCategoryId: targetCategory.id,
                toCategorySlug: targetCategory.slug
            });
        }
    }

    if (apply && updates.length > 0) {
        for (const update of updates) {
            await pool.execute(
                'UPDATE products SET category_id = ? WHERE id = ?',
                [update.toCategoryId, update.productId]
            );
        }
    }

    const summary = {
        workbookPath,
        apply,
        totalProducts: products.length,
        matchedUpdates: updates.length,
        skipped: skipped.length,
        sampleUpdates: updates.slice(0, 20),
        sampleSkipped: skipped.slice(0, 20)
    };

    console.log(JSON.stringify(summary, null, 2));
}

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await pool.end();
    });
