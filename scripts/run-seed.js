/**
 * Script de tao schema va import seed data cho PostgreSQL.
 * Chay: node scripts/run-seed.js
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const DB_NAME = process.env.DB_NAME || 'tmdt_ecommerce';

function adminPool() {
    return new Pool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_ADMIN_DATABASE || 'postgres',
        port: Number.parseInt(process.env.DB_PORT, 10) || 5432,
        connectionTimeoutMillis: Number.parseInt(process.env.DB_CONNECT_TIMEOUT_MS, 10) || 60000
    });
}

function appPool() {
    return new Pool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '',
        database: DB_NAME,
        port: Number.parseInt(process.env.DB_PORT, 10) || 5432,
        connectionTimeoutMillis: Number.parseInt(process.env.DB_CONNECT_TIMEOUT_MS, 10) || 60000
    });
}

async function ensureDatabase() {
    const pool = adminPool();
    try {
        const { rows } = await pool.query('SELECT 1 FROM pg_database WHERE datname = $1', [DB_NAME]);
        if (rows.length > 0) {
            console.log(`Database ${DB_NAME} da ton tai`);
            return;
        }

        const escapedName = DB_NAME.replace(/"/g, '""');
        await pool.query(`CREATE DATABASE "${escapedName}"`);
        console.log(`Da tao database ${DB_NAME}`);
    } finally {
        await pool.end();
    }
}

async function runSqlFile(pool, relativePath) {
    const sqlPath = path.join(__dirname, '..', relativePath);
    const sql = fs.readFileSync(sqlPath, 'utf8');
    await pool.query(sql);
}

async function runSeed() {
    console.log('Bat dau tao PostgreSQL schema va seed data...\\n');

    await ensureDatabase();

    const pool = appPool();
    try {
        console.log('Dang tao schema...');
        await runSqlFile(pool, 'database/schema.sql');
        console.log('Da tao schema');

        console.log('Dang import seed data...');
        await runSqlFile(pool, 'database/seed.sql');
        console.log('Da import seed data');

        const [{ rows: catCount }, { rows: prodCount }, { rows: userCount }] = await Promise.all([
            pool.query('SELECT COUNT(*)::int AS count FROM categories'),
            pool.query('SELECT COUNT(*)::int AS count FROM products'),
            pool.query('SELECT COUNT(*)::int AS count FROM users')
        ]);

        console.log('\\nTom tat database:');
        console.log(`   - Categories: ${catCount[0].count}`);
        console.log(`   - Products: ${prodCount[0].count}`);
        console.log(`   - Users: ${userCount[0].count}`);
        console.log('\\nSeed hoan tat!');
    } catch (error) {
        console.error('Loi:', error.message);
        throw error;
    } finally {
        await pool.end();
    }
}

runSeed().catch(() => process.exit(1));
