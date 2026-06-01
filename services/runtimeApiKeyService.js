const ApiKeySetting = require('../models/ApiKeySetting');

async function getGeminiRuntimeKey() {
    const geminiCliKey = await ApiKeySetting.getActiveValue('gemini_cli', 'GEMINI_API_KEY');
    return geminiCliKey || await ApiKeySetting.getActiveValue('google_ai', 'GEMINI_API_KEY');
}

async function getOpenAiRuntimeKey() {
    return ApiKeySetting.getActiveValue('openai_compatible', 'OPENAI_API_KEY');
}

async function getGeminiCliRuntimeEnv() {
    try {
        const googleAiKey = await getGeminiRuntimeKey();

        return googleAiKey ? { GEMINI_API_KEY: googleAiKey } : {};
    } catch (error) {
        console.error('Runtime API key lookup error:', error.message || error);
        return {};
    }
}

module.exports = {
    getGeminiRuntimeKey,
    getOpenAiRuntimeKey,
    getGeminiCliRuntimeEnv
};
