// Model truy vấn và chuẩn hóa dữ liệu productimageembedding trong MySQL.
const pool = require('../config/database');

class ProductImageEmbedding {
    // Phân tích vector.
    static parseVector(raw) {
        if (!raw) {
            return [];
        }
        if (typeof raw === 'object') {
            return Array.isArray(raw) ? raw : [];
        }
        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed.map(Number) : [];
        } catch (e) {
            return [];
        }
    }

    // Thao tác với hydrate row.
    static hydrateRow(row) {
        if (!row) {
            return row;
        }
        return {
            ...row,
            embedding_vector: this.parseVector(row.embedding_vector)
        };
    }

    // Thao tác với upsert for sản phẩm.
    static async upsertForProduct({
        productId,
        productImageId,
        imageUrl,
        contentHash,
        embeddingModel,
        embeddingDim,
        embeddingVector
    }) {
        await pool.execute(
            `INSERT INTO product_image_embeddings (
                product_id, product_image_id, image_url, content_hash,
                embedding_model, embedding_dim, embedding_vector
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                product_image_id = VALUES(product_image_id),
                image_url = VALUES(image_url),
                content_hash = VALUES(content_hash),
                embedding_model = VALUES(embedding_model),
                embedding_dim = VALUES(embedding_dim),
                embedding_vector = VALUES(embedding_vector),
                updated_at = CURRENT_TIMESTAMP`,
            [
                productId,
                productImageId || null,
                String(imageUrl || '').slice(0, 2048),
                contentHash,
                embeddingModel,
                embeddingDim,
                JSON.stringify(embeddingVector || [])
            ]
        );
    }

    // Xóa theo sản phẩm ID.
    static async deleteByProductId(productId) {
        await pool.execute('DELETE FROM product_image_embeddings WHERE product_id = ?', [productId]);
    }

    // Thao tác với danh sách tất cả for search.
    static async listAllForSearch() {
        const [rows] = await pool.execute(
            `SELECT product_id, product_image_id, image_url, embedding_model, embedding_dim, embedding_vector
             FROM product_image_embeddings`
        );
        return rows.map((row) => this.hydrateRow(row));
    }

    // Đếm tổng số bản ghi.
    static async count() {
        const [rows] = await pool.execute('SELECT COUNT(*) AS total FROM product_image_embeddings');
        return Number(rows[0]?.total || 0);
    }

    // Lấy theo sản phẩm ID.
    static async getByProductId(productId) {
        const [rows] = await pool.execute(
            'SELECT * FROM product_image_embeddings WHERE product_id = ? LIMIT 1',
            [productId]
        );
        return this.hydrateRow(rows[0] || null);
    }
}

module.exports = ProductImageEmbedding;
