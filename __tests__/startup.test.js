// Kiểm thử tự động cho tests startup.test để giữ ổn định hành vi quan trọng.
process.env.NODE_ENV = 'test';

const app = require('../app');
const { startServer, stopServer } = require('../server');

describe('server startup flow', () => {
    afterEach(async () => {
        await stopServer();
    });

    it('exports an express application instance', () => {
        expect(app).toBeDefined();
        expect(typeof app.use).toBe('function');
        expect(typeof app.set).toBe('function');
    });

    it('starts and stops cleanly without auto-listening on import', async () => {
        const server = await startServer(0);

        expect(server.listening).toBe(true);

        const address = server.address();
        expect(address).toBeTruthy();
        expect(typeof address.port).toBe('number');

        await stopServer();
        expect(server.listening).toBe(false);
    });
});