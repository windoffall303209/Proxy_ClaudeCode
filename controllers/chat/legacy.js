const Chat = require('../../models/Chat');
const Product = require('../../models/Product');
const { callGeminiCliAgent } = require('../../services/geminiCliAgentService');

const CHATBOT_SUPPORT_SYSTEM_PROMPT = [
    'Phạm vi chatbot WIND OF FALL:',
    '- Tư vấn sản phẩm, phối đồ, size, màu sắc, chất liệu và gợi ý trang phục.',
    '- Hướng dẫn sử dụng website: tìm sản phẩm, xem chi tiết, thêm giỏ hàng, cập nhật giỏ hàng, checkout, thanh toán COD/VNPay/MoMo, áp voucher, quản lý địa chỉ, xem lịch sử đơn, theo dõi đơn, hủy đơn, xác nhận đã nhận hàng, gửi yêu cầu hoàn hàng và đánh giá sản phẩm.',
    '- Được trả lời các câu hỏi về cách dùng web ngay cả khi không liên quan trực tiếp đến tư vấn trang phục.',
    '- Không bịa thông tin cá nhân, trạng thái đơn hàng, mã vận đơn, số điện thoại, địa chỉ hoặc thông tin thanh toán nếu chưa lấy được từ tool hợp lệ và đúng người dùng.',
    '- Khi khách muốn theo dõi đơn hàng mà không có dữ liệu cụ thể, hướng dẫn vào /orders/history; nếu có mã đơn, hướng dẫn vào /orders/{ma-don}/tracking.',
    '- Khi đưa link nội bộ, dùng markdown link rõ ràng, ví dụ [Lịch sử đơn hàng](/orders/history), [Giỏ hàng](/cart), [Hồ sơ cá nhân](/auth/profile).',
    '- Nếu cần dữ liệu shop/sản phẩm/đơn hàng và tool MCP có sẵn, hãy dùng tool; nếu không có dữ liệu, hướng dẫn thao tác trên website thay vì nói là không thể hỗ trợ.'
].join('\n');

function normalizeMessage(input) {
    return typeof input === 'string' ? input.trim() : '';
}

function resolveGuestName(req) {
    if (req.user?.full_name) {
        return req.user.full_name;
    }

    if (req.user?.email) {
        return req.user.email;
    }

    return 'Khách';
}

function buildChatAttachmentMetadata(mediaItems = []) {
    return mediaItems.map((media, index) => ({
        mediaType: media.mediaType || media.media_type || 'image',
        mediaUrl: media.mediaUrl || media.media_url || '',
        publicId: media.publicId || media.public_id || null,
        mimeType: media.mimeType || media.mime_type || null,
        originalName: media.originalName || media.original_name || null,
        width: Number(media.width) || null,
        height: Number(media.height) || null,
        bytes: Number(media.bytes) || 0,
        format: media.format || null,
        displayOrder: Number.isInteger(Number(media.displayOrder ?? media.display_order))
            ? Number(media.displayOrder ?? media.display_order)
            : index
    })).filter((media) => media.mediaUrl);
}

function buildChatMessageMetadata({ attachments = [] } = {}) {
    const normalizedAttachments = buildChatAttachmentMetadata(attachments);

    if (!normalizedAttachments.length) {
        return null;
    }

    return {
        attachments: normalizedAttachments
    };
}

function buildChatMessageType(messageText, metadata = {}) {
    const hasMessage = Boolean(normalizeMessage(messageText));
    const hasAttachments = Array.isArray(metadata.attachments) && metadata.attachments.length > 0;

    if (hasAttachments) {
        return 'media';
    }

    return hasMessage ? 'text' : 'media';
}

function normalizeChatLookupText(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .toLowerCase()
        .trim();
}

function hasAnyChatPhrase(normalizedMessage, phrases = []) {
    return phrases.some((phrase) => normalizedMessage.includes(phrase));
}

