const crypto = require('crypto');
const pool = require('../config/database');
const Product = require('../models/Product');
const ChatRag = require('../models/ChatRag');
const chatRagKnowledge = require('../config/chatRagKnowledge');
const { createEmbedding, createEmbeddings, resolveEmbeddingModel } = require('./chatEmbeddingService');

const DEFAULT_SYNC_TTL_MINUTES = Number.parseInt(process.env.CHAT_RAG_SYNC_TTL_MINUTES, 10) || 30;
const DEFAULT_PRODUCT_LIMIT = Number.parseInt(process.env.CHAT_RAG_PRODUCT_LIMIT, 10) || 6;
const DEFAULT_KNOWLEDGE_LIMIT = Number.parseInt(process.env.CHAT_RAG_KNOWLEDGE_LIMIT, 10) || 4;
const DEFAULT_PRODUCT_THRESHOLD = Number.parseFloat(process.env.CHAT_RAG_PRODUCT_THRESHOLD || '0.26');
const DEFAULT_KNOWLEDGE_THRESHOLD = Number.parseFloat(process.env.CHAT_RAG_KNOWLEDGE_THRESHOLD || '0.2');

const syncTasks = new Map();

function nowIsoTimestamp() {
    return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

function hashContent(value) {
    return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function normalizeText(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .toLowerCase()
        .trim();
}

function uniqueTerms(values = []) {
    return Array.from(new Set(values.filter(Boolean)));
}

function cosineSimilarity(left = [], right = []) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length === 0 || right.length === 0 || left.length !== right.length) {
        return 0;
    }

    let dot = 0;
    let leftMagnitude = 0;
    let rightMagnitude = 0;

    for (let index = 0; index < left.length; index += 1) {
        const leftValue = Number(left[index] || 0);
        const rightValue = Number(right[index] || 0);
        dot += leftValue * rightValue;
        leftMagnitude += leftValue * leftValue;
        rightMagnitude += rightValue * rightValue;
    }

    if (!leftMagnitude || !rightMagnitude) {
        return 0;
    }

    return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}

function computeLexicalBonus(query, candidateText) {
    const queryTerms = uniqueTerms(normalizeText(query).split(/\s+/).filter((term) => term.length >= 3));
    if (!queryTerms.length) {
        return 0;
    }

    const haystack = normalizeText(candidateText);
    const overlapCount = queryTerms.reduce((count, term) => (haystack.includes(term) ? count + 1 : count), 0);
    return Math.min(0.12, overlapCount * 0.02);
}

function combineScores(vectorScore, lexicalBonus) {
    return vectorScore + lexicalBonus;
}

function isStateFresh(state) {
    if (!state?.last_synced_at) {
        return false;
    }

    const lastSyncedAt = new Date(state.last_synced_at).getTime();
    if (!Number.isFinite(lastSyncedAt)) {
        return false;
    }

    return Date.now() - lastSyncedAt < DEFAULT_SYNC_TTL_MINUTES * 60 * 1000;
}

async function fetchRagProducts() {
    const [rows] = await pool.query(`
        SELECT p.*,
               c.name AS category_name,
               c.slug AS category_slug,
               (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = TRUE LIMIT 1) AS primary_image,
               s.type AS sale_type,
               s.value AS sale_value,
               s.name AS sale_name,
               GROUP_CONCAT(DISTINCT NULLIF(TRIM(pv.color), '') ORDER BY pv.color SEPARATOR ', ') AS variant_colors,
               GROUP_CONCAT(DISTINCT NULLIF(TRIM(pv.size), '') ORDER BY pv.size SEPARATOR ', ') AS variant_sizes
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
        LEFT JOIN sales s ON p.sale_id = s.id
            AND s.is_active = TRUE
            AND NOW() BETWEEN s.start_date AND s.end_date
        LEFT JOIN product_variants pv ON pv.product_id = p.id
        WHERE p.is_active = TRUE
        GROUP BY p.id
        ORDER BY p.id ASC
    `);

    return Product.hydrateListingProducts(rows);
}

