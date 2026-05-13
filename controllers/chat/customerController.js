const legacy = require('./legacy');

// Xu ly cac endpoint chat phia khach hang.
module.exports = {
    sendMessage: legacy.sendMessage,
    getMessages: legacy.getMessages,
    getUnreadCount: legacy.getUnreadCount
};
