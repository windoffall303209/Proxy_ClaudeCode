// Service gom logic categorybulkimportservice để controller không phải lặp xử lý nghiệp vụ.
const XLSX = require('xlsx');

const Category = require('../models/Category');

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
        .replace(/[^a-z0-9/_-]+/g, ' ')
        .trim();
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

// Phân tích optional integer.
function parseOptionalInteger(value, fallback = 0) {
    const normalizedValue = normalizeText(value);
    if (!normalizedValue) {
        return fallback;
    }

    const parsedValue = Number.parseInt(normalizedValue, 10);
    if (!Number.isInteger(parsedValue) || parsedValue < 0) {
        throw new Error('Thứ tự hiển thị không hợp lệ');
    }

    return parsedValue;
}

// Phân tích optional id.
function parseOptionalId(value) {
    const normalizedValue = normalizeText(value);
    if (!normalizedValue) {
        return null;
    }

    const parsedValue = Number.parseInt(normalizedValue, 10);
    if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
        throw new Error('ID danh mục không hợp lệ');
    }

    return parsedValue;
}

// Phân tích workbook.
function parseWorkbook(workbookPath) {
    const workbook = XLSX.readFile(workbookPath);
    const categoryRows = readSheetRows(workbook, 'Categories')
        .filter((row) => isMeaningfulRow(row, ['name', 'slug', 'parent_slug', 'description', 'image_url', 'display_order']));

    if (categoryRows.length === 0) {
        throw new Error('File Excel phải có ít nhất một dòng trong sheet Categories');
    }

    return categoryRows.map((row) => ({
        rowNumber: row.__rowNumber,
        importId: normalizeText(row.id),
        name: normalizeText(row.name),
        slug: normalizeText(row.slug),
        parentSlug: normalizeText(row.parent_slug),
        description: normalizeText(row.description),
        imageUrl: normalizeText(row.image_url),
        displayOrder: normalizeText(row.display_order)
    }));
}

// Tạo workbook buffer.
function createWorkbookBuffer(categoryRows) {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.aoa_to_sheet([
            ['Sheet', 'Purpose', 'Required columns', 'Notes'],
            ['Categories', 'Import or update shop categories', 'name', 'id/slug are optional; parent_slug can point to an existing or imported category']
        ]),
        'Instructions'
    );
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(categoryRows), 'Categories');
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

// Tạo danh mục import template buffer.
function createCategoryImportTemplateBuffer() {
    return createWorkbookBuffer([
        {
            id: '',
            name: 'Ao khoac nu',
            slug: 'ao-khoac-nu',
            parent_slug: 'nu',
            description: 'Danh muc ao khoac cho nu',
            image_url: '',
            display_order: 0
        }
    ]);
}

// Xuất danh mục vào workbook buffer.
async function exportCategoriesToWorkbookBuffer(options = {}) {
    const [categories, allCategories] = await Promise.all([
        Category.findAllForAdmin(options.search ? { search: options.search } : {}),
        Category.findAll()
    ]);
    const categoryById = new Map(allCategories.map((category) => [Number(category.id), category]));

    const rows = categories.map((category) => {
        const parentCategory = category.parent_id ? categoryById.get(Number(category.parent_id)) : null;

        return {
            id: category.id,
            name: category.name,
            slug: category.slug,
            parent_name: parentCategory?.name || '',
            parent_slug: parentCategory?.slug || '',
            description: category.description || '',
            image_url: category.image_url || '',
            display_order: category.display_order || 0,
            product_count: category.product_count || 0,
            child_count: category.child_count || 0
        };
    });

    return createWorkbookBuffer(rows);
}