function buildProductChunk(product) {
    const colors = uniqueTerms(String(product.variant_colors || '').split(',').map((value) => value.trim()));
    const sizes = uniqueTerms(String(product.variant_sizes || '').split(',').map((value) => value.trim()));
    const keywords = uniqueTerms([
        product.name,
        product.category_name,
        product.category_slug,
        product.sku,
        ...colors,
        ...sizes
    ]);

    const content = [
        `Ten san pham: ${product.name}`,
        product.category_name ? `Danh muc: ${product.category_name}` : '',
        product.description ? `Mo ta: ${String(product.description).replace(/\s+/g, ' ').trim()}` : '',
        colors.length ? `Mau sac: ${colors.join(', ')}` : '',
        sizes.length ? `Kich thuoc: ${sizes.join(', ')}` : '',
        `Gia hien tai: ${Number(product.final_price || product.price || 0).toLocaleString('vi-VN')}d`,
        keywords.length ? `Tu khoa: ${keywords.join(', ')}` : ''
    ].filter(Boolean).join('\n');

    return {
        sourceType: 'product',
        sourceKey: `product:${product.id}`,
        sourceId: product.id,
        chunkKey: 'base',
        title: product.name,
        content,
        metadata: {
            productId: product.id,
            slug: product.slug,
            categoryId: product.category_id,
            categoryName: product.category_name || '',
            price: Number(product.price || 0),
            finalPrice: Number(product.final_price || product.price || 0),
            primaryImage: product.primary_image || '',
            cardImage: product.card_image || '',
            stockQuantity: Number(product.stock_quantity || 0)
        }
    };
}

function buildKnowledgeChunk(document) {
    return {
        sourceType: 'knowledge',
        sourceKey: `knowledge:${document.sourceKey}`,
        sourceId: null,
        chunkKey: 'base',
        title: document.title,
        content: document.content,
        metadata: {
            sourceKey: document.sourceKey
        }
    };
}

async function embedChunks(chunks = []) {
    if (!chunks.length) {
        return [];
    }

    const embeddingModel = resolveEmbeddingModel();
    const results = [];
    const batchSize = 12;

    for (let index = 0; index < chunks.length; index += batchSize) {
        const batch = chunks.slice(index, index + batchSize);
        const embeddings = await createEmbeddings(
            batch.map((chunk) => chunk.content),
            {
                model: embeddingModel,
                inputType: 'passage'
            }
        );

        batch.forEach((chunk, batchIndex) => {
            const embedding = embeddings[batchIndex]?.embedding || [];
            results.push({
                ...chunk,
                embeddingModel,
                embeddingVector: embedding,
                tokenCount: chunk.content.length,
                contentHash: hashContent(chunk.content)
            });
        });
    }

    return results;
}

async function syncProductChunks() {
    const sourceType = 'product';
    await ChatRag.updateSyncState(sourceType, {
        status: 'syncing',
        sourceCount: 0,
        lastSyncedAt: null,
        detail: 'Syncing product RAG index'
    });

    const products = await fetchRagProducts();
    const chunks = products.map((product) => buildProductChunk(product));
    const embeddedChunks = await embedChunks(chunks);

    await ChatRag.replaceSourceChunks(sourceType, embeddedChunks);
    await ChatRag.updateSyncState(sourceType, {
        status: 'idle',
        sourceCount: embeddedChunks.length,
        lastSyncedAt: nowIsoTimestamp(),
        detail: null
    });

    return embeddedChunks.length;
}

async function syncKnowledgeChunks() {
    const sourceType = 'knowledge';
    await ChatRag.updateSyncState(sourceType, {
        status: 'syncing',
        sourceCount: 0,
        lastSyncedAt: null,
        detail: 'Syncing knowledge RAG index'
    });

    const chunks = chatRagKnowledge.map((document) => buildKnowledgeChunk(document));
    const embeddedChunks = await embedChunks(chunks);

    await ChatRag.replaceSourceChunks(sourceType, embeddedChunks);
    await ChatRag.updateSyncState(sourceType, {
        status: 'idle',
        sourceCount: embeddedChunks.length,
        lastSyncedAt: nowIsoTimestamp(),
        detail: null
    });

    return embeddedChunks.length;
}