function buildWebSupportFallback(message = '', options = {}) {
    const normalizedMessage = normalizeChatLookupText(message);
    const isAuthenticated = Boolean(options.isAuthenticated);

    if (hasAnyChatPhrase(normalizedMessage, ['theo doi don', 'theo don', 'kiem tra don', 'xem don', 'lich su don', 'don hang cua toi'])) {
        return isAuthenticated
            ? 'Bạn có thể theo dõi đơn hàng tại [Lịch sử đơn hàng](/orders/history). Trong từng đơn, bấm [Theo dõi đơn] để xem trạng thái xử lý, thanh toán và vận chuyển. Nếu bạn có mã đơn cụ thể, hãy gửi mã đơn để mình hướng dẫn đúng trang theo dõi.'
            : 'Bạn cần đăng nhập để xem đơn hàng của mình. Hãy vào [Đăng nhập](/auth/login), sau đó mở [Lịch sử đơn hàng](/orders/history) để theo dõi trạng thái từng đơn.';
    }

    if (hasAnyChatPhrase(normalizedMessage, ['gio hang', 'them vao gio', 'xoa khoi gio', 'cap nhat gio'])) {
        return 'Bạn có thể xem và chỉnh sửa giỏ hàng tại [Giỏ hàng](/cart). Tại đây bạn có thể tăng giảm số lượng, xóa sản phẩm, sau đó chuyển sang thanh toán khi sẵn sàng.';
    }

    if (hasAnyChatPhrase(normalizedMessage, ['thanh toan', 'checkout', 'dat hang', 'mua hang', 'cod', 'vnpay', 'momo'])) {
        return 'Để đặt hàng, bạn thêm sản phẩm vào [Giỏ hàng](/cart), bấm thanh toán, chọn địa chỉ giao hàng và phương thức COD, VNPay hoặc MoMo. Nếu mua một sản phẩm ngay từ trang chi tiết, bạn có thể dùng nút mua ngay nếu sản phẩm hỗ trợ.';
    }

    if (hasAnyChatPhrase(normalizedMessage, ['voucher', 'ma giam', 'giam gia', 'ap ma'])) {
        return 'Ở trang thanh toán, nhập mã voucher vào ô mã giảm giá rồi bấm Áp dụng. Một số voucher có điều kiện đơn tối thiểu hoặc chỉ áp dụng cho một số sản phẩm, nên hãy kiểm tra thông báo sau khi áp mã.';
    }

    if (hasAnyChatPhrase(normalizedMessage, ['doi tra', 'hoan hang', 'tra hang', 'doi size', 'doi mau'])) {
        return 'Nếu đơn đã giao, bạn vào [Lịch sử đơn hàng](/orders/history), chọn đơn cần xử lý, rồi bấm Yêu cầu hoàn hàng nếu đơn đủ điều kiện. Khi gửi yêu cầu, hãy mô tả lý do và đính kèm ảnh/video minh chứng nếu có.';
    }

    if (hasAnyChatPhrase(normalizedMessage, ['tai khoan', 'dang nhap', 'dang ky', 'dia chi', 'ho so', 'profile'])) {
        return isAuthenticated
            ? 'Bạn có thể cập nhật thông tin cá nhân, địa chỉ giao hàng và xem voucher tại [Hồ sơ cá nhân](/auth/profile).'
            : 'Bạn có thể [Đăng nhập](/auth/login) hoặc [Đăng ký](/auth/register) để quản lý hồ sơ, địa chỉ, giỏ hàng và lịch sử đơn hàng.';
    }

    return 'Mình có thể hỗ trợ tư vấn trang phục và hướng dẫn dùng website như tìm sản phẩm, giỏ hàng, thanh toán, voucher, theo dõi đơn hàng, đổi trả và tài khoản. Bạn nói rõ thao tác bạn đang cần mình sẽ hướng dẫn tiếp nhé.';
}

function escapeChatRegExp(value = '') {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isChatListLine(line = '') {
    return /^\s*(?:\d+[.)]|[-*])\s+/.test(line);
}

function isLikelyContinuationLine(line = '') {
    return /^[a-zA-ZÀ-ỹ0-9(]/.test(String(line || '').trim());
}

function shouldJoinChatLines(previousLine = '', currentLine = '') {
    const previous = String(previousLine || '').trim();
    const current = String(currentLine || '').trim();

    if (!previous || !current || isChatListLine(current)) {
        return false;
    }

    if (/[:;,\-–—]$/.test(previous)) {
        return true;
    }

    if (!/[.!?)]$/.test(previous) && isLikelyContinuationLine(current)) {
        return true;
    }

    return false;
}

function normalizeChatbotReplyFormatting(replyText = '') {
    const lines = String(replyText || '')
        .replace(/\r\n/g, '\n')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

    const normalizedLines = [];
    lines.forEach((line) => {
        const previousIndex = normalizedLines.length - 1;
        const previousLine = normalizedLines[previousIndex] || '';

        if (shouldJoinChatLines(previousLine, line)) {
            normalizedLines[previousIndex] = `${previousLine} ${line}`.replace(/\s+/g, ' ').trim();
            return;
        }

        normalizedLines.push(line);
    });

    return normalizedLines.join('\n');
}

function lineAlreadyLinksProduct(line, product) {
    const slug = String(product?.slug || '').trim();
    const name = String(product?.name || '').trim();

    return Boolean(
        (slug && line.includes(`/products/${slug}`))
        || (name && line.includes(`[${name}](`))
    );
}

