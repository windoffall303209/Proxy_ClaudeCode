const { Pool, types } = require('pg');
require('dotenv').config();

const DEFAULT_DATABASE = 'tmdt_ecommerce';

types.setTypeParser(20, (value) => Number(value));

function buildPoolConfig() {
    const sslEnabled = String(process.env.DB_SSL || '').toLowerCase() === 'true';
    const baseConfig = process.env.DATABASE_URL
        ? { connectionString: process.env.DATABASE_URL }
        : {
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || DEFAULT_DATABASE,
            port: Number.parseInt(process.env.DB_PORT, 10) || 5432
        };

    return {
        ...baseConfig,
        max: Number.parseInt(process.env.DB_POOL_MAX, 10) || 10,
        connectionTimeoutMillis: Number.parseInt(process.env.DB_CONNECT_TIMEOUT_MS, 10) || 60000,
        idleTimeoutMillis: Number.parseInt(process.env.DB_IDLE_TIMEOUT_MS, 10) || 30000,
        ssl: sslEnabled ? { rejectUnauthorized: false } : undefined
    };
}

function replaceQuestionPlaceholders(sql, params = []) {
    if (!params.length || !sql.includes('?')) {
        return sql;
    }

    let index = 0;
    let output = '';
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let inLineComment = false;
    let inBlockComment = false;

    for (let i = 0; i < sql.length; i += 1) {
        const char = sql[i];
        const next = sql[i + 1];

        if (inLineComment) {
            output += char;
            if (char === '\n') inLineComment = false;
            continue;
        }

        if (inBlockComment) {
            output += char;
            if (char === '*' && next === '/') {
                output += next;
                i += 1;
                inBlockComment = false;
            }
            continue;
        }

        if (!inSingleQuote && !inDoubleQuote && char === '-' && next === '-') {
            output += char + next;
            i += 1;
            inLineComment = true;
            continue;
        }

        if (!inSingleQuote && !inDoubleQuote && char === '/' && next === '*') {
            output += char + next;
            i += 1;
            inBlockComment = true;
            continue;
        }

        if (!inDoubleQuote && char === "'") {
            output += char;
            if (inSingleQuote && next === "'") {
                output += next;
                i += 1;
            } else {
                inSingleQuote = !inSingleQuote;
            }
            continue;
        }

        if (!inSingleQuote && char === '"') {
            output += char;
            inDoubleQuote = !inDoubleQuote;
            continue;
        }

        if (!inSingleQuote && !inDoubleQuote && char === '?') {
            index += 1;
            output += `$${index}`;
            continue;
        }

        output += char;
    }

    return output;
}

function normalizeSql(sql, params = []) {
    let normalized = String(sql)
        .replace(/DATE_ADD\s*\(\s*NOW\(\)\s*,\s*INTERVAL\s+(\d+)\s+DAY\s*\)/gi, "(NOW() + INTERVAL '$1 day')")
        .replace(/DATE_SUB\s*\(\s*NOW\(\)\s*,\s*INTERVAL\s+(\d+)\s+DAY\s*\)/gi, "(NOW() - INTERVAL '$1 day')")
        .replace(/DATE_ADD\s*\(\s*NOW\(\)\s*,\s*INTERVAL\s+(\d+)\s+HOUR\s*\)/gi, "(NOW() + INTERVAL '$1 hour')")
        .replace(/DATE_SUB\s*\(\s*NOW\(\)\s*,\s*INTERVAL\s+(\d+)\s+HOUR\s*\)/gi, "(NOW() - INTERVAL '$1 hour')");

    normalized = replaceQuestionPlaceholders(normalized, params);

    if (/^\s*INSERT\s+/i.test(normalized) && !/\bRETURNING\b/i.test(normalized)) {
        normalized = normalized.replace(/;?\s*$/, ' RETURNING *');
    }

    return normalized;
}

function normalizeError(error) {
    if (!error || typeof error !== 'object') {
        return error;
    }

    const pgToMysqlCode = {
        '23505': 'ER_DUP_ENTRY',
        '42P01': 'ER_NO_SUCH_TABLE',
        '42703': 'ER_BAD_FIELD_ERROR'
    };

    if (pgToMysqlCode[error.code]) {
        error.pgCode = error.code;
        error.code = pgToMysqlCode[error.code];
    }

    return error;
}

async function run(client, sql, params = []) {
    const values = Array.isArray(params) ? params : [];
    const text = normalizeSql(sql, values);

    try {
        const queryResult = await client.query(text, values);
        const result = Array.isArray(queryResult) ? queryResult[queryResult.length - 1] : queryResult;
        const meta = {
            affectedRows: result.rowCount || 0,
            changedRows: result.rowCount || 0,
            insertId: result.rows?.[0]?.id
        };

        if (['SELECT', 'SHOW'].includes(result.command)) {
            return [result.rows, result.fields || []];
        }

        return [meta, result.fields || []];
    } catch (error) {
        throw normalizeError(error);
    }
}

const pgPool = new Pool(buildPoolConfig());

const pool = {
    execute(sql, params = []) {
        return run(pgPool, sql, params);
    },

    query(sql, params = []) {
        return run(pgPool, sql, params);
    },

    async getConnection() {
        const client = await pgPool.connect();
        return {
            execute(sql, params = []) {
                return run(client, sql, params);
            },
            query(sql, params = []) {
                return run(client, sql, params);
            },
            beginTransaction() {
                return client.query('BEGIN');
            },
            commit() {
                return client.query('COMMIT');
            },
            rollback() {
                return client.query('ROLLBACK');
            },
            release() {
                client.release();
            }
        };
    },

    end() {
        return pgPool.end();
    }
};

const shouldProbeConnection =
    process.env.NODE_ENV !== 'test' &&
    process.env.SKIP_DB_CONNECTION_PROBE !== 'true';

if (shouldProbeConnection) {
    pool.getConnection()
        .then(connection => {
            console.log('PostgreSQL database connected successfully');
            connection.release();
        })
        .catch(err => {
            console.error('PostgreSQL database connection failed:', err.message);
        });
}

module.exports = pool;
