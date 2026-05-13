// Service gom logic chatragservice để controller không phải lặp xử lý nghiệp vụ.
const crypto = require('crypto');
const pool = require('../config/database');
const Product = require('../models/Product');
const ChatRag = require('../models/ChatRag');
const chatRagKnowledge = require('../config/chatRagKnowledge');
const {
    createEmbedding,
    createEmbeddings,
    estimateTokenCount,
    resolveEmbeddingModel
} = require('./chatEmbeddingService');

const DEFAULT_SYNC_TTL_MINUTES = Number.parseInt(process.env.CHAT_RAG_SYNC_TTL_MINUTES, 10) || 30;
const DEFAULT_PRODUCT_LIMIT = Number.parseInt(process.env.CHAT_RAG_PRODUCT_LIMIT, 10) || 6;
const DEFAULT_KNOWLEDGE_LIMIT = Number.parseInt(process.env.CHAT_RAG_KNOWLEDGE_LIMIT, 10) || 4;
const DEFAULT_PRODUCT_THRESHOLD = Number.parseFloat(process.env.CHAT_RAG_PRODUCT_THRESHOLD || '0.26');
const DEFAULT_KNOWLEDGE_THRESHOLD = Number.parseFloat(process.env.CHAT_RAG_KNOWLEDGE_THRESHOLD || '0.2');
const DEFAULT_EMBEDDING_CHUNK_TOKENS = Number.parseInt(process.env.CHAT_RAG_EMBEDDING_CHUNK_TOKENS, 10) || 220;
const DEFAULT_MAX_PRODUCT_DETAIL_CHUNKS = Number.parseInt(process.env.CHAT_RAG_MAX_PRODUCT_DETAIL_CHUNKS, 10) || 3;
const DEFAULT_READY_WAIT_TIMEOUT_MS = Number.parseInt(process.env.CHAT_RAG_READY_WAIT_TIMEOUT_MS, 10) || 1500;

const syncTasks = new Map();