async function linkProductNamesInReply(replyText = '') {
    const text = normalizeChatbotReplyFormatting(normalizeMessage(replyText));
    if (!text) {
        return text;
    }

    let products = [];
    try {
        products = await Product.getActiveChatCatalog();
    } catch (error) {
        console.error('Chat product hyperlink lookup error:', error.message || error);
        return text;
    }

    const normalizedReply = normalizeChatLookupText(text);
    const candidates = (Array.isArray(products) ? products : [])
        .filter((product) => product?.name && product?.slug)
        .filter((product) => normalizedReply.includes(normalizeChatLookupText(product.name)))
        .sort((left, right) => String(right.name).length - String(left.name).length);

    if (!candidates.length) {
        return text;
    }

    return text.split(/\r?\n/).map((line) => {
        let linkedLine = line;
        candidates.forEach((product) => {
            const name = String(product.name || '').trim();
            if (!name || lineAlreadyLinksProduct(linkedLine, product)) {
                return;
            }

            const pattern = new RegExp(`(^|[^\\]\\[])(${escapeChatRegExp(name)})(?!\\]\\()`, 'iu');
            linkedLine = linkedLine.replace(pattern, `$1[$2](/products/${product.slug})`);
        });

        return linkedLine;
    }).join('\n');
}

async function callChatbot(previousMessages, message, options = {}) {
    const fallbackReply = buildWebSupportFallback(message, options);
    const reply = await callGeminiCliAgent(CHATBOT_SUPPORT_SYSTEM_PROMPT, previousMessages, message, options);

    return linkProductNamesInReply(normalizeMessage(reply) || fallbackReply);
}

exports.sendMessage = async (req, res) => {
    try {
        const message = normalizeMessage(req.body.message);
        const uploadedMedia = Array.isArray(req.uploadedChatMedia) ? req.uploadedChatMedia : [];

        if (!message && !uploadedMedia.length) {
            return res.status(400).json({
                success: false,
                message: 'Tin nhắn hoặc media không được để trống'
            });
        }

        const userId = req.user ? req.user.id : null;
        const conversation = await Chat.findOrCreateConversation(
            userId,
            req.sessionID,
            resolveGuestName(req)
        );
        const previousMessages = await Chat.getMessages(conversation.id, 20);
        const customerMessage = await Chat.addMessage(
            conversation.id,
            'customer',
            userId,
            message,
            {
                messageType: buildChatMessageType(message, { attachments: uploadedMedia }),
                metadata: buildChatMessageMetadata({ attachments: uploadedMedia })
            }
        );

        if (conversation.handling_mode === 'manual') {
            const hasAdminMessage = previousMessages.some((item) => item.sender_type === 'admin');

            return res.json({
                success: true,
                conversationId: conversation.id,
                customerMessage,
                manualMode: true,
                notice: hasAdminMessage
                    ? null
                    : 'Tin nhắn của bạn đã được chuyển cho admin. Vui lòng chờ phản hồi.'
            });
        }

        const botReply = await callChatbot(previousMessages, message, {
            attachments: uploadedMedia,
            sessionKey: conversation.id,
            isAuthenticated: Boolean(req.user)
        });
        const botMessage = await Chat.addMessage(
            conversation.id,
            'bot',
            null,
            botReply,
            {
                messageType: 'text',
                metadata: null
            }
        );

        return res.json({
            success: true,
            conversationId: conversation.id,
            customerMessage,
            botMessage,
            manualMode: false
        });
    } catch (error) {
        console.error('Chat send error:', error);
        return res.status(500).json({ success: false, message: 'Lỗi gửi tin nhắn' });
    }
};

exports.getMessages = async (req, res) => {
    try {
        const userId = req.user ? req.user.id : null;
        const conversation = await Chat.getActiveConversationForCustomer(userId, req.sessionID);

        if (!conversation) {
            return res.json({
                success: true,
                messages: [],
                conversation: null,
                unreadCount: 0
            });
        }

        const messages = await Chat.getMessages(conversation.id, 100);
        await Chat.markAsRead(conversation.id, 'customer');

        return res.json({
            success: true,
            messages,
            conversation: {
                id: conversation.id,
                status: conversation.status,
                handling_mode: conversation.handling_mode
            },
            unreadCount: 0
        });
    } catch (error) {
        console.error('Chat getMessages error:', error);
        return res.status(500).json({ success: false, message: 'Lỗi tải tin nhắn' });
    }
};

exports.getUnreadCount = async (req, res) => {
    try {
        const userId = req.user ? req.user.id : null;
        const count = await Chat.getCustomerUnreadCount(userId, req.sessionID);

        return res.json({ success: true, count });
    } catch (error) {
        console.error('Chat unreadCount error:', error);
        return res.status(500).json({ success: false, count: 0 });
    }
};

