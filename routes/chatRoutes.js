const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { verifyToken, isAdmin } = require('../middleware/auth');
const { handleChatMediaUpload } = require('../middleware/chatUpload');

// Customer endpoints
router.post('/send', handleChatMediaUpload, chatController.sendMessage);
router.get('/messages', chatController.getMessages);
router.get('/unread-count', chatController.getUnreadCount);

// Admin endpoints
router.get('/admin', verifyToken, isAdmin, chatController.adminChatPage);
router.get('/admin/unread-count', verifyToken, isAdmin, chatController.adminUnreadCount);
router.get('/admin/conversations', verifyToken, isAdmin, chatController.adminGetConversations);
router.get('/admin/:id/messages', verifyToken, isAdmin, chatController.adminGetMessages);
router.post('/admin/:id/reply', verifyToken, isAdmin, handleChatMediaUpload, chatController.adminReply);
router.put('/admin/:id/mode', verifyToken, isAdmin, chatController.adminSetHandlingMode);
router.put('/admin/:id/close', verifyToken, isAdmin, chatController.adminCloseConversation);
router.put('/admin/:id/reopen', verifyToken, isAdmin, chatController.adminReopenConversation);

module.exports = router;
