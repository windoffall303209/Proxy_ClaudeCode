const ApiKeySetting = require('../models/ApiKeySetting');

function getTimeoutMs() {
    return Math.max(3000, Number.parseInt(process.env.API_KEY_TEST_TIMEOUT_MS, 10) || 10000);
}

async function fetchWithTimeout(url, options = {}, timeoutMs = getTimeoutMs()) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    timeoutId.unref?.();

    try {
        return await fetch(url, {
            ...options,
            signal: controller.signal
        });
    } finally {
        clearTimeout(timeoutId);
    }
}

async function testGeminiKey(apiKey) {
    const response = await fetchWithTimeout(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
        { method: 'GET' }
    );

    return response.ok;
}

async function testOpenAiKey(apiKey) {
    const baseUrl = String(process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
    const response = await fetchWithTimeout(`${baseUrl}/models`, {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${apiKey}`
        }
    });

    return response.ok;
}

async function testApiKeyConnection(provider, apiKey) {
    const safeKey = String(apiKey || '').trim();
    if (!safeKey) {
        return {
            valid: false,
            status: 'invalid',
            message: 'InValid'
        };
    }

    try {
        const keyName = ApiKeySetting.getKeyNameForProvider(provider);
        const valid = keyName === 'OPENAI_API_KEY'
            ? await testOpenAiKey(safeKey)
            : await testGeminiKey(safeKey);

        return {
            valid,
            status: valid ? 'valid' : 'invalid',
            message: valid ? 'Valid' : 'InValid'
        };
    } catch (error) {
        return {
            valid: false,
            status: 'invalid',
            message: 'InValid'
        };
    }
}

module.exports = {
    testApiKeyConnection
};
