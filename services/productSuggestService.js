// Service gom logic goi y tim kiem san pham de controller khong lap xu ly.
const Product = require('../models/Product');

// Tinh gia hien thi cho item goi y, dung cung du lieu da hydrate voi trang ket qua.
function getSuggestionPrice(product) {
    const priceCandidates = [
        product?.display_price,
        product?.final_price,
        product?.price
    ];

    for (const candidate of priceCandidates) {
        const parsedValue = Number(candidate);
        if (Number.isFinite(parsedValue)) {
            return Math.round(parsedValue);
        }
    }

    return 0;
}

// Chuyen product listing sang payload nho cho autocomplete.
function buildSuggestedProductResult(product) {
    const originalPrice = Number(product?.price || 0);
    const displayPrice = getSuggestionPrice(product);

    return {
        id: product.id,
        name: product.name,
        slug: product.slug,
        price: displayPrice,
        originalPrice: displayPrice < originalPrice ? originalPrice : null,
        image: product.card_image || product.primary_image || null
    };
}

// Với query 1 ký tự, chỉ giữ gợi ý có tên sản phẩm hiển thị thật sự chứa/prefix ký tự đó.
// Tránh trường hợp match category/description nhưng dropdown chỉ hiện tên nên nhìn như sai kết quả.
function matchesVisibleProductName(product, query) {
    const normalizedQuery = Product.normalizeSearchText(query).trim();
    if (!normalizedQuery) {
        return false;
    }

    const normalizedName = Product.normalizeSearchText(product?.name || '');
    if (!normalizedName) {
        return false;
    }

    return normalizedName.includes(normalizedQuery);
}

// Lay danh sach goi y bang cung ranking voi trang /products/search.
async function getProductSuggestions(query, limit = 6) {
    const q = String(query || '').trim();
    const safeLimit = Math.min(12, Math.max(1, Number.parseInt(limit, 10) || 6));

    if (q.length < 1) {
        return [];
    }

    const searchLimit = q.length === 1
        ? Math.max(await Product.count().catch(() => safeLimit), safeLimit)
        : safeLimit;
    const products = await Product.search(q, searchLimit);
    const visibleProducts = q.length === 1
        ? products.filter((product) => matchesVisibleProductName(product, q)).slice(0, safeLimit)
        : products;

    return visibleProducts.map(buildSuggestedProductResult);
}

module.exports = {
    getProductSuggestions
};
