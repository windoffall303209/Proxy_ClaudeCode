const legacy = require('./legacy');

// Xu ly cac endpoint chat phia admin.
module.exports = {
    adminChatPage: legacy.adminChatPage,
    adminGetMessages: legacy.adminGetMessages,
    adminReply: legacy.adminReply,
    adminCloseConversation: legacy.adminCloseConversation,
    adminReopenConversation: legacy.adminReopenConversation,
    adminSetHandlingMode: legacy.adminSetHandlingMode,
    adminUnreadCount: legacy.adminUnreadCount,
    adminGetConversations: legacy.adminGetConversations
};
