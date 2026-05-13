// Kiểm thử tự động cho tests appsecurityheaders.test để giữ ổn định hành vi quan trọng.
process.env.NODE_ENV = 'test';

jest.mock('../middleware/auth', () => ({
    optionalAuth: jest.fn((req, res, next) => next())
}));

jest.mock('../middleware/headerCategories', () => jest.fn((req, res, next) => next()));

jest.mock('../middleware/storefrontSettings', () => ({
    storefrontSettings: jest.fn((req, res, next) => next())
}));

jest.mock('../routes', () => {
    const express = require('express');
    const router = express.Router();

    router.get('/health', (req, res) => {
        res.status(200).send('ok');
    });

    return router;
});

const { createApp } = require('../app');

describe('app security headers', () => {
    it('allows form redirects to VNPay domains in CSP', async () => {
        const app = createApp();
        const server = await new Promise((resolve) => {
            const instance = app.listen(0, () => resolve(instance));
        });

        try {
            const address = server.address();
            const response = await fetch(`http://127.0.0.1:${address.port}/health`);
            const cspHeader = response.headers.get('content-security-policy');

            expect(cspHeader).toContain("form-action 'self' https://sandbox.vnpayment.vn https://pay.vnpay.vn");
        } finally {
            await new Promise((resolve, reject) => {
                server.close((error) => {
                    if (error) {
                        reject(error);
                        return;
                    }

                    resolve();
                });
            });
        }
    });
});
