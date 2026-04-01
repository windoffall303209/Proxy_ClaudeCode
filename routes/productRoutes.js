const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { optionalAuth, verifyToken } = require('../middleware/auth');
const { handleReviewMediaUpload } = require('../middleware/reviewUpload');
const pool = require('../config/database');

// Vietnamese diacritics removal for fuzzy search
function removeVietnameseDiacritics(str) {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd').replace(/Đ/g, 'D')
        .toLowerCase();
}

// Levenshtein distance for typo tolerance
function levenshtein(a, b) {
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            dp[i][j] = a[i - 1] === b[j - 1]
                ? dp[i - 1][j - 1]
                : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        }
    }
    return dp[m][n];
}

// Check if queryWord fuzzy-matches any word in nameWords
function fuzzyWordMatch(queryWord, nameWords) {
    const maxDist = Math.min(3, Math.max(1, Math.floor(queryWord.length / 3)));
    for (const nw of nameWords) {
        // Substring containment
        if (nw.includes(queryWord) || queryWord.includes(nw)) return true;
        // Edit distance
        if (levenshtein(queryWord, nw) <= maxDist) return true;
        // Prefix match (e.g. "qun" partially matches "quan")
        const minLen = Math.min(queryWord.length, nw.length);
        if (minLen >= 2 && levenshtein(queryWord.slice(0, minLen), nw.slice(0, minLen)) <= 1) return true;
    }
    return false;
}

// Autocomplete suggest API (fuzzy Vietnamese search)
router.get('/suggest', async (req, res) => {
    try {
        const q = (req.query.q || '').trim();
        if (q.length < 2) return res.json([]);

        const [allRows] = await pool.execute(`
            SELECT p.id, p.name, p.slug, p.price,
                   s.type AS sale_type, s.value AS sale_value,
                   (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = TRUE LIMIT 1) AS image
            FROM products p
            LEFT JOIN sales s ON p.sale_id = s.id AND s.is_active = TRUE AND NOW() BETWEEN s.start_date AND s.end_date
            WHERE p.is_active = TRUE
            ORDER BY p.name ASC
        `);

        const qNorm = removeVietnameseDiacritics(q);
        const qWords = qNorm.split(/\s+/).filter(w => w.length > 0);

        const scored = allRows.map(r => {
            const name = r.name || '';
            const nameNorm = removeVietnameseDiacritics(name);
            const nameWords = nameNorm.split(/\s+/).filter(w => w.length > 0);
            const nameLower = name.toLowerCase();
            const qLower = q.toLowerCase();

            let score = 0;
            // Exact substring match (with diacritics)
            if (nameLower.includes(qLower)) score = 100;
            // Exact substring match (without diacritics)
            else if (nameNorm.includes(qNorm)) score = 90;
            // All words match exactly (without diacritics)
            else if (qWords.every(w => nameNorm.includes(w))) score = 80;
            // All words fuzzy match
            else if (qWords.every(w => fuzzyWordMatch(w, nameWords))) score = 70;
            // Some words fuzzy match
            else {
                const matched = qWords.filter(w => fuzzyWordMatch(w, nameWords)).length;
                if (matched > 0) score = (matched / qWords.length) * 50;
            }

            return { ...r, score };
        })
        .filter(r => r.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 6);

        const results = scored.map(r => {
            let finalPrice = r.price;
            if (r.sale_type === 'percentage') finalPrice = r.price * (1 - r.sale_value / 100);
            else if (r.sale_type === 'fixed') finalPrice = r.price - r.sale_value;
            return {
                id: r.id, name: r.name, slug: r.slug,
                price: Math.round(finalPrice),
                originalPrice: r.sale_type ? r.price : null,
                image: r.image || null
            };
        });

        res.json(results);
    } catch (err) {
        res.status(500).json([]);
    }
});

// Product routes - all with optionalAuth to pass user info to views
router.get('/', optionalAuth, productController.getProducts);
router.get('/search', optionalAuth, productController.searchProducts);
router.get('/category/:slug', optionalAuth, productController.getProductsByCategory);
router.post('/:slug/reviews', verifyToken, handleReviewMediaUpload, productController.createProductReview);
router.post('/:slug/reviews/:reviewId/edit', verifyToken, handleReviewMediaUpload, productController.updateProductReview);
router.get('/:slug', optionalAuth, productController.getProductDetail);

module.exports = router;
