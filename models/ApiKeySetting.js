const crypto = require('crypto');
const pool = require('../config/database');

const TABLE_SQL = `
CREATE TABLE IF NOT EXISTS api_key_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    provider VARCHAR(50) NOT NULL,
    key_name VARCHAR(100) NOT NULL,
    encrypted_value TEXT NULL,
    masked_value VARCHAR(80) NOT NULL DEFAULT '',
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    notes VARCHAR(255) NULL,
    updated_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_api_key_provider_name (provider, key_name),
    INDEX idx_api_key_settings_active (provider, key_name, is_active)
) ENGINE=InnoDB`;

const ENCRYPTION_PREFIX = 'enc:v1:';
let ensureTablePromise = null;

function getEncryptionSecret() {
    return process.env.API_KEY_ENCRYPTION_SECRET
        || process.env.JWT_SECRET
        || process.env.SESSION_SECRET
        || process.env.DB_PASSWORD
        || 'wind-of-fall-local-api-key-secret';
}

function getEncryptionKey() {
    return crypto
        .createHash('sha256')
        .update(`${getEncryptionSecret()}|api-key-settings`)
        .digest();
}

function encryptValue(value) {
    const text = String(value || '').trim();
    if (!text) {
        return '';
    }

    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    return `${ENCRYPTION_PREFIX}${Buffer.concat([iv, tag, encrypted]).toString('base64')}`;
}

