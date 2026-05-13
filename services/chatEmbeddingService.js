// Service gom logic chatembeddingservice để controller không phải lặp xử lý nghiệp vụ.
function resolveEmbeddingModel() {
    const explicitModel = String(process.env.OPENAI_EMBEDDING_MODEL || '').trim();
    if (explicitModel) {
        return explicitModel;
    }

    const baseUrl = String(process.env.OPENAI_BASE_URL || '').trim().toLowerCase();
    if (baseUrl.includes('integrate.api.nvidia.com')) {
        return 'nvidia/nv-embedqa-e5-v5';
    }

    return 'text-embedding-3-small';
}

// Kiểm tra use asymmetric input type.
function shouldUseAsymmetricInputType(modelName = '') {
    const normalized = String(modelName || '').toLowerCase();
    return normalized.includes('embedqa') || normalized.includes('e5');
}

// Lấy embedding timeout ms.
function getEmbeddingTimeoutMs() {
    return Math.max(3000, Number.parseInt(process.env.EMBEDDING_FETCH_TIMEOUT_MS, 10) || 8000);
}

// Xử lý estimate token count.
function estimateTokenCount(value = '') {
    const normalized = String(value || '').trim();
    if (!normalized) {
        return 0;
    }

    const approxByChars = Math.ceil(normalized.length / 4);
    const regexTokens = normalized.match(/[\p{L}\p{N}_]+|[^\s]/gu)?.length || 0;

    // NVIDIA E5-style tokenizers are notably harsher on Vietnamese content.
    // Use a conservative heuristic so RAG chunking stays well below provider limits.
    return Math.max(approxByChars, Math.ceil(regexTokens * 1.6));
}

// Tải với timeout.
async function fetchWithTimeout(url, options = {}, timeoutMs = getEmbeddingTimeoutMs()) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
        controller.abort();
    }, timeoutMs);

    timeoutId.unref?.();

    try {
        return await fetch(url, {
            ...options,
            signal: controller.signal
        });
    } catch (error) {
        if (error?.name === 'AbortError') {
            throw new Error(`Embedding request timed out after ${timeoutMs}ms`);
        }

        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
}

// Xử lý read json response safely.
async function readJsonResponseSafely(response, label) {
    if (typeof response?.text !== 'function') {
        const data = typeof response?.json === 'function' ? await response.json() : null;
        return {
            data,
            rawText: data ? JSON.stringify(data) : ''
        };
    }

    const rawText = await response.text();

    if (!rawText) {
        return {
            data: null,
            rawText: ''
        };
    }

    try {
        return {
            data: JSON.parse(rawText),
            rawText
        };
    } catch (error) {
        const preview = rawText.slice(0, 300);
        throw new Error(`${label} returned invalid JSON (${response.status}): ${preview}`);
    }
}

// Tạo embedding.
async function createEmbeddings(inputs, options = {}) {
    const normalizedInputs = Array.isArray(inputs)
        ? inputs.map((item) => String(item || '').trim()).filter(Boolean)
        : [String(inputs || '').trim()].filter(Boolean);

    if (!normalizedInputs.length) {
        return [];
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        throw new Error('OPENAI_API_KEY is required for embeddings.');
    }

    const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
    const model = options.model || resolveEmbeddingModel();
    const inputType = options.inputType || 'query';
    const body = {
        model,
        input: normalizedInputs
    };

    if (shouldUseAsymmetricInputType(model)) {
        body.input_type = inputType;
    }

    const response = await fetchWithTimeout(`${baseUrl}/embeddings`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(body)
    });

    const { data, rawText } = await readJsonResponseSafely(response, 'Embedding API');
    if (!response.ok) {
        throw new Error(`Embedding API error ${response.status}: ${rawText || 'Empty response body'}`);
    }

    if (!data || !Array.isArray(data.data)) {
        throw new Error('Embedding API error: empty or malformed success response.');
    }

    return (data.data || []).map((item) => ({
        index: item.index,
        embedding: Array.isArray(item.embedding) ? item.embedding.map(Number) : [],
        model: data.model || model
    }));
}

// Tạo embedding.
async function createEmbedding(input, options = {}) {
    const results = await createEmbeddings([input], options);
    return results[0] || { embedding: [], model: options.model || resolveEmbeddingModel() };
}

module.exports = {
    createEmbedding,
    createEmbeddings,
    estimateTokenCount,
    resolveEmbeddingModel
};