// Xử lý now iso timestamp.
function nowIsoTimestamp() {
    return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

// Xử lý hash content.
function hashContent(value) {
    return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

// Chuẩn hóa text.
function normalizeText(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .toLowerCase()
        .trim();
}

// Xử lý unique terms.
function uniqueTerms(values = []) {
    return Array.from(new Set(values.filter(Boolean)));
}

// Xử lý compact whitespace.
function compactWhitespace(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

// Xử lý split oversized text.
function splitOversizedText(text, maxTokens = DEFAULT_EMBEDDING_CHUNK_TOKENS) {
    let remaining = compactWhitespace(text);
    if (!remaining) {
        return [];
    }

    const maxChars = Math.max(240, maxTokens * 4);
    const chunks = [];

    while (remaining) {
        if (estimateTokenCount(remaining) <= maxTokens) {
            chunks.push(remaining);
            break;
        }

        const windowText = remaining.slice(0, maxChars);
        const breakpoints = ['. ', '! ', '? ', '; ', ', ', ' ']
            .map((token) => windowText.lastIndexOf(token))
            .filter((index) => index >= Math.floor(maxChars * 0.6));
        const breakIndex = breakpoints.length ? Math.max(...breakpoints) + 1 : windowText.length;
        const chunk = remaining.slice(0, breakIndex).trim();

        if (!chunk) {
            break;
        }

        chunks.push(chunk);
        remaining = remaining.slice(breakIndex).trim();
    }

    return chunks.filter(Boolean);
}

// Xử lý split text cho embedding.
function splitTextForEmbedding(text, options = {}) {
    const normalized = compactWhitespace(text);
    if (!normalized) {
        return [];
    }

    const maxTokens = Math.max(120, Number(options.maxTokens) || DEFAULT_EMBEDDING_CHUNK_TOKENS);
    const maxChunks = Math.max(1, Number(options.maxChunks) || Number.MAX_SAFE_INTEGER);
    const sentenceParts = normalized
        .split(/(?<=[.!?])\s+/)
        .map((item) => compactWhitespace(item))
        .filter(Boolean);
    const segments = sentenceParts.length ? sentenceParts : [normalized];
    const chunks = [];
    let current = '';

    // Xử lý push current.
    const pushCurrent = () => {
        const normalizedChunk = compactWhitespace(current);
        if (normalizedChunk) {
            chunks.push(normalizedChunk);
        }
        current = '';
    };

    for (const segment of segments) {
        if (estimateTokenCount(segment) > maxTokens) {
            pushCurrent();
            const oversizedChunks = splitOversizedText(segment, maxTokens);
            oversizedChunks.forEach((item) => {
                if (chunks.length < maxChunks) {
                    chunks.push(item);
                }
            });

            if (chunks.length >= maxChunks) {
                break;
            }

            continue;
        }

        const candidate = current ? `${current} ${segment}` : segment;
        if (estimateTokenCount(candidate) > maxTokens) {
            pushCurrent();
            current = segment;
        } else {
            current = candidate;
        }
    }

    pushCurrent();

    if (chunks.length <= maxChunks) {
        return chunks;
    }

    const allowed = chunks.slice(0, maxChunks);
    const remainder = compactWhitespace(chunks.slice(maxChunks - 1).join(' '));
    const condensedRemainder = splitOversizedText(remainder, maxTokens)[0];

    if (condensedRemainder) {
        allowed[allowed.length - 1] = condensedRemainder;
    }

    return allowed.filter(Boolean);
}

// Xử lý cosine similarity.
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

// Tính lexical bonus.
function computeLexicalBonus(query, candidateText) {
    const queryTerms = uniqueTerms(normalizeText(query).split(/\s+/).filter((term) => term.length >= 3));
    if (!queryTerms.length) {
        return 0;
    }

    const haystack = normalizeText(candidateText);
    const overlapCount = queryTerms.reduce((count, term) => (haystack.includes(term) ? count + 1 : count), 0);
    return Math.min(0.12, overlapCount * 0.02);
}

// Xử lý combine scores.
function combineScores(vectorScore, lexicalBonus) {
    return vectorScore + lexicalBonus;
}

// Kiểm tra state fresh.
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

// Tải rag sản phẩm.
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

// Tạo dữ liệu base chunk.
function buildBaseChunk(payload = {}) {
    return {
        sourceType: payload.sourceType,
        sourceKey: payload.sourceKey,
        sourceId: payload.sourceId,
        chunkKey: payload.chunkKey || 'base',
        title: payload.title,
        content: payload.content,
        metadata: payload.metadata || {}
    };
}

// Đảm bảo chunk within limit.
function ensureChunkWithinLimit(chunk, maxTokens = DEFAULT_EMBEDDING_CHUNK_TOKENS) {
    if (estimateTokenCount(chunk.content) <= maxTokens) {
        return [chunk];
    }

    const targetTokens = Math.max(40, Math.floor(maxTokens * 0.8));
    const splitContents = splitTextForEmbedding(chunk.content, {
        maxTokens: targetTokens,
        maxChunks: 8
    });

    const fallbackContents = splitContents.length > 1
        ? splitContents
        : splitOversizedText(chunk.content, targetTokens);
    const contents = fallbackContents.filter(Boolean);

    if (!contents.length || (contents.length === 1 && contents[0] === chunk.content)) {
        return [chunk];
    }

    return contents.map((content, index) => buildBaseChunk({
        ...chunk,
        chunkKey: `${chunk.chunkKey}-part-${index + 1}`,
        content,
        metadata: {
            ...(chunk.metadata || {}),
            parentChunkKey: chunk.chunkKey,
            partIndex: index + 1,
            partTotal: contents.length
        }
    }));
}

// Tạo dữ liệu sản phẩm chunks.
function buildProductChunks(product) {
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
    const sharedLines = [
        `Ten san pham: ${product.name}`,
        product.category_name ? `Danh muc: ${product.category_name}` : '',
        colors.length ? `Mau sac: ${colors.join(', ')}` : '',
        sizes.length ? `Kich thuoc: ${sizes.join(', ')}` : '',
        `Gia hien tai: ${Number(product.final_price || product.price || 0).toLocaleString('vi-VN')}d`
    ].filter(Boolean);
    const keywordLine = keywords.length ? `Tu khoa: ${keywords.join(', ')}` : '';
    const sourceType = 'product';
    const sourceKey = `product:${product.id}`;
    const metadata = {
        productId: product.id,
        slug: product.slug,
        categoryId: product.category_id,
        categoryName: product.category_name || '',
        price: Number(product.price || 0),
        finalPrice: Number(product.final_price || product.price || 0),
        primaryImage: product.primary_image || '',
        cardImage: product.card_image || '',
        stockQuantity: Number(product.stock_quantity || 0)
    };
    const baseDescription = compactWhitespace(product.description);
    const sharedPrefix = sharedLines.join('\n');
    const summaryPrefixCandidate = [sharedPrefix, keywordLine].filter(Boolean).join('\n');
    const summaryPrefix = estimateTokenCount(summaryPrefixCandidate) <= DEFAULT_EMBEDDING_CHUNK_TOKENS
        ? summaryPrefixCandidate
        : (estimateTokenCount(sharedPrefix) <= DEFAULT_EMBEDDING_CHUNK_TOKENS
            ? sharedPrefix
            : (splitOversizedText(summaryPrefixCandidate, DEFAULT_EMBEDDING_CHUNK_TOKENS)[0] || sharedPrefix));
    const baseContent = baseDescription
        ? `${summaryPrefix}\nMo ta: ${baseDescription}`
        : summaryPrefix;

    if (estimateTokenCount(baseContent) <= DEFAULT_EMBEDDING_CHUNK_TOKENS) {
        return [
            buildBaseChunk({
                sourceType,
                sourceKey,
                sourceId: product.id,
                chunkKey: 'base',
                title: product.name,
                content: baseContent,
                metadata
            })
        ].flatMap((chunk) => ensureChunkWithinLimit(chunk));
    }

    const detailPrefix = estimateTokenCount(sharedPrefix) <= Math.max(80, DEFAULT_EMBEDDING_CHUNK_TOKENS - 56)
        ? sharedPrefix
        : (splitOversizedText(sharedPrefix, Math.max(80, DEFAULT_EMBEDDING_CHUNK_TOKENS - 56))[0] || summaryPrefix);

    const summaryChunk = buildBaseChunk({
        sourceType,
        sourceKey,
        sourceId: product.id,
        chunkKey: 'summary',
        title: product.name,
        content: summaryPrefix,
        metadata: {
            ...metadata,
            chunkType: 'summary'
        }
    });

    const descriptionBudget = Math.max(
        40,
        DEFAULT_EMBEDDING_CHUNK_TOKENS - estimateTokenCount(detailPrefix) - 18
    );
    const descriptionChunks = splitTextForEmbedding(baseDescription, {
        maxTokens: descriptionBudget,
        maxChunks: DEFAULT_MAX_PRODUCT_DETAIL_CHUNKS
    });
    const detailChunks = descriptionChunks.map((descriptionChunk, index) => buildBaseChunk({
        sourceType,
        sourceKey,
        sourceId: product.id,
        chunkKey: `detail-${index + 1}`,
        title: product.name,
        content: `${detailPrefix}\nMo ta chi tiet (${index + 1}/${descriptionChunks.length}): ${descriptionChunk}`,
        metadata: {
            ...metadata,
            chunkType: 'detail',
            detailIndex: index + 1,
            detailTotal: descriptionChunks.length
        }
    }));

    return [summaryChunk, ...detailChunks].flatMap((chunk) => ensureChunkWithinLimit(chunk));
}

// Tạo dữ liệu knowledge chunks.
function buildKnowledgeChunks(document) {
    const chunks = splitTextForEmbedding(document.content, {
        maxTokens: DEFAULT_EMBEDDING_CHUNK_TOKENS
    });

    return chunks.map((content, index) => buildBaseChunk({
        sourceType: 'knowledge',
        sourceKey: `knowledge:${document.sourceKey}`,
        sourceId: null,
        chunkKey: chunks.length === 1 ? 'base' : `part-${index + 1}`,
        title: document.title,
        content,
        metadata: {
            sourceKey: document.sourceKey,
            chunkIndex: index + 1,
            chunkTotal: chunks.length
        }
    })).flatMap((chunk) => ensureChunkWithinLimit(chunk));
}

// Xử lý embed chunks.
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
                tokenCount: estimateTokenCount(chunk.content),
                contentHash: hashContent(chunk.content)
            });
        });
    }

    return results;
}

