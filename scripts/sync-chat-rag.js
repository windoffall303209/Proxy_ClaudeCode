require('dotenv').config();

const { syncChatRagIndex } = require('../services/chatRagService');

(async () => {
    try {
        const result = await syncChatRagIndex();
        console.log('Chat RAG index synced');
        console.log(JSON.stringify(result, null, 2));
        process.exit(0);
    } catch (error) {
        console.error('Chat RAG sync failed:', error);
        process.exit(1);
    }
})();
