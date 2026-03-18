const Chat = require('../models/Chat');
const Product = require('../models/Product');

async function getSystemPrompt() {
    let productContext = '';

    try {
        const bestSellers = await Product.getBestSellers(5);
        if (bestSellers && bestSellers.length > 0) {
            productContext = '\n\nDanh sách sản phẩm hiện có:\n' + bestSellers
                .map((product) => `- ${product.name}: ${Number(product.price).toLocaleString('vi-VN')}đ (Còn ${product.stock_quantity} sản phẩm)`)
                .join('\n');
        }
    } catch (error) {
        console.error('Lỗi lấy dữ liệu sản phẩm cho AI chat:', error);
    }

    return `Bạn là trợ lý bán hàng AI của cửa hàng thời trang "WIND OF FALL".
Nhiệm vụ: tư vấn sản phẩm, hỗ trợ mua hàng và giải đáp các câu hỏi cơ bản về đơn hàng.

Quy tắc:
- Trả lời bằng tiếng Việt, thân thiện, ngắn gọn, tối đa 3-4 câu
- Không bịa thông tin về giá, tồn kho, chính sách hay khuyến mãi
- Nếu khách cần hỗ trợ sâu hơn, hãy nói rõ rằng admin sẽ hỗ trợ thêm
- Chỉ tư vấn dựa trên thông tin có trong ngữ cảnh

Thông tin cửa hàng:
- Chuyên thời trang nam nữ
- Hỗ trợ thanh toán: COD, VNPay, MoMo
- Giao hàng toàn quốc
- Website: windoffall3k32k9.online${productContext}`;
}

async function callOpenAI(systemPrompt, messages, userMessage) {
    const apiKey = process.env.OPENAI_API_KEY;
    const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';

    const chatMessages = [{ role: 'system', content: systemPrompt }];
    const recentMessages = messages.slice(-10);

    recentMessages.forEach((message) => {
        if (message.sender_type === 'customer') {
            chatMessages.push({ role: 'user', content: message.message });
            return;
        }

        if (message.sender_type === 'bot' || message.sender_type === 'admin') {
            chatMessages.push({ role: 'assistant', content: message.message });
        }
    });

    chatMessages.push({ role: 'user', content: userMessage });

    const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
            messages: chatMessages,
            max_tokens: 300,
            temperature: 0.7
        })
    });

    const data = await response.json();
    if (!response.ok) {
        console.error('OpenAI API error:', response.status, JSON.stringify(data));
        return null;
    }

    return data.choices?.[0]?.message?.content || null;
}

async function callGemini(systemPrompt, messages, userMessage) {
    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
    const contents = [];
    const recentMessages = messages.slice(-10);

    recentMessages.forEach((message) => {
        if (message.sender_type === 'customer') {
            contents.push({ role: 'user', parts: [{ text: message.message }] });
            return;
        }

        if (message.sender_type === 'bot' || message.sender_type === 'admin') {
            contents.push({ role: 'model', parts: [{ text: message.message }] });
        }
    });

    contents.push({ role: 'user', parts: [{ text: userMessage }] });

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                system_instruction: { parts: [{ text: systemPrompt }] },
                contents,
                generationConfig: {
                    maxOutputTokens: 300,
                    temperature: 0.7
                }
            })
        }
    );

    const data = await response.json();
    if (!response.ok) {
        console.error('Gemini API error:', response.status, JSON.stringify(data));
        return null;
    }

    return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
}

async function callAI(messages, userMessage) {
    const provider = process.env.AI_PROVIDER || 'openai';
    const hasOpenAI = Boolean(process.env.OPENAI_API_KEY);
    const hasGemini = Boolean(process.env.GEMINI_API_KEY);

    if (!hasOpenAI && !hasGemini) {
        return 'Xin lỗi, hệ thống AI đang tạm bảo trì. Admin sẽ hỗ trợ bạn sớm nhất có thể.';
    }

    try {
        const systemPrompt = await getSystemPrompt();

        if (provider === 'gemini' && hasGemini) {
            const geminiResult = await callGemini(systemPrompt, messages, userMessage);
            if (geminiResult) {
                return geminiResult;
            }

            if (hasOpenAI) {
                const fallback = await callOpenAI(systemPrompt, messages, userMessage);
                if (fallback) {
                    return fallback;
                }
            }
        } else if (hasOpenAI) {
            const openAIResult = await callOpenAI(systemPrompt, messages, userMessage);
            if (openAIResult) {
                return openAIResult;
            }

            if (hasGemini) {
                const fallback = await callGemini(systemPrompt, messages, userMessage);
                if (fallback) {
                    return fallback;
                }
            }
        }

        return 'Xin lỗi, tôi chưa thể xử lý yêu cầu này lúc này. Admin sẽ hỗ trợ bạn thêm.';
    } catch (error) {
        console.error('AI API error:', error);
        return 'Xin lỗi, hệ thống đang bận. Admin sẽ hỗ trợ bạn thêm trong ít phút nữa.';
    }
}

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

exports.sendMessage = async (req, res) => {
    try {
        const message = normalizeMessage(req.body.message);
        if (!message) {
            return res.status(400).json({ success: false, message: 'Tin nhắn không được để trống' });
        }

        const userId = req.user ? req.user.id : null;
        const sessionId = req.sessionID;
        const guestName = resolveGuestName(req);

        const conversation = await Chat.findOrCreateConversation(userId, sessionId, guestName);
        const previousMessages = await Chat.getMessages(conversation.id, 20);
        const customerMessage = await Chat.addMessage(conversation.id, 'customer', userId, message);

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

        const aiResponse = await callAI(previousMessages, message);
        const botMessage = await Chat.addMessage(conversation.id, 'bot', null, aiResponse);

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
        const sessionId = req.sessionID;
        const conversation = await Chat.getActiveConversationForCustomer(userId, sessionId);

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
        const sessionId = req.sessionID;
        const count = await Chat.getCustomerUnreadCount(userId, sessionId);

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

        if (!message) {
            return res.status(400).json({ success: false, message: 'Tin nhắn không được để trống' });
        }

        const conversation = await Chat.getConversationById(conversationId);
        if (!conversation) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy cuộc trò chuyện' });
        }

        if (conversation.status === 'closed') {
            await Chat.reopenConversation(conversationId);
        }

        await Chat.setHandlingMode(conversationId, 'manual');
        const adminMessage = await Chat.addMessage(conversationId, 'admin', req.user.id, message);
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
            message: mode === 'manual' ? 'Admin đã tiếp quản cuộc trò chuyện' : 'Đã bật lại chế độ AI tự động',
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