async function runSyncTask(sourceType, syncFn) {
    if (syncTasks.has(sourceType)) {
        return syncTasks.get(sourceType);
    }

    const task = (async () => {
        try {
            return await syncFn();
        } catch (error) {
            await ChatRag.updateSyncState(sourceType, {
                status: 'error',
                sourceCount: 0,
                lastSyncedAt: nowIsoTimestamp(),
                detail: error.message
            });
            throw error;
        } finally {
            syncTasks.delete(sourceType);
        }
    })();

    syncTasks.set(sourceType, task);
    return task;
}

async function ensureSourceReady(sourceType, syncFn) {
    const [state, chunkCount] = await Promise.all([
        ChatRag.getSyncState(sourceType).catch(() => null),
        ChatRag.countChunks(sourceType).catch(() => 0)
    ]);

    if (chunkCount > 0 && isStateFresh(state) && state?.status !== 'error') {
        return;
    }

    await runSyncTask(sourceType, syncFn);
}

async function ensureChatRagReady() {
    await ensureSourceReady('product', syncProductChunks);
    await ensureSourceReady('knowledge', syncKnowledgeChunks);
}

function scoreChunk(chunk, query, queryEmbedding) {
    const vectorScore = cosineSimilarity(queryEmbedding, chunk.embedding_vector);
    const lexicalBonus = computeLexicalBonus(query, `${chunk.title}\n${chunk.content}`);
    return combineScores(vectorScore, lexicalBonus);
}

async function getProductsByRagMatches(matches = []) {
    const productIds = matches
        .map((match) => Number(match.metadata?.productId || match.source_id || 0))
        .filter((id) => Number.isInteger(id) && id > 0);

    if (!productIds.length) {
        return [];
    }

    const products = await Product.getByIds(productIds);
    const productMap = new Map(products.map((product) => [product.id, product]));

    return matches
        .map((match) => {
            const productId = Number(match.metadata?.productId || match.source_id || 0);
            const product = productMap.get(productId);
            if (!product) {
                return null;
            }

            return {
                ...product,
                rag_score: match.score,
                chat_reason: match.reason || ''
            };
        })
        .filter(Boolean);
}

async function retrieveChatRagContext(query, options = {}) {
    const normalizedQuery = String(query || '').trim();
    if (!normalizedQuery) {
        return {
            products: [],
            knowledge: []
        };
    }

    try {
        await ensureChatRagReady();
    } catch (error) {
        console.error('Chat RAG ensure ready error:', error);
        return {
            products: [],
            knowledge: []
        };
    }

    const [{ embedding: queryEmbedding }] = await Promise.all([
        createEmbedding(normalizedQuery, {
            model: resolveEmbeddingModel(),
            inputType: 'query'
        })
    ]);
    const chunks = await ChatRag.listChunksByTypes(['product', 'knowledge']);

    const scoredChunks = chunks
        .map((chunk) => ({
            ...chunk,
            score: scoreChunk(chunk, normalizedQuery, queryEmbedding)
        }))
        .sort((left, right) => right.score - left.score);

    const productMatches = scoredChunks
        .filter((chunk) => chunk.source_type === 'product' && chunk.score >= DEFAULT_PRODUCT_THRESHOLD)
        .slice(0, options.productLimit || DEFAULT_PRODUCT_LIMIT)
        .map((chunk) => ({
            ...chunk,
            reason: chunk.metadata?.categoryName
                ? `gan voi ${chunk.metadata.categoryName.toLowerCase()}`
                : 'gan voi nhu cau tim kiem'
        }));

    const knowledgeMatches = scoredChunks
        .filter((chunk) => chunk.source_type === 'knowledge' && chunk.score >= DEFAULT_KNOWLEDGE_THRESHOLD)
        .slice(0, options.knowledgeLimit || DEFAULT_KNOWLEDGE_LIMIT)
        .map((chunk) => ({
            title: chunk.title,
            content: chunk.content,
            score: chunk.score,
            sourceKey: chunk.source_key
        }));

    return {
        products: await getProductsByRagMatches(productMatches),
        knowledge: knowledgeMatches
    };
}

async function syncChatRagIndex() {
    await ensureChatRagReady();
    return {
        products: await ChatRag.countChunks('product'),
        knowledge: await ChatRag.countChunks('knowledge')
    };
}

module.exports = {
    ensureChatRagReady,
    retrieveChatRagContext,
    syncChatRagIndex
};
