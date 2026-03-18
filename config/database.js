const mysql = require('mysql2/promise');
require('dotenv').config();

// Create connection pool
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'tmdt_ecommerce',
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
});

const shouldProbeConnection =
    process.env.NODE_ENV !== 'test' &&
    process.env.SKIP_DB_CONNECTION_PROBE !== 'true';

// Skip eager connection probes in tests so the app can be imported safely.
if (shouldProbeConnection) {
    pool.getConnection()
        .then(connection => {
            console.log('Database connected successfully');
            connection.release();
        })
        .catch(err => {
            console.error('Database connection failed:', err.message);
        });
}

module.exports = pool;