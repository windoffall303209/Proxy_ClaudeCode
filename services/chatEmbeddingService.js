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

function shouldUseAsymmetricInputType(modelName = '') {
    const normalized = String(modelName || '').toLowerCase();
    return normalized.includes('embedqa') || normalized.includes('e5');
}

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

    const response = await fetch(`${baseUrl}/embeddings`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(body)
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(`Embedding API error ${response.status}: ${JSON.stringify(data)}`);
    }

    return (data.data || []).map((item) => ({
        index: item.index,
        embedding: Array.isArray(item.embedding) ? item.embedding.map(Number) : [],
        model: data.model || model
    }));
}

async function createEmbedding(input, options = {}) {
    const results = await createEmbeddings([input], options);
    return results[0] || { embedding: [], model: options.model || resolveEmbeddingModel() };
}

module.exports = {
    createEmbedding,
    createEmbeddings,
    resolveEmbeddingModel
};