function decryptValue(value) {
    const text = String(value || '');
    if (!text) {
        return '';
    }

    if (!text.startsWith(ENCRYPTION_PREFIX)) {
        return text;
    }

    const payload = Buffer.from(text.slice(ENCRYPTION_PREFIX.length), 'base64');
    const iv = payload.subarray(0, 12);
    const tag = payload.subarray(12, 28);
    const encrypted = payload.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

function normalizeProvider(provider) {
    const value = String(provider || '').trim().toLowerCase();
    const safeValue = value.replace(/[^a-z0-9_:-]/g, '').slice(0, 50);
    const allowed = ApiKeySetting.getProviderOptions().map((item) => item.value);
    return allowed.includes(safeValue) ? safeValue : 'gemini_cli';
}

function getKeyNameForProvider(provider) {
    const normalizedProvider = normalizeProvider(provider);
    if (normalizedProvider === 'openai_compatible') {
        return 'OPENAI_API_KEY';
    }
    return 'GEMINI_API_KEY';
}

function normalizeKeyName(keyName) {
    const value = String(keyName || '').trim().toUpperCase();
    return value.replace(/[^A-Z0-9_]/g, '').slice(0, 100) || 'GEMINI_API_KEY';
}

function maskValue(value) {
    const text = String(value || '').trim();
    if (!text) {
        return '';
    }

    if (text.length <= 8) {
        return `${text.slice(0, 2)}...${text.slice(-2)}`;
    }

    return `${text.slice(0, 6)}...${text.slice(-4)}`;
}

function isActiveInput(value) {
    return value === true || value === 'true' || value === 'on' || value === '1' || value === 1;
}

async function ensureTable() {
    if (!ensureTablePromise) {
        ensureTablePromise = pool.execute(TABLE_SQL).catch((error) => {
            ensureTablePromise = null;
            throw error;
        });
    }

    await ensureTablePromise;
}

class ApiKeySetting {
    static getProviderOptions() {
        return [
            { value: 'gemini_cli', label: 'Gemini CLI' },
            { value: 'google_ai', label: 'Google AI Studio' },
            { value: 'openai_compatible', label: 'OpenAI compatible' }
        ];
    }

    static getKeyNameForProvider(provider) {
        return getKeyNameForProvider(provider);
    }

    static maskValue(value) {
        return maskValue(value);
    }

    static async list() {
        await ensureTable();
        const [rows] = await pool.execute(
            `SELECT id, provider, key_name, masked_value, is_active, updated_by, created_at, updated_at
             FROM api_key_settings
             ORDER BY provider ASC, key_name ASC`
        );
        return rows;
    }

    static async upsert(data = {}, userId = null) {
        await ensureTable();
        const provider = normalizeProvider(data.provider);
        const keyName = getKeyNameForProvider(provider);
        const rawValue = String(data.key_value || '').trim();
        const isActive = isActiveInput(data.is_active);

        if (!rawValue) {
            throw new Error('Vui long nhap API key.');
        }

        await pool.execute(
            `INSERT INTO api_key_settings
                (provider, key_name, encrypted_value, masked_value, is_active, notes, updated_by)
             VALUES (?, ?, ?, ?, ?, NULL, ?)
             ON DUPLICATE KEY UPDATE
                encrypted_value = VALUES(encrypted_value),
                masked_value = VALUES(masked_value),
                is_active = VALUES(is_active),
                notes = NULL,
                updated_by = VALUES(updated_by)`,
            [provider, keyName, encryptValue(rawValue), maskValue(rawValue), isActive ? 1 : 0, userId || null]
        );
    }

    static async update(id, data = {}, userId = null) {
        await ensureTable();
        const numericId = Number.parseInt(id, 10);
        if (!Number.isInteger(numericId) || numericId <= 0) {
            throw new Error('API key khong hop le.');
        }

        const provider = normalizeProvider(data.provider);
        const keyName = getKeyNameForProvider(provider);
        const rawValue = String(data.key_value || '').trim();
        const isActive = isActiveInput(data.is_active);

        if (rawValue) {
            await pool.execute(
                `UPDATE api_key_settings
                 SET provider = ?, key_name = ?, encrypted_value = ?, masked_value = ?, is_active = ?, notes = NULL, updated_by = ?
                 WHERE id = ?`,
                [provider, keyName, encryptValue(rawValue), maskValue(rawValue), isActive ? 1 : 0, userId || null, numericId]
            );
            return;
        }

        await pool.execute(
            `UPDATE api_key_settings
             SET provider = ?, key_name = ?, is_active = ?, notes = NULL, updated_by = ?
             WHERE id = ?`,
            [provider, keyName, isActive ? 1 : 0, userId || null, numericId]
        );
    }

    static async setActive(id, isActive, userId = null) {
        await ensureTable();
        const numericId = Number.parseInt(id, 10);
        if (!Number.isInteger(numericId) || numericId <= 0) {
            throw new Error('API key khong hop le.');
        }

        await pool.execute(
            'UPDATE api_key_settings SET is_active = ?, updated_by = ? WHERE id = ?',
            [isActive ? 1 : 0, userId || null, numericId]
        );
    }

    static async delete(id) {
        await ensureTable();
        const numericId = Number.parseInt(id, 10);
        if (!Number.isInteger(numericId) || numericId <= 0) {
            throw new Error('API key khong hop le.');
        }

        await pool.execute('DELETE FROM api_key_settings WHERE id = ?', [numericId]);
    }

    static async findById(id, options = {}) {
        await ensureTable();
        const numericId = Number.parseInt(id, 10);
        if (!Number.isInteger(numericId) || numericId <= 0) {
            return null;
        }

        const [rows] = await pool.execute(
            `SELECT id, provider, key_name, encrypted_value, masked_value, is_active, updated_by, created_at, updated_at
             FROM api_key_settings
             WHERE id = ?
             LIMIT 1`,
            [numericId]
        );
        const row = rows[0] || null;
        if (!row || !options.includeValue) {
            return row;
        }

        return {
            ...row,
            key_value: decryptValue(row.encrypted_value)
        };
    }

    static async getActiveValue(provider, keyName) {
        await ensureTable();
        const [rows] = await pool.execute(
            `SELECT encrypted_value
             FROM api_key_settings
             WHERE provider = ? AND key_name = ? AND is_active = 1
             LIMIT 1`,
            [normalizeProvider(provider), normalizeKeyName(keyName)]
        );

        if (!rows.length) {
            return '';
        }

        return decryptValue(rows[0].encrypted_value);
    }
}

module.exports = ApiKeySetting;
