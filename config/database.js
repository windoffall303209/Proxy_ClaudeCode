// Tạo pool kết nối MySQL dùng chung cho model, service và controller.
const mysql = require('mysql2/promise');
require('dotenv').config();

// Tạo connection pool để tái sử dụng kết nối MySQL giữa các request.
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

// Bỏ probe kết nối trong test để app có thể import mà không cần database thật.
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
