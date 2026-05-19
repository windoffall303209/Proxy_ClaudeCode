// CSRF defense for state-changing requests.
// The app does not use per-form CSRF tokens, so browser-origin checks are the guard.

const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const TRUSTED_FETCH_SITE_VALUES = new Set(['same-origin', 'same-site', 'none']);

const ALLOWED_ORIGIN_OVERRIDES = (process.env.CSRF_ALLOWED_ORIGINS || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

function normalizeHost(value) {
    return String(value || '').trim().toLowerCase();
}

function getRequestHosts(req) {
    return Array.from(new Set([
        normalizeHost(req.get('host')),
        ...normalizeHost(req.get('x-forwarded-host'))
            .split(',')
            .map((value) => normalizeHost(value))
    ].filter(Boolean)));
}

function getOriginHost(originValue) {
    if (!originValue) {
        return '';
    }

    try {
        return normalizeHost(new URL(originValue).host);
    } catch (error) {
        return '';
    }
}

function isAllowedOrigin(originHost, requestHosts) {
    if (!originHost || !requestHosts.length) {
        return false;
    }

    if (requestHosts.includes(originHost)) {
        return true;
    }

    return ALLOWED_ORIGIN_OVERRIDES.includes(originHost);
}

function getFetchSite(req) {
    return normalizeHost(req.get('sec-fetch-site'));
}

function isTrustedFetchSite(fetchSite) {
    return TRUSTED_FETCH_SITE_VALUES.has(fetchSite);
}

function preferJsonResponse(req) {
    if (req.xhr) {
        return true;
    }

    const accept = String(req.headers.accept || '').toLowerCase();
    if (accept.includes('application/json')) {
        return true;
    }

    const contentType = String(req.headers['content-type'] || '').toLowerCase();
    return contentType.includes('application/json');
}

function rejectRequest(req, res) {
    if (preferJsonResponse(req)) {
        return res.status(403).json({
            success: false,
            message: 'Yeu cau bi tu choi vi khong cung nguon goc.',
            code: 'CSRF_BLOCKED'
        });
    }

    return res.status(403).render('error', {
        message: 'Yêu cầu bị từ chối vì không cùng nguồn gốc.',
        user: req.user || null
    });
}

function sameOrigin(req, res, next) {
    if (!STATE_CHANGING_METHODS.has(req.method)) {
        return next();
    }

    const requestHosts = getRequestHosts(req);
    if (requestHosts.length === 0) {
        return rejectRequest(req, res);
    }

    const originHost = getOriginHost(req.get('origin'));
    if (originHost) {
        if (!isAllowedOrigin(originHost, requestHosts)) {
            return rejectRequest(req, res);
        }
        return next();
    }

    const refererHost = getOriginHost(req.get('referer'));
    if (refererHost) {
        if (!isAllowedOrigin(refererHost, requestHosts)) {
            return rejectRequest(req, res);
        }
        return next();
    }

    const fetchSite = getFetchSite(req);
    if (isTrustedFetchSite(fetchSite)) {
        return next();
    }

    return rejectRequest(req, res);
}

module.exports = {
    sameOrigin
};