// Đồng bộ sản phẩm chunks.
async function syncProductChunks() {
    const sourceType = 'product';
    await ChatRag.updateSyncState(sourceType, {
        status: 'syncing',
        sourceCount: 0,
        lastSyncedAt: null,
        detail: 'Syncing product RAG index'
    });

    const products = await fetchRagProducts();
    const chunks = products.flatMap((product) => buildProductChunks(product));
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

// Đồng bộ knowledge chunks.
async function syncKnowledgeChunks() {
    const sourceType = 'knowledge';
    await ChatRag.updateSyncState(sourceType, {
        status: 'syncing',
        sourceCount: 0,
        lastSyncedAt: null,
        detail: 'Syncing knowledge RAG index'
    });

    const chunks = chatRagKnowledge.flatMap((document) => buildKnowledgeChunks(document));
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

// Xử lý run sync task.
async function runSyncTask(sourceType, syncFn) {
    if (syncTasks.has(sourceType)) {
        return syncTasks.get(sourceType);
    }

    // Xử lý task.
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

// Xử lý wait cho task với timeout.
function waitForTaskWithTimeout(task, timeoutMs = DEFAULT_READY_WAIT_TIMEOUT_MS) {
    if (!task || !Number.isFinite(timeoutMs) || timeoutMs <= 0) {
        return task;
    }

    return Promise.race([
        task,
        new Promise((resolve) => {
            const timeoutId = setTimeout(() => resolve('timeout'), timeoutMs);
            timeoutId.unref?.();
        })
    ]);
}

// Lên lịch source refresh.
function scheduleSourceRefresh(sourceType, syncFn) {
    runSyncTask(sourceType, syncFn).catch((error) => {
        console.error(`Chat RAG background sync error (${sourceType}):`, error.message || error);
    });
}

// Đảm bảo source ready.
async function ensureSourceReady(sourceType, syncFn, options = {}) {
    const waitForReady = Boolean(options.waitForReady);
    const waitTimeoutMs = Math.max(0, Number.parseInt(options.waitTimeoutMs, 10) || DEFAULT_READY_WAIT_TIMEOUT_MS);
    const [state, chunkCount] = await Promise.all([
        ChatRag.getSyncState(sourceType).catch(() => null),
        ChatRag.countChunks(sourceType).catch(() => 0)
    ]);
    const hasChunks = chunkCount > 0;
    const isFresh = hasChunks && isStateFresh(state) && state?.status !== 'error';

    if (isFresh) {
        return { ready: true, chunkCount, stale: false };
    }

    if (hasChunks) {
        scheduleSourceRefresh(sourceType, syncFn);
        return { ready: true, chunkCount, stale: true };
    }

    const task = runSyncTask(sourceType, syncFn);
    if (!waitForReady) {
        return { ready: false, chunkCount: 0, stale: true };
    }

    const result = await waitForTaskWithTimeout(task, waitTimeoutMs);
    if (result === 'timeout') {
        return { ready: false, chunkCount: 0, stale: true, timedOut: true };
    }

    return { ready: true, chunkCount: Number(result || 0), stale: false };
}

// Đảm bảo chat rag ready.
async function ensureChatRagReady(options = {}) {
    const product = await ensureSourceReady('product', syncProductChunks, options);
    const knowledge = await ensureSourceReady('knowledge', syncKnowledgeChunks, options);
    return {
        product,
        knowledge
    };
}

// Xử lý score chunk.
function scoreChunk(chunk, query, queryEmbedding) {
    const vectorScore = cosineSimilarity(queryEmbedding, chunk.embedding_vector);
    const lexicalBonus = computeLexicalBonus(query, `${chunk.title}\n${chunk.content}`);
    return combineScores(vectorScore, lexicalBonus);
}

// Lấy sản phẩm theo rag matches.
async function getProductsByRagMatches(matches = []) {
    const bestMatchesByProductId = new Map();

    matches.forEach((match) => {
        const productId = Number(match.metadata?.productId || match.source_id || 0);
        if (!Number.isInteger(productId) || productId <= 0) {
            return;
        }

        const existingMatch = bestMatchesByProductId.get(productId);
        if (!existingMatch || Number(match.score || 0) > Number(existingMatch.score || 0)) {
            bestMatchesByProductId.set(productId, match);
        }
    });

    const rankedMatches = Array.from(bestMatchesByProductId.values())
        .sort((left, right) => Number(right.score || 0) - Number(left.score || 0));
    const productIds = rankedMatches.map((match) => Number(match.metadata?.productId || match.source_id || 0));

    if (!productIds.length) {
        return [];
    }

    const products = await Product.getByIds(productIds);
    const productMap = new Map(products.map((product) => [product.id, product]));

    return rankedMatches
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

// Xử lý retrieve chat rag context.
async function retrieveChatRagContext(query, options = {}) {
    const normalizedQuery = String(query || '').trim();
    if (!normalizedQuery) {
        return {
            products: [],
            knowledge: []
        };
    }

    let readyState = null;
    try {
        readyState = await ensureChatRagReady({
            waitForReady: false,
            waitTimeoutMs: DEFAULT_READY_WAIT_TIMEOUT_MS
        });
    } catch (error) {
        console.error('Chat RAG ensure ready error:', error);
        return {
            products: [],
            knowledge: []
        };
    }

    const hasAnyChunks = Boolean(readyState?.product?.chunkCount || readyState?.knowledge?.chunkCount);
    if (!hasAnyChunks) {
        return {
            products: [],
            knowledge: []
        };
    }

    let queryEmbedding = [];

    try {
        const embeddingResult = await createEmbedding(normalizedQuery, {
            model: resolveEmbeddingModel(),
            inputType: 'query'
        });
        queryEmbedding = embeddingResult.embedding || [];
    } catch (error) {
        console.error('Chat RAG query embedding error:', error);
        return {
            products: [],
            knowledge: []
        };
    }

    const chunks = await ChatRag.listChunksByTypes(['product', 'knowledge']);

    const scoredChunks = chunks
        .map((chunk) => ({
            ...chunk,
            score: scoreChunk(chunk, normalizedQuery, queryEmbedding)
        }))
        .sort((left, right) => right.score - left.score);

    const productMatches = scoredChunks
        .filter((chunk) => chunk.source_type === 'product' && chunk.score >= DEFAULT_PRODUCT_THRESHOLD)
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

    const productResults = await getProductsByRagMatches(productMatches);

    return {
        products: productResults.slice(0, options.productLimit || DEFAULT_PRODUCT_LIMIT),
        knowledge: knowledgeMatches
    };
}

// Đồng bộ chat rag index.
async function syncChatRagIndex() {
    await ensureChatRagReady({
        waitForReady: true,
        waitTimeoutMs: 0
    });
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
