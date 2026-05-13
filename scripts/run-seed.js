/**
 * Create the PostgreSQL database when needed, then run schema and seed data.
 * Run: node scripts/run-seed.js
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

function getConnectionConfig(database) {
    return {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '',
        database,
        port: Number.parseInt(process.env.DB_PORT, 10) || 5432,
        connectionTimeoutMillis: Number.parseInt(process.env.DB_CONNECT_TIMEOUT_MS, 10) || 60000,
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' } : false
    };
}

function quoteIdentifier(identifier) {
    return `"${String(identifier).replace(/"/g, '""')}"`;
}

async function ensureDatabase(dbName) {
    const adminDb = process.env.DB_ADMIN_DATABASE || 'postgres';
    const client = new Client(getConnectionConfig(adminDb));
    await client.connect();

    try {
        const result = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
        if (result.rowCount === 0) {
            console.log(`Database ${dbName} does not exist. Creating...`);
            await client.query(`CREATE DATABASE ${quoteIdentifier(dbName)}`);
            console.log(`Created database ${dbName}`);
        }
    } finally {
        await client.end();
    }
}

async function tableExists(client, tableName) {
    const result = await client.query('SELECT to_regclass($1) AS table_name', [`public.${tableName}`]);
    return Boolean(result.rows[0]?.table_name);
}

async function runSqlFile(client, relativePath) {
    const sqlPath = path.join(__dirname, '..', relativePath);
    const sql = fs.readFileSync(sqlPath, 'utf8');
    await client.query(sql);
}

async function runSeed() {
    const dbName = process.env.DB_NAME || 'tmdt_ecommerce';
    console.log('Starting PostgreSQL seed flow...\n');

    await ensureDatabase(dbName);

    const client = new Client(getConnectionConfig(dbName));
    await client.connect();

    try {
        if (!(await tableExists(client, 'categories'))) {
            console.log('Creating schema...');
            await runSqlFile(client, 'database/schema.sql');
            console.log('Schema created');
        }

        const categoryCount = await client.query('SELECT COUNT(*)::int AS count FROM categories');
        if (categoryCount.rows[0].count === 0) {
            console.log('Importing seed data...');
            await runSqlFile(client, 'database/seed.sql');
            console.log('Seed data imported');
        } else {
            console.log(`Database already has ${categoryCount.rows[0].count} categories; skipping seed.`);
        }

        const [catCount, prodCount, userCount] = await Promise.all([
            client.query('SELECT COUNT(*)::int AS count FROM categories'),
            client.query('SELECT COUNT(*)::int AS count FROM products'),
            client.query('SELECT COUNT(*)::int AS count FROM users')
        ]);

        console.log('\nDatabase summary:');
        console.log(`   - Categories: ${catCount.rows[0].count}`);
        console.log(`   - Products: ${prodCount.rows[0].count}`);
        console.log(`   - Users: ${userCount.rows[0].count}`);
        console.log('\nSeed completed. Refresh http://localhost:3000 to view products.');
    } catch (error) {
        console.error('Seed failed:', error.message);
        console.log('\nManual fallback:');
        console.log(`   psql -U ${process.env.DB_USER || 'postgres'} -d ${dbName} -f database/schema.sql`);
        console.log(`   psql -U ${process.env.DB_USER || 'postgres'} -d ${dbName} -f database/seed.sql`);
        process.exitCode = 1;
    } finally {
        await client.end();
    }
}

runSeed();
