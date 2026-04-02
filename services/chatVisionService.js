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
        if (start === -1 || end === -1 || end <= start) {
            return null;
        }

        try {
            return JSON.parse(value.slice(start, end + 1));
        } catch (nestedError) {
            return null;
        }
    }
}

function normalizeVisionResult(result) {
    if (!result || typeof result !== 'object') {
        return null;
    }

    const description = String(result.description || result.summary || '').trim();
    const searchQuery = String(result.searchQuery || result.query || '').trim();
    const matchSummary = String(result.matchSummary || result.replyLead || '').trim();

    if (!description && !searchQuery && !matchSummary) {
        return null;
    }

    return {
        description,
        searchQuery,
        matchSummary
    };
}

function buildVisionPrompt(userMessage = '') {
    const userHint = String(userMessage || '').trim();
    const extraHint = userHint
        ? `Khách mô tả thêm: ${userHint}\n`
        : '';

    return [
        'Bạn là stylist của cửa hàng thời trang WIND OF FALL.',
        'Hãy nhìn ảnh sản phẩm và suy ra món đồ thời trang trong ảnh để tìm sản phẩm tương đồng trong catalog.',
        extraHint,
        'Trả về đúng 1 JSON object hợp lệ, không markdown, không giải thích thêm.',
        'Schema:',
        '{"description":"mô tả ngắn bằng tiếng Việt","searchQuery":"cụm từ tìm kiếm tiếng Việt ngắn 4-10 từ","matchSummary":"1 câu ngắn để chatbot phản hồi với khách"}',
        'Quy tắc:',
        '- Tập trung vào loại trang phục, màu sắc, form dáng, phong cách, đối tượng nếu đủ rõ.',
        '- Không suy diễn quá mức về thương hiệu hay chất liệu nếu ảnh không chắc chắn.',
        '- searchQuery phải đủ ngắn để dùng làm từ khóa tìm kiếm sản phẩm.',
        '- matchSummary phải là 1 câu ngắn, ví dụ: "Dựa trên ảnh bạn gửi, mình thấy đây khá giống một mẫu áo thun basic sáng màu."'
    ].join('\n');
}

function isLikelyVisionModel(modelName = '') {
    const normalized = String(modelName || '').trim().toLowerCase();
    if (!normalized) {
        return false;
    }

    return [
        'vision',
        'vl',
        'multimodal',
        'paligemma',
        'kosmos',
        'fuyu',
        'neva',
        'vila'
    ].some((token) => normalized.includes(token));
}

function resolveOpenAIVisionModel() {
    const explicitVisionModel = String(process.env.OPENAI_VISION_MODEL || '').trim();
    if (explicitVisionModel) {
        return explicitVisionModel;
    }

    const textModel = String(process.env.OPENAI_MODEL || '').trim();
    if (isLikelyVisionModel(textModel)) {
        return textModel;
    }

    const baseUrl = String(process.env.OPENAI_BASE_URL || '').trim().toLowerCase();
    if (baseUrl.includes('integrate.api.nvidia.com')) {
        return 'meta/llama-3.2-90b-vision-instruct';
    }

    return 'gpt-4o-mini';
}

async function analyzeImageWithOpenAI(media, userMessage = '') {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || !media?.mediaUrl) {
        return null;
    }

    const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
    const model = resolveOpenAIVisionModel();
    const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model,
            temperature: 0.2,
            max_tokens: 240,
            messages: [
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: buildVisionPrompt(userMessage) },
                        {
                            type: 'image_url',
                            image_url: {
                                url: media.mediaUrl,
                                detail: 'low'
                            }
                        }
                    ]
                }
            ]
        })
    });

    const data = await response.json();
    if (!response.ok) {
        console.error(`OpenAI chat vision error (${model}):`, response.status, JSON.stringify(data));
        return null;
    }

    return normalizeVisionResult(extractJsonObject(data.choices?.[0]?.message?.content || ''));
}

async function fetchImageAsBase64(mediaUrl) {
    const response = await fetch(mediaUrl);
    if (!response.ok) {
        throw new Error(`Cannot fetch media: ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const buffer = Buffer.from(await response.arrayBuffer());

    return {
        mimeType: contentType.split(';')[0] || 'image/jpeg',
        data: buffer.toString('base64')
    };
}

async function analyzeImageWithGemini(media, userMessage = '') {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || !media?.mediaUrl) {
        return null;
    }

    const model = process.env.GEMINI_VISION_MODEL || process.env.GEMINI_MODEL || 'gemini-2.0-flash';
    const imagePayload = await fetchImageAsBase64(media.mediaUrl);
    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [
                    {
                        role: 'user',
                        parts: [
                            { text: buildVisionPrompt(userMessage) },
                            {
                                inline_data: {
                                    mime_type: imagePayload.mimeType,
                                    data: imagePayload.data
                                }
                            }
                        ]
                    }
                ],
                generationConfig: {
                    temperature: 0.2,
                    maxOutputTokens: 240
                }
            })
        }
    );

    const data = await response.json();
    if (!response.ok) {
        console.error('Gemini chat vision error:', response.status, JSON.stringify(data));
        return null;
    }

    const rawText = data.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('\n') || '';
    return normalizeVisionResult(extractJsonObject(rawText));
}

async function describeProductFromImage(media, userMessage = '') {
    if (!media || media.mediaType !== 'image') {
        return null;
    }

    const provider = process.env.AI_PROVIDER || 'openai';
    const hasOpenAI = Boolean(process.env.OPENAI_API_KEY);
    const hasGemini = Boolean(process.env.GEMINI_API_KEY);

    try {
        if (provider === 'gemini' && hasGemini) {
            const geminiResult = await analyzeImageWithGemini(media, userMessage);
            if (geminiResult) {
                return geminiResult;
            }

            if (hasOpenAI) {
                return await analyzeImageWithOpenAI(media, userMessage);
            }

            return null;
        }

        if (hasOpenAI) {
            const openAIResult = await analyzeImageWithOpenAI(media, userMessage);
            if (openAIResult) {
                return openAIResult;
            }
        }

        if (hasGemini) {
            return await analyzeImageWithGemini(media, userMessage);
        }

        return null;
    } catch (error) {
        console.error('Chat image analysis error:', error);
        return null;
    }
}

module.exports = {
    describeProductFromImage
};