// Nhập danh mục từ workbook.
async function importCategoriesFromWorkbook({ workbookPath }) {
    const rows = parseWorkbook(workbookPath);
    const existingCategories = await Category.findAllAny();
    const categoryBySlug = new Map(
        existingCategories.map((category) => [normalizeLookupKey(category.slug), category])
    );
    const categoryById = new Map(
        existingCategories.map((category) => [Number(category.id), category])
    );

    let createdCount = 0;
    let updatedCount = 0;
    const errors = [];
    let pendingRows = [...rows];
    let hasProgress = true;

    while (pendingRows.length > 0 && hasProgress) {
        hasProgress = false;
        const unresolvedRows = [];

        for (const row of pendingRows) {
            try {
                if (!row.name) {
                    throw new Error('Tên danh mục là bắt buộc');
                }

                const importId = parseOptionalId(row.importId);
                const slug = row.slug || slugify(row.name);
                if (!slug) {
                    throw new Error('Slug danh mục không hợp lệ');
                }

                if (row.parentSlug && normalizeLookupKey(row.parentSlug) === normalizeLookupKey(slug)) {
                    throw new Error('Danh mục không thể tự làm cha của chính nó');
                }

                let parentId = null;
                if (row.parentSlug) {
                    const parentCategory = categoryBySlug.get(normalizeLookupKey(row.parentSlug));
                    if (!parentCategory) {
                        unresolvedRows.push(row);
                        continue;
                    }

                    parentId = parentCategory.id;
                }

                const payload = {
                    name: row.name,
                    slug,
                    description: row.description || null,
                    parent_id: parentId,
                    image_url: row.imageUrl || null,
                    display_order: parseOptionalInteger(row.displayOrder, 0),
                    is_active: true
                };

                const slugKey = normalizeLookupKey(slug);
                const existingCategory = categoryBySlug.get(slugKey) || null;
                const categoryByImportedId = importId ? (categoryById.get(importId) || null) : null;

                if (importId && existingCategory && Number(existingCategory.id) !== importId) {
                    throw new Error(
                        `Slug "${slug}" đang thuộc danh mục ID ${existingCategory.id}; không thể ép sang ID ${importId}`
                    );
                }

                if (importId && categoryByImportedId && normalizeLookupKey(categoryByImportedId.slug) !== slugKey) {
                    throw new Error(
                        `ID ${importId} đang thuộc slug "${categoryByImportedId.slug}"; dữ liệu import bị xung đột`
                    );
                }

                const targetCategory = existingCategory || categoryByImportedId || null;

                if (targetCategory) {
                    if (parentId && Number(targetCategory.id) === Number(parentId)) {
                        throw new Error('Danh mục không thể tự làm cha của chính nó');
                    }

                    const updatedCategory = await Category.update(targetCategory.id, payload);
                    const normalizedCategory = {
                        ...targetCategory,
                        ...payload,
                        ...updatedCategory
                    };

                    categoryBySlug.set(slugKey, normalizedCategory);
                    categoryById.set(Number(targetCategory.id), normalizedCategory);
                    updatedCount += 1;
                } else {
                    const createdCategory = await Category.create(payload, { id: importId });
                    const normalizedCategory = {
                        id: createdCategory.id,
                        ...payload
                    };

                    categoryBySlug.set(slugKey, normalizedCategory);
                    categoryById.set(Number(createdCategory.id), normalizedCategory);
                    createdCount += 1;
                }

                hasProgress = true;
            } catch (error) {
                errors.push({
                    rowNumber: row.rowNumber,
                    message: error.message
                });
                hasProgress = true;
            }
        }

        if (unresolvedRows.length === pendingRows.length) {
            unresolvedRows.forEach((row) => {
                errors.push({
                    rowNumber: row.rowNumber,
                    message: `Không tìm thấy danh mục cha với slug "${row.parentSlug}"`
                });
            });
            break;
        }

        pendingRows = unresolvedRows;
    }

    return {
        totalRows: rows.length,
        createdCount,
        updatedCount,
        failedCount: errors.length,
        errors
    };
}

module.exports = {
    createCategoryImportTemplateBuffer,
    exportCategoriesToWorkbookBuffer,
    importCategoriesFromWorkbook
};
