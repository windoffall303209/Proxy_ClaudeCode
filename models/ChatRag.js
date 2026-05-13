// Model truy vấn và chuẩn hóa dữ liệu chatrag trong MySQL.
const pool = require('../config/database');

class ChatRag {
    // Phân tích json.
    static parseJson(rawValue, fallback = null) {
        if (!rawValue) {
            return fallback;
        }

        if (typeof rawValue === 'object') {
            return rawValue;
        }

        try {
            return JSON.parse(rawValue);
        } catch (error) {
            return fallback;
        }
    }

    // Thao tác với hydrate chunk.
    static hydrateChunk(row) {
        if (!row) {
            return row;
        }

        return {
            ...row,
            metadata: this.parseJson(row.metadata, {}),
            embedding_vector: this.parseJson(row.embedding_vector, [])
        };
    }

    // Thao tác với hydrate chunks.
    static hydrateChunks(rows = []) {
        return rows.map((row) => this.hydrateChunk(row));
    }

    // Thao tác với danh sách chunks theo types.
    static async listChunksByTypes(sourceTypes = []) {
        const normalizedTypes = Array.isArray(sourceTypes) ? sourceTypes.filter(Boolean) : [];
        let query = 'SELECT * FROM chat_rag_chunks';
        const params = [];

        if (normalizedTypes.length) {
            query += ` WHERE source_type IN (${normalizedTypes.map(() => '?').join(', ')})`;
            params.push(...normalizedTypes);
        }

        query += ' ORDER BY source_type ASC, id ASC';
        const [rows] = await pool.execute(query, params);
        return this.hydrateChunks(rows);
    }

    // Đếm chunks.
    static async countChunks(sourceType) {
        const [rows] = await pool.execute(
            'SELECT COUNT(*) AS total FROM chat_rag_chunks WHERE source_type = ?',
            [sourceType]
        );

        return Number(rows[0]?.total || 0);
    }

    // Thao tác với replace source chunks.
    static async replaceSourceChunks(sourceType, chunks = []) {
        const connection = await pool.getConnection();

        try {
            await connection.beginTransaction();

            await connection.execute(
                'DELETE FROM chat_rag_chunks WHERE source_type = ?',
                [sourceType]
            );

            for (const chunk of chunks) {
                await connection.execute(
                    `INSERT INTO chat_rag_chunks (
                        source_type,
                        source_key,
                        source_id,
                        chunk_key,
                        title,
                        content,
                        metadata,
                        embedding_model,
                        embedding_vector,
                        token_count,
                        content_hash
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        chunk.sourceType,
                        chunk.sourceKey,
                        chunk.sourceId || null,
                        chunk.chunkKey || 'base',
                        chunk.title,
                        chunk.content,
                        JSON.stringify(chunk.metadata || {}),
                        chunk.embeddingModel,
                        JSON.stringify(chunk.embeddingVector || []),
                        Number(chunk.tokenCount || 0),
                        chunk.contentHash
                    ]
                );
            }

            await connection.commit();
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    // Lấy sync state.
    static async getSyncState(sourceType) {
        const [rows] = await pool.execute(
            'SELECT * FROM chat_rag_sync_state WHERE source_type = ? LIMIT 1',
            [sourceType]
        );

        return rows[0] || null;
    }

    // Cập nhật sync state.
    static async updateSyncState(sourceType, payload = {}) {
        await pool.execute(
            `INSERT INTO chat_rag_sync_state (source_type, source_count, status, last_synced_at, detail)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                 source_count = VALUES(source_count),
                 status = VALUES(status),
                 last_synced_at = VALUES(last_synced_at),
                 detail = VALUES(detail)`,
            [
                sourceType,
                Number(payload.sourceCount || 0),
                payload.status || 'idle',
                payload.lastSyncedAt || null,
                payload.detail || null
            ]
        );
    }
}

module.exports = ChatRag;