exports.adminChatPage = async (req, res) => {
    try {
        const { conversations, total } = await Chat.getAllConversations(1, 50);
        const unreadCount = await Chat.getUnreadCount();

        return res.render('admin/chat', {
            currentPage: 'chat',
            conversations,
            total,
            unreadCount,
            user: req.user
        });
    } catch (error) {
        console.error('Admin chat page error:', error);
        return res.status(500).render('error', {
            message: 'Lỗi tải trang chat',
            user: req.user
        });
    }
};

exports.adminGetMessages = async (req, res) => {
    try {
        const conversationId = req.params.id;
        const conversation = await Chat.getConversationById(conversationId);

        if (!conversation) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy cuộc trò chuyện' });
        }

        const messages = await Chat.getMessages(conversationId, 100);
        await Chat.markAsRead(conversationId, 'admin');

        return res.json({ success: true, messages, conversation });
    } catch (error) {
        console.error('Admin getMessages error:', error);
        return res.status(500).json({ success: false, message: 'Lỗi tải tin nhắn' });
    }
};

exports.adminReply = async (req, res) => {
    try {
        const conversationId = req.params.id;
        const message = normalizeMessage(req.body.message);
        const uploadedMedia = Array.isArray(req.uploadedChatMedia) ? req.uploadedChatMedia : [];

        if (!message && !uploadedMedia.length) {
            return res.status(400).json({
                success: false,
                message: 'Tin nhắn hoặc media không được để trống'
            });
        }

        const conversation = await Chat.getConversationById(conversationId);
        if (!conversation) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy cuộc trò chuyện' });
        }

        if (conversation.status === 'closed') {
            await Chat.reopenConversation(conversationId);
        }

        await Chat.setHandlingMode(conversationId, 'manual');
        const adminMessage = await Chat.addMessage(
            conversationId,
            'admin',
            req.user.id,
            message,
            {
                messageType: buildChatMessageType(message, { attachments: uploadedMedia }),
                metadata: buildChatMessageMetadata({ attachments: uploadedMedia })
            }
        );
        const updatedConversation = await Chat.getConversationById(conversationId);

        return res.json({
            success: true,
            message: adminMessage,
            conversation: updatedConversation
        });
    } catch (error) {
        console.error('Admin reply error:', error);
        return res.status(500).json({ success: false, message: 'Lỗi gửi tin nhắn' });
    }
};

exports.adminCloseConversation = async (req, res) => {
    try {
        const conversation = await Chat.getConversationById(req.params.id);
        if (!conversation) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy cuộc trò chuyện' });
        }

        await Chat.closeConversation(req.params.id);
        return res.json({ success: true, message: 'Đã đóng cuộc trò chuyện' });
    } catch (error) {
        console.error('Admin close conversation error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.adminReopenConversation = async (req, res) => {
    try {
        const conversation = await Chat.getConversationById(req.params.id);
        if (!conversation) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy cuộc trò chuyện' });
        }

        await Chat.reopenConversation(req.params.id);
        return res.json({ success: true, message: 'Đã mở lại cuộc trò chuyện' });
    } catch (error) {
        console.error('Admin reopen conversation error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.adminSetHandlingMode = async (req, res) => {
    try {
        const mode = req.body.mode === 'manual' ? 'manual' : req.body.mode === 'ai' ? 'ai' : null;
        if (!mode) {
            return res.status(400).json({ success: false, message: 'Chế độ xử lý không hợp lệ' });
        }

        const conversation = await Chat.getConversationById(req.params.id);
        if (!conversation) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy cuộc trò chuyện' });
        }

        const updatedConversation = await Chat.setHandlingMode(req.params.id, mode);

        return res.json({
            success: true,
            message: mode === 'manual' ? 'Admin đã tiếp quản cuộc trò chuyện' : 'Đã bật lại chế độ Gemini CLI tự động',
            conversation: updatedConversation
        });
    } catch (error) {
        console.error('Admin set handling mode error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.adminUnreadCount = async (req, res) => {
    try {
        const count = await Chat.getUnreadCount();
        return res.json({ success: true, count });
    } catch (error) {
        console.error('Admin unread count error:', error);
        return res.status(500).json({ success: false, count: 0 });
    }
};

exports.adminGetConversations = async (req, res) => {
    try {
        const { conversations, total } = await Chat.getAllConversations(1, 50);
        const unreadCount = await Chat.getUnreadCount();

        return res.json({
            success: true,
            conversations,
            total,
            unreadCount
        });
    } catch (error) {
        console.error('Admin get conversations error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};
