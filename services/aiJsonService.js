const { getGeminiRuntimeKey, getOpenAiRuntimeKey } = require('./runtimeApiKeyService');

function extractJsonObject(rawValue) {
    const value = typeof rawValue === 'string' ? rawValue.trim() : '';
    if (!value) {
        return null;
    }

    try {
        return JSON.parse(value);
    } catch (error) {
        const start = value.indexOf('{');
        const end = value.lastIndexOf('}');
        if (start < 0 || end <= start) {
            return null;
        }

        try {
            return JSON.parse(value.slice(start, end + 1));
        } catch (nestedError) {
            return null;
        }
    }
}

function getAiTimeoutMs() {
    return Math.max(3000, Number.parseInt(process.env.AI_JSON_TIMEOUT_MS, 10) || 12000);
}

async function fetchWithTimeout(url, options = {}, timeoutMs = getAiTimeoutMs()) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    timeoutId.unref?.();

    try {
        return await fetch(url, {
            ...options,
            signal: controller.signal
        });
    } catch (error) {
        if (error?.name === 'AbortError') {
            throw new Error(`AI JSON request timed out after ${timeoutMs}ms`);
        }
        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
}

function resolveOpenAiModel() {
    return String(process.env.OPENAI_MODEL || 'gpt-4o-mini').trim() || 'gpt-4o-mini';
}

function resolveGeminiModel() {
    return String(process.env.GEMINI_MODEL || 'gemini-2.0-flash').trim() || 'gemini-2.0-flash';
}

async function generateJsonWithOpenAI({ systemPrompt, userPrompt }) {
    const apiKey = process.env.OPENAI_API_KEY || await getOpenAiRuntimeKey().catch(() => '');
    if (!apiKey) {
        return null;
    }

    const baseUrl = String(process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
    const model = resolveOpenAiModel();
    const response = await fetchWithTimeout(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model,
            temperature: 0.2,
            response_format: { type: 'json_object' },
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ]
        })
    });

    const rawText = await response.text();
    let data = null;
    if (rawText) {
        data = JSON.parse(rawText);
    }

    if (!response.ok) {
        const message = data?.error?.message || rawText || `HTTP ${response.status}`;
        throw new Error(`OpenAI JSON error: ${message}`);
    }

    return {
        data: extractJsonObject(data?.choices?.[0]?.message?.content || ''),
        model: data?.model || model
    };
}

async function generateJsonWithGemini({ systemPrompt, userPrompt }) {
    const apiKey = process.env.GEMINI_API_KEY || await getGeminiRuntimeKey().catch(() => '');
    if (!apiKey) {
        return null;
    }

    const model = resolveGeminiModel();
    const response = await fetchWithTimeout(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [
                    {
                        role: 'user',
                        parts: [
                            { text: `${systemPrompt}\n\n${userPrompt}` }
                        ]
                    }
                ],
                generationConfig: {
                    temperature: 0.2,
                    responseMimeType: 'application/json'
                }
            })
        }
    );

    const rawText = await response.text();
    let data = null;
    if (rawText) {
        data = JSON.parse(rawText);
    }

    if (!response.ok) {
        const message = data?.error?.message || rawText || `HTTP ${response.status}`;
        throw new Error(`Gemini JSON error: ${message}`);
    }

    const reply = data?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('\n') || '';
    return {
        data: extractJsonObject(reply),
        model
    };
}

function shouldUseAiJson() {
    return String(process.env.AI_AUTOMATION_ENABLED || 'true').trim().toLowerCase() !== 'false';
}

async function generateJson({ systemPrompt, userPrompt, fallback, validate }) {
    const fallbackValue = typeof fallback === 'function' ? fallback() : fallback;

    if (!shouldUseAiJson()) {
        return { data: fallbackValue, model: 'local-rule', usedAi: false };
    }

    const provider = String(process.env.AI_PROVIDER || 'openai').trim().toLowerCase();
    const attempts = provider === 'gemini'
        ? [generateJsonWithGemini, generateJsonWithOpenAI]
        : [generateJsonWithOpenAI, generateJsonWithGemini];

    for (const attempt of attempts) {
        try {
            const result = await attempt({ systemPrompt, userPrompt });
            if (!result?.data) {
                continue;
            }

            const normalized = typeof validate === 'function'
                ? validate(result.data, fallbackValue)
                : result.data;

            return {
                data: normalized || fallbackValue,
                model: result.model || 'ai',
                usedAi: true
            };
        } catch (error) {
            console.error('AI JSON generation skipped:', error.message || error);
        }
    }

    return { data: fallbackValue, model: 'local-rule', usedAi: false };
}

module.exports = {
    extractJsonObject,
    generateJson
};
