require('dotenv').config();
const app = require('./app');

const PORT = process.env.PORT || 3000;
let server = null;

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

function startServer(port = PORT) {
    if (server && server.listening) {
        return Promise.resolve(server);
    }

    return new Promise((resolve, reject) => {
        const instance = app.listen(port);

        const handleError = (error) => {
            instance.off('listening', handleListening);
            reject(error);
        };

        const handleListening = () => {
            instance.off('error', handleError);
            server = instance;

            const address = server.address();
            const listeningPort = typeof address === 'object' && address ? address.port : port;

            console.log(formatStartupMessage(listeningPort));
            resolve(server);
        };

        instance.once('error', handleError);
        instance.once('listening', handleListening);
    });
}

function stopServer() {
    if (!server) {
        return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
        server.close((error) => {
            if (error) {
                return reject(error);
            }

            server = null;
            resolve();
        });
    });
}

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