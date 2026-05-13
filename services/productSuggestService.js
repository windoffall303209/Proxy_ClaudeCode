// Service gom logic productsuggestservice để controller không phải lặp xử lý nghiệp vụ.
const pool = require('../config/database');

// Bỏ dấu tiếng Việt để tìm kiếm gợi ý chịu được sai dấu.
function removeVietnameseDiacritics(str = '') {
    return String(str)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .toLowerCase();
}

// Tính khoảng cách Levenshtein để chấp nhận lỗi gõ nhỏ.
function levenshtein(a, b) {
    const m = a.length;
    const n = b.length;
    const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i += 1) dp[i][0] = i;
    for (let j = 0; j <= n; j += 1) dp[0][j] = j;

    for (let i = 1; i <= m; i += 1) {
        for (let j = 1; j <= n; j += 1) {
            dp[i][j] = a[i - 1] === b[j - 1]
                ? dp[i - 1][j - 1]
                : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        }
    }

    return dp[m][n];
}

// So khớp từng từ trong truy vấn với tên sản phẩm theo substring/prefix/edit distance.
function fuzzyWordMatch(queryWord, nameWords) {
    const maxDist = Math.min(3, Math.max(1, Math.floor(queryWord.length / 3)));

    return nameWords.some((nameWord) => {
        if (nameWord.includes(queryWord) || queryWord.includes(nameWord)) return true;
        if (levenshtein(queryWord, nameWord) <= maxDist) return true;

        const minLen = Math.min(queryWord.length, nameWord.length);
        return minLen >= 2 && levenshtein(queryWord.slice(0, minLen), nameWord.slice(0, minLen)) <= 1;
    });
}

// Tính điểm gợi ý dựa trên tên có dấu, không dấu và fuzzy từng từ.
function scoreSuggestedProduct(product, query, normalizedQuery, queryWords) {
    const name = product.name || '';
    const nameNorm = removeVietnameseDiacritics(name);
    const nameWords = nameNorm.split(/\s+/).filter(Boolean);
    const nameLower = name.toLowerCase();
    const queryLower = query.toLowerCase();

    if (nameLower.includes(queryLower)) return 100;
    if (nameNorm.includes(normalizedQuery)) return 90;
    if (queryWords.every((word) => nameNorm.includes(word))) return 80;
    if (queryWords.every((word) => fuzzyWordMatch(word, nameWords))) return 70;

    const matched = queryWords.filter((word) => fuzzyWordMatch(word, nameWords)).length;
    return matched > 0 ? (matched / queryWords.length) * 50 : 0;
}

// Tính giá cuối cùng cho item gợi ý có khuyến mãi đang hoạt động.
function buildSuggestedProductResult(product) {
    let finalPrice = product.price;
    if (product.sale_type === 'percentage') finalPrice = product.price * (1 - product.sale_value / 100);
    else if (product.sale_type === 'fixed') finalPrice = product.price - product.sale_value;

    return {
        id: product.id,
        name: product.name,
        slug: product.slug,
        price: Math.round(finalPrice),
        originalPrice: product.sale_type ? product.price : null,
        image: product.image || null
    };
}

// Lấy danh sách sản phẩm gợi ý cho autocomplete tìm kiếm sản phẩm.
async function getProductSuggestions(query, limit = 6) {
    const q = String(query || '').trim();
    if (q.length < 1) return [];

    const [allRows] = await pool.execute(`
        SELECT p.id, p.name, p.slug, p.price,
               s.type AS sale_type, s.value AS sale_value,
               (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = TRUE LIMIT 1) AS image
        FROM products p
        LEFT JOIN sales s ON p.sale_id = s.id AND s.is_active = TRUE AND NOW() BETWEEN s.start_date AND s.end_date
        WHERE p.is_active = TRUE
        ORDER BY p.name ASC
    `);

    const normalizedQuery = removeVietnameseDiacritics(q);
    const queryWords = normalizedQuery.split(/\s+/).filter(Boolean);

    return allRows
        .map((product) => ({
            ...product,
            score: scoreSuggestedProduct(product, q, normalizedQuery, queryWords)
        }))
        .filter((product) => product.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(buildSuggestedProductResult);
}

module.exports = {
    getProductSuggestions
};
