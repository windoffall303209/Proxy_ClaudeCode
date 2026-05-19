// Nạp cấu hình môi trường và khởi động HTTP server cho Express app.
require('dotenv').config();
const app = require('./app');
const User = require('./models/User');

const PORT = process.env.PORT || 3000;
const ACCOUNT_PURGE_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 tiếng
let server = null;
let accountPurgeTimer = null;

// Anonymize tài khoản đã hết cửa sổ khôi phục 14 ngày để giảm rò rỉ PII.
async function runAccountPurgeOnce() {
    try {
        const result = await User.purgeExpiredDeletedAccounts();
        if (result.purgedCount > 0) {
            console.log(`Account purge: anonymized ${result.purgedCount} expired accounts.`);
        }
    } catch (error) {
        console.error('Account purge job error:', error.message || error);
    }
}

function startAccountPurgeJob() {
    if (accountPurgeTimer) {
        return;
    }

    // Chạy lần đầu sau 1 phút để không chặn startup; sau đó định kỳ.
    setTimeout(runAccountPurgeOnce, 60 * 1000).unref?.();
    accountPurgeTimer = setInterval(runAccountPurgeOnce, ACCOUNT_PURGE_INTERVAL_MS);
    accountPurgeTimer.unref?.();
}

function stopAccountPurgeJob() {
    if (accountPurgeTimer) {
        clearInterval(accountPurgeTimer);
        accountPurgeTimer = null;
    }
}

// Định dạng startup tin nhắn.
function formatStartupMessage(port) {
    const emailConfigured = Boolean(process.env.RESEND_API_KEY);
    const environment = process.env.NODE_ENV || 'development';

    return [
        'Fashion Store E-commerce Server',
        `Server running on port ${port}`,
        `Environment: ${environment}`,
        `Local: http://localhost:${port}`,
        `Email (Resend): ${emailConfigured ? 'configured' : 'not configured'}`,
        'Payment: VNPay, MoMo, COD'
    ].join('\n');
}

// Xử lý start server.
function startServer(port = PORT) {
    if (server && server.listening) {
        return Promise.resolve(server);
    }

    return new Promise((resolve, reject) => {
        const instance = app.listen(port);

        // Xử lý error.
        const handleError = (error) => {
            instance.off('listening', handleListening);
            reject(error);
        };

        // Xử lý listening.
        const handleListening = () => {
            instance.off('error', handleError);
            server = instance;

            const address = server.address();
            const listeningPort = typeof address === 'object' && address ? address.port : port;

            console.log(formatStartupMessage(listeningPort));
            startAccountPurgeJob();
            resolve(server);
        };

        instance.once('error', handleError);
        instance.once('listening', handleListening);
    });
}

// Xử lý stop server.
function stopServer() {
    if (!server) {
        stopAccountPurgeJob();
        return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
        server.close((error) => {
            if (error) {
                return reject(error);
            }

            stopAccountPurgeJob();
            server = null;
            resolve();
        });
    });
}

// Xử lý shutdown.
async function shutdown(signal) {
    console.log(`${signal} received. Shutting down gracefully...`);

    try {
        await stopServer();
        console.log('Server closed');
        process.exit(0);
    } catch (error) {
        console.error('Graceful shutdown failed:', error);
        process.exit(1);
    }
}

process.once('SIGTERM', () => {
    shutdown('SIGTERM');
});

process.once('SIGINT', () => {
    shutdown('SIGINT');
});

if (require.main === module) {
    startServer().catch((error) => {
        console.error('Server failed to start:', error);
        process.exit(1);
    });
}

module.exports = {
    app,
    startServer,
    stopServer
};