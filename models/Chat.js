const pool = require('../config/database');

class Chat {
    static getLastMessagePreviewSql(conversationAlias = 'cc') {
        return `(
                    SELECT COALESCE(
                        NULLIF(TRIM(cm.message), ''),
                        CASE
                            WHEN cm.message_type = 'media' THEN '[Da gui media]'
                            WHEN cm.message_type = 'product_cards' THEN '[Goi y san pham]'
                            ELSE '[Tin nhan]'
                        END
                    )
                    FROM chat_messages cm
                    WHERE cm.conversation_id = ${conversationAlias}.id
                    ORDER BY cm.id DESC
                    LIMIT 1
                )`;
    }

    static parseMessageMetadata(rawValue) {
        if (!rawValue) {
            return null;
        }

        if (typeof rawValue === 'object') {
            return rawValue;
        }

        try {
            return JSON.parse(rawValue);
        } catch (error) {
            return null;
        }
    }

    static serializeMessageMetadata(metadata) {
        if (!metadata || typeof metadata !== 'object') {
            return null;
        }

        const hasProducts = Array.isArray(metadata.products) && metadata.products.length > 0;
        const hasAttachments = Array.isArray(metadata.attachments) && metadata.attachments.length > 0;

        if (!hasProducts && !hasAttachments) {
            return null;
        }

        return JSON.stringify(metadata);
    }

    static hydrateMessage(message) {
        if (!message || typeof message !== 'object') {
            return message;
        }

        return {
            ...message,
            message_type: message.message_type || 'text',
            message_metadata: this.parseMessageMetadata(message.message_metadata)
        };
    }

    static hydrateMessages(messages = []) {
        return messages.map((message) => this.hydrateMessage(message));
    }

    static buildCustomerScope(userId, sessionId, alias = 'cc') {
        if (userId) {
            return {
                where: `${alias}.user_id = ?`,
                params: [userId]
            };
        }

        return {
            where: `${alias}.session_id = ? AND ${alias}.user_id IS NULL`,
            params: [sessionId]
        };
    }

    static async getActiveConversationForCustomer(userId, sessionId) {
        const scope = this.buildCustomerScope(userId, sessionId);
        const [rows] = await pool.execute(
            `SELECT cc.*,
                    u.full_name AS user_name,
                    u.email AS user_email,
                    u.avatar_url AS user_avatar,
                    (
                        SELECT COUNT(*)
                        FROM chat_messages cm
                        WHERE cm.conversation_id = cc.id
                          AND cm.sender_type IN ('admin', 'bot')
                          AND cm.is_read = FALSE
                    ) AS unread_count,
                    ${this.getLastMessagePreviewSql('cc')} AS last_message,
                    (
                        SELECT sender_type
                        FROM chat_messages
                        WHERE conversation_id = cc.id
                        ORDER BY id DESC
                        LIMIT 1
                    ) AS last_sender
             FROM chat_conversations cc
             LEFT JOIN users u ON cc.user_id = u.id
             WHERE ${scope.where} AND cc.status = 'active'
             ORDER BY cc.updated_at DESC
             LIMIT 1`,
            scope.params
        );

        return rows[0] || null;
    }

    static async findOrCreateConversation(userId, sessionId, guestName = 'Khach') {
        const existingConversation = await this.getActiveConversationForCustomer(userId, sessionId);
        if (existingConversation) {
            return existingConversation;
        }

        const [result] = await pool.execute(
            'INSERT INTO chat_conversations (user_id, session_id, guest_name, status, handling_mode) VALUES (?, ?, ?, "active", "ai")',
            [userId || null, sessionId || null, guestName]
        );

        return this.getConversationById(result.insertId);
    }

    static async getConversationById(conversationId) {
        const [rows] = await pool.execute(
            `SELECT cc.*,
                    u.full_name AS user_name,
                    u.email AS user_email,
                    u.avatar_url AS user_avatar,
                    (
                        SELECT COUNT(*)
                        FROM chat_messages cm
                        WHERE cm.conversation_id = cc.id
                          AND cm.sender_type = 'customer'
                          AND cm.is_read = FALSE
                    ) AS unread_count,
                    ${this.getLastMessagePreviewSql('cc')} AS last_message,
                    (
                        SELECT sender_type
                        FROM chat_messages
                        WHERE conversation_id = cc.id
                        ORDER BY id DESC
                        LIMIT 1
                    ) AS last_sender
             FROM chat_conversations cc
             LEFT JOIN users u ON cc.user_id = u.id
             WHERE cc.id = ?`,
            [conversationId]
        );

        return rows[0] || null;
    }

    static async getMessages(conversationId, limit = 50) {
        const safeLimit = Math.max(1, parseInt(limit, 10) || 50);
        const [rows] = await pool.execute(
            `SELECT *
             FROM (
                 SELECT cm.*,
                        u.full_name AS sender_name,
                        u.avatar_url AS sender_avatar
                 FROM chat_messages cm
                 LEFT JOIN users u ON cm.sender_id = u.id
                 WHERE cm.conversation_id = ?
                 ORDER BY cm.id DESC
                 LIMIT ${safeLimit}
             ) recent_messages
             ORDER BY recent_messages.id ASC`,
            [conversationId]
        );

        return this.hydrateMessages(rows);
    }

    static async addMessage(conversationId, senderType, senderId, message, options = {}) {
        const safeMessage = typeof message === 'string' ? message : '';
        const messageType = options.messageType || 'text';
        const messageMetadata = this.serializeMessageMetadata(options.metadata);
        const [result] = await pool.execute(
            `INSERT INTO chat_messages (conversation_id, sender_type, sender_id, message, message_type, message_metadata)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [conversationId, senderType, senderId || null, safeMessage, messageType, messageMetadata]
        );

        await pool.execute(
            'UPDATE chat_conversations SET last_message_at = NOW(), updated_at = NOW() WHERE id = ?',
            [conversationId]
        );

        const [rows] = await pool.execute(
            `SELECT cm.*,
                    u.full_name AS sender_name,
                    u.avatar_url AS sender_avatar
             FROM chat_messages cm
             LEFT JOIN users u ON cm.sender_id = u.id
             WHERE cm.id = ?`,
            [result.insertId]
        );

        return this.hydrateMessage(rows[0] || null);
    }

    static async markAsRead(conversationId, readerType) {
        const senderCondition = readerType === 'admin'
            ? "sender_type = 'customer'"
            : "sender_type IN ('admin', 'bot')";

        await pool.execute(
            `UPDATE chat_messages
             SET is_read = TRUE
             WHERE conversation_id = ?
               AND ${senderCondition}
               AND is_read = FALSE`,
            [conversationId]
        );
    }

    static async getAllConversations(page = 1, limit = 20) {
        const safePage = Math.max(1, parseInt(page, 10) || 1);
        const safeLimit = Math.max(1, parseInt(limit, 10) || 20);
        const offset = (safePage - 1) * safeLimit;

        const [rows] = await pool.execute(
            `SELECT cc.*,
                    u.full_name AS user_name,
                    u.email AS user_email,
                    u.avatar_url AS user_avatar,
                    ${this.getLastMessagePreviewSql('cc')} AS last_message,
                    (
                        SELECT sender_type
                        FROM chat_messages
                        WHERE conversation_id = cc.id
                        ORDER BY id DESC
                        LIMIT 1
                    ) AS last_sender,
                    (
                        SELECT id
                        FROM chat_messages
                        WHERE conversation_id = cc.id
                        ORDER BY id DESC
                        LIMIT 1
                    ) AS last_message_id,
                    (
                        SELECT COUNT(*)
                        FROM chat_messages
                        WHERE conversation_id = cc.id
                          AND sender_type = 'customer'
                          AND is_read = FALSE
                    ) AS unread_count
             FROM chat_conversations cc
             LEFT JOIN users u ON cc.user_id = u.id
             ORDER BY cc.last_message_at DESC, cc.id DESC
             LIMIT ${safeLimit} OFFSET ${offset}`
        );

        const [countResult] = await pool.execute('SELECT COUNT(*) AS total FROM chat_conversations');

        return {
            conversations: rows,
            total: countResult[0].total
        };
    }

    static async getUnreadCount() {
        const [rows] = await pool.execute(
            `SELECT COUNT(DISTINCT cm.conversation_id) AS count
             FROM chat_messages cm
             JOIN chat_conversations cc ON cm.conversation_id = cc.id
             WHERE cm.sender_type = 'customer'
               AND cm.is_read = FALSE
               AND cc.status = 'active'`
        );

        return rows[0].count;
    }

    static async getCustomerUnreadCount(userId, sessionId) {
        const scope = this.buildCustomerScope(userId, sessionId, 'cc');
        const [rows] = await pool.execute(
            `SELECT COUNT(*) AS count
             FROM chat_messages cm
             JOIN chat_conversations cc ON cm.conversation_id = cc.id
             WHERE ${scope.where}
               AND cc.status = 'active'
               AND cm.sender_type IN ('admin', 'bot')
               AND cm.is_read = FALSE`,
            scope.params
        );

        return rows[0].count;
    }

    static async setHandlingMode(conversationId, mode) {
        await pool.execute(
            'UPDATE chat_conversations SET handling_mode = ?, updated_at = NOW() WHERE id = ?',
            [mode, conversationId]
        );

        return this.getConversationById(conversationId);
    }

    static async closeConversation(conversationId) {
        await pool.execute(
            'UPDATE chat_conversations SET status = "closed", updated_at = NOW() WHERE id = ?',
            [conversationId]
        );
    }

    static async reopenConversation(conversationId) {
        await pool.execute(
            'UPDATE chat_conversations SET status = "active", updated_at = NOW() WHERE id = ?',
            [conversationId]
        );
    }
}

module.exports = Chat;
