// Script bảo trì sync sản phẩm ảnh embedding, dùng khi cần kiểm tra hoặc đồng bộ dữ liệu dự án.
require('dotenv').config();

console.log('[visual-sync] Loading service (DB pool may log "Database connected successfully" next)…');

const { syncAllProductImageEmbeddings } = require('../services/productVisualEmbeddingService');

(async () => {
    try {
        const result = await syncAllProductImageEmbeddings();
        console.log('Product image embeddings sync done.');
        console.log(JSON.stringify(result, null, 2));
        process.exit(0);
    } catch (error) {
        console.error('Product image embedding sync failed:', error);
        process.exit(1);
    }
})();
