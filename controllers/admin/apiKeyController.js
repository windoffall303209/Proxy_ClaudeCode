const ApiKeySetting = require('../../models/ApiKeySetting');
const { testApiKeyConnection } = require('../../services/apiKeyConnectionService');

function buildAdminNoticeRedirect(path, message, type = 'success') {
    const separator = path.includes('?') ? '&' : '?';
    const params = new URLSearchParams();
    params.set('notice', message);
    params.set('notice_type', type);
    return `${path}${separator}${params.toString()}`;
}

function redirectApiKeySettings(message, type = 'success') {
    return buildAdminNoticeRedirect('/admin/storefront?section=api_keys', message, type);
}

async function getApiKeys(req, res) {
    res.redirect('/admin/storefront?section=api_keys');
}

async function createApiKey(req, res) {
    try {
        await ApiKeySetting.upsert(req.body, req.user?.id || null);
        res.redirect(redirectApiKeySettings('Đã lưu API key.'));
    } catch (error) {
        res.redirect(redirectApiKeySettings(error.message || 'Không thể lưu API key.', 'error'));
    }
}

async function toggleApiKeyStatus(req, res) {
    try {
        await ApiKeySetting.setActive(req.params.id, req.body?.is_active, req.user?.id || null);
        res.json({ success: true });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message || 'Khong the cap nhat trang thai API key.'
        });
    }
}

async function testApiKey(req, res) {
    try {
        let provider = req.body?.provider;
        let keyValue = String(req.body?.key_value || '').trim();

        if (!keyValue && req.body?.id) {
            const existing = await ApiKeySetting.findById(req.body.id, { includeValue: true });
            if (!existing) {
                return res.status(404).json({ success: false, valid: false, message: 'InValid' });
            }
            provider = existing.provider;
            keyValue = existing.key_value;
        }

        const result = await testApiKeyConnection(provider, keyValue);
        res.json({
            success: true,
            ...result
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            valid: false,
            status: 'invalid',
            message: 'InValid'
        });
    }
}

async function updateApiKey(req, res) {
    try {
        await ApiKeySetting.update(req.params.id, req.body, req.user?.id || null);
        res.redirect(redirectApiKeySettings('Đã cập nhật API key.'));
    } catch (error) {
        res.redirect(redirectApiKeySettings(error.message || 'Không thể cập nhật API key.', 'error'));
    }
}

async function deleteApiKey(req, res) {
    try {
        await ApiKeySetting.delete(req.params.id);
        res.redirect(redirectApiKeySettings('Đã xóa API key.'));
    } catch (error) {
        res.redirect(redirectApiKeySettings(error.message || 'Không thể xóa API key.', 'error'));
    }
}

module.exports = {
    getApiKeys,
    createApiKey,
    updateApiKey,
    deleteApiKey,
    toggleApiKeyStatus,
    testApiKey
};
