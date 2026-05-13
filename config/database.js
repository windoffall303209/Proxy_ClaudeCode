// PostgreSQL connection pool shared by models, services, and controllers.
// The wrapper keeps the previous driver-style API so existing call sites can still
// destructure query results as [rows] or read result.insertId after INSERT ... RETURNING id.
const { Pool } = require('pg');
require('dotenv').config();

const DEFAULT_PORT = 5432;

const pgPool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'tmdt_ecommerce',
    port: Number.parseInt(process.env.DB_PORT, 10) || DEFAULT_PORT,
    connectionTimeoutMillis: Number.parseInt(process.env.DB_CONNECT_TIMEOUT_MS, 10) || 60000,
    max: Number.parseInt(process.env.DB_POOL_MAX, 10) || 10,
    idleTimeoutMillis: Number.parseInt(process.env.DB_IDLE_TIMEOUT_MS, 10) || 30000,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' } : false
});

function normalizeParams(params = []) {
    return Array.isArray(params)
        ? params.map((value) => (value === undefined ? null : value))
        : [];
}

function stripLeadingComments(sql) {
    return String(sql || '')
        .replace(/^\s*(?:--[^\n]*\n\s*|\/\*[\s\S]*?\*\/\s*)*/g, '')
        .trimStart();
}

function isRowReturningQuery(sql) {
    const normalized = stripLeadingComments(sql).toLowerCase();
    return normalized.startsWith('select') || normalized.startsWith('with') || normalized.startsWith('show');
}

function translatePgError(error) {
    if (!error || typeof error !== 'object') {
        return error;
    }

    const legacyCodeByPgCode = {
        '23505': 'ER_DUP_ENTRY',
        '42P01': 'ER_NO_SUCH_TABLE',
        '42703': 'ER_BAD_FIELD_ERROR',
        '42704': 'ER_BAD_FIELD_ERROR'
    };

    if (legacyCodeByPgCode[error.code]) {
        error.pgCode = error.code;
        error.code = legacyCodeByPgCode[error.code];
    }

    return error;
}

function convertQuestionPlaceholders(sql) {
    let index = 0;
    let output = '';
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let inLineComment = false;
    let inBlockComment = false;

    for (let i = 0; i < sql.length; i += 1) {
        const current = sql[i];
        const next = sql[i + 1];

        if (inLineComment) {
            output += current;
            if (current === '\n') {
                inLineComment = false;
            }
            continue;
        }

        if (inBlockComment) {
            output += current;
            if (current === '*' && next === '/') {
                output += next;
                i += 1;
                inBlockComment = false;
            }
            continue;
        }

        if (inSingleQuote) {
            output += current;
            if (current === "'" && next === "'") {
                output += next;
                i += 1;
                continue;
            }
            if (current === "'") {
                inSingleQuote = false;
            }
            continue;
        }

        if (inDoubleQuote) {
            output += current;
            if (current === '"' && next === '"') {
                output += next;
                i += 1;
                continue;
            }
            if (current === '"') {
                inDoubleQuote = false;
            }
            continue;
        }

        if (current === '-' && next === '-') {
            output += current + next;
            i += 1;
            inLineComment = true;
            continue;
        }

        if (current === '/' && next === '*') {
            output += current + next;
            i += 1;
            inBlockComment = true;
            continue;
        }

        if (current === "'") {
            output += current;
            inSingleQuote = true;
            continue;
        }

        if (current === '"') {
            output += current;
            inDoubleQuote = true;
            continue;
        }

        if (current === '?') {
            index += 1;
            output += `$${index}`;
            continue;
        }

        output += current;
    }

    return output;
}

function prepareSql(sql, params = []) {
    const text = String(sql || '')
        .replace(/\bBINARY\s+LOWER\s*\(/gi, 'LOWER(')
        .replace(/DATE_SUB\s*\(\s*NOW\s*\(\s*\)\s*,\s*INTERVAL\s+(\d+)\s+DAY\s*\)/gi, "(NOW() - INTERVAL '$1 DAY')")
        .replace(/DATE_ADD\s*\(\s*NOW\s*\(\s*\)\s*,\s*INTERVAL\s+(\d+)\s+DAY\s*\)/gi, "(NOW() + INTERVAL '$1 DAY')")
        .replace(/DATE_ADD\s*\(\s*([a-zA-Z_][a-zA-Z0-9_\.]*)\s*,\s*INTERVAL\s+(\d+)\s+HOUR\s*\)/gi, "($1 + INTERVAL '$2 HOUR')")
        .replace(/\bCURDATE\s*\(\s*\)/gi, 'CURRENT_DATE');

    return params.length > 0 ? convertQuestionPlaceholders(text) : text;
}

function toLegacyStyleResult(result, sql) {
    if (isRowReturningQuery(sql)) {
        return [result.rows, result.fields || []];
    }

    return [{
        rowCount: result.rowCount,
        affectedRows: result.rowCount,
        changedRows: result.rowCount,
        insertId: result.rows?.[0]?.id ?? null,
        rows: result.rows
    }, result.fields || []];
}

async function runQuery(executor, sql, params = []) {
    const normalizedParams = normalizeParams(params);
    const preparedSql = prepareSql(sql, normalizedParams);

    try {
        const result = await executor.query(preparedSql, normalizedParams);
        return toLegacyStyleResult(result, sql);
    } catch (error) {
        throw translatePgError(error);
    }
}

async function getConnection() {
    const client = await pgPool.connect();

    return {
        query(sql, params = []) {
            return runQuery(client, sql, params);
        },
        execute(sql, params = []) {
            return runQuery(client, sql, params);
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
}

const shouldProbeConnection =
    process.env.NODE_ENV !== 'test' &&
    process.env.SKIP_DB_CONNECTION_PROBE !== 'true';

if (shouldProbeConnection) {
    pgPool.connect()
        .then((client) => {
            console.log('PostgreSQL database connected successfully');
            client.release();
        })
        .catch((err) => {
            console.error('PostgreSQL database connection failed:', err.message);
        });
}

module.exports = {
    query(sql, params = []) {
        return runQuery(pgPool, sql, params);
    },
    execute(sql, params = []) {
        return runQuery(pgPool, sql, params);
    },
    getConnection,
    end() {
        return pgPool.end();
    },
    rawPool: pgPool,
    formatPlaceholders: convertQuestionPlaceholders
};
