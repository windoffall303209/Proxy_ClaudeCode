// Nạp cấu hình storefront toàn cục để view có layout, theme và nội dung động.
const StorefrontSetting = require('../models/StorefrontSetting');

const SETTINGS_CACHE_TTL_MS = 30 * 1000;

let cachedSettings = null;
let cacheExpiresAt = 0;
let pendingLoad = null;

// Nạp storefront settings.
async function loadStorefrontSettings() {
    const now = Date.now();
    if (cachedSettings && now < cacheExpiresAt) {
        return cachedSettings;
    }

    if (!pendingLoad) {
        pendingLoad = StorefrontSetting.getAll()
            .then((settings) => {
                cachedSettings = settings;
                cacheExpiresAt = Date.now() + SETTINGS_CACHE_TTL_MS;
                return cachedSettings;
            })
            .finally(() => {
                pendingLoad = null;
            });
    }

    return pendingLoad;
}

// Xử lý invalidate storefront settings cache.
function invalidateStorefrontSettingsCache() {
    cachedSettings = null;
    cacheExpiresAt = 0;
    pendingLoad = null;
}

function shouldBypassMaintenance(req) {
    const path = req.path || req.originalUrl || '';
    return path.startsWith('/admin')
        || path.startsWith('/orders/payment/')
        || path === '/favicon.ico';
}

// Xử lý storefront settings.
async function storefrontSettings(req, res, next) {
    let activeSettings = null;

    try {
        const settings = await loadStorefrontSettings();
        activeSettings = settings;
        req.storefrontSettings = settings;
        res.locals.storefrontSettings = settings;
    } catch (error) {
        console.error('Storefront settings middleware error:', error);
        const fallbackSettings = StorefrontSetting.getDefaultSettings();
        activeSettings = fallbackSettings;
        req.storefrontSettings = fallbackSettings;
        res.locals.storefrontSettings = fallbackSettings;
    }

    if (activeSettings?.maintenance_mode === true && !shouldBypassMaintenance(req)) {
        res.set('Retry-After', '3600');
        res.set('Cache-Control', 'no-store');
        return res.status(503).render('maintenance', {
            settings: activeSettings,
            user: req.user || null
        });
    }

    next();
}

module.exports = {
    storefrontSettings,
    invalidateStorefrontSettingsCache
};
