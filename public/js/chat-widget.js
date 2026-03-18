const chatState = window.__tmdtChatWidgetState || (window.__tmdtChatWidgetState = {
    open: false,
    loaded: false,
    pollInterval: null,
    pollErrors: 0,
    renderedMessageIds: new Set(),
    conversation: null,
    initialized: false,
    badgeRequest: null
});

const CHAT_LINK_PATTERN = /((?:https?:\/\/|www\.)[^\s<]+|\/(?:products|cart|checkout|chat|auth|admin|orders)[^\s<]*)/gi;

function getChatElements() {
    return {
        box: document.getElementById('chatBox'),
        toggleButton: document.getElementById('chatToggleBtn'),
        badge: document.getElementById('chatBadge'),
        messages: document.getElementById('chatMessages'),
        input: document.getElementById('chatInput'),
        sendButton: document.getElementById('chatSendBtn')
    };
}

function updateChatBadge(count) {
    const { badge } = getChatElements();
    if (!badge) {
        return;
    }

    if (!count || count <= 0 || chatState.open) {
        badge.hidden = true;
        badge.textContent = '0';
        return;
    }

    badge.hidden = false;
    badge.textContent = String(count);
}

function isChatPageVisible() {
    return document.visibilityState !== 'hidden';
}

function runChatTaskWhenIdle(callback, fallbackDelay = 300) {
    if (typeof callback !== 'function') {
        return;
    }

    if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(() => callback(), { timeout: 1500 });
        return;
    }

    window.setTimeout(callback, fallbackDelay);
}

async function refreshChatBadge() {
    if (chatState.open) {
        updateChatBadge(0);
        return;
    }

    if (!isChatPageVisible()) {
        return;
    }

    if (chatState.badgeRequest) {
        return chatState.badgeRequest;
    }

    chatState.badgeRequest = (async () => {
        try {
            const response = await fetch('/chat/unread-count', { credentials: 'same-origin' });
            if (!response.ok) {
                return;
            }

            const data = await response.json();
            if (data.success) {
                updateChatBadge(data.count || 0);
            }
        } catch (error) {
            console.error('Refresh chat badge error:', error);
        } finally {
            chatState.badgeRequest = null;
        }
    })();

    return chatState.badgeRequest;
}

function formatChatTime(date) {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
}

function scrollToBottom() {
    const { messages } = getChatElements();
    if (!messages) {
        return;
    }

    setTimeout(() => {
        messages.scrollTop = messages.scrollHeight;
    }, 50);
}

function buildMessageLabel(type) {
    if (type === 'admin') {
        return 'Admin';
    }

    if (type === 'bot') {
        return 'Trợ lý AI';
    }

    if (type === 'system') {
        return 'Hệ thống';
    }

    return '';
}

function normalizeChatLink(rawValue) {
    if (!rawValue) {
        return null;
    }

    let value = rawValue;
    let trailing = '';

    while (/[),.!?:;]$/.test(value)) {
        trailing = value.slice(-1) + trailing;
        value = value.slice(0, -1);
    }

    if (!value) {
        return null;
    }

    const href = value.startsWith('www.') ? `https://${value}` : value;
    return { href, text: value, trailing };
}

function appendLinkedText(container, text) {
    const value = typeof text === 'string' ? text : '';
    const lines = value.split(/\r?\n/);

    lines.forEach((line, lineIndex) => {
        let lastIndex = 0;

        line.replace(CHAT_LINK_PATTERN, (match, _group, offset) => {
            if (offset > lastIndex) {
                container.appendChild(document.createTextNode(line.slice(lastIndex, offset)));
            }

            const normalized = normalizeChatLink(match);
            if (!normalized) {
                container.appendChild(document.createTextNode(match));
            } else {
                const link = document.createElement('a');
                link.href = normalized.href;
                link.textContent = normalized.text;
                link.target = normalized.href.startsWith('/') ? '_self' : '_blank';
                if (link.target === '_blank') {
                    link.rel = 'noopener noreferrer';
                }
                container.appendChild(link);

                if (normalized.trailing) {
                    container.appendChild(document.createTextNode(normalized.trailing));
                }
            }

            lastIndex = offset + match.length;
            return match;
        });

        if (lastIndex < line.length) {
            container.appendChild(document.createTextNode(line.slice(lastIndex)));
        }

        if (lineIndex < lines.length - 1) {
            container.appendChild(document.createElement('br'));
        }
    });
}

function appendMessage(type, text, time, options = {}) {
    const { messages } = getChatElements();
    if (!messages) {
        return;
    }

    if (options.messageId && chatState.renderedMessageIds.has(options.messageId)) {
        return;
    }

    if (options.messageId) {
        chatState.renderedMessageIds.add(options.messageId);
    }

    const wrapper = document.createElement('div');
    wrapper.className = `chat-msg chat-msg--${type}`;
    if (options.messageId) {
        wrapper.dataset.messageId = String(options.messageId);
    }

    const labelText = options.label || buildMessageLabel(type);
    if (labelText) {
        const label = document.createElement('div');
        label.className = 'chat-msg__label';
        label.textContent = labelText;
        wrapper.appendChild(label);
    }

    const messageText = document.createElement('div');
    messageText.className = 'chat-msg__content';
    appendLinkedText(messageText, text);
    wrapper.appendChild(messageText);

    const timeElement = document.createElement('div');
    timeElement.className = 'chat-msg__time';
    timeElement.textContent = time ? formatChatTime(new Date(time)) : formatChatTime(new Date());
    wrapper.appendChild(timeElement);

    messages.appendChild(wrapper);
    scrollToBottom();
}

function appendMessageRecord(message) {
    if (!message || message.sender_type === 'customer' && chatState.renderedMessageIds.has(message.id)) {
        return;
    }

    appendMessage(message.sender_type, message.message, message.created_at, {
        messageId: message.id
    });
}

function showTyping() {
    hideTyping();

    const { messages } = getChatElements();
    if (!messages) {
        return;
    }

    const typing = document.createElement('div');
    typing.className = 'chat-typing';
    typing.id = 'chatTypingIndicator';
    typing.innerHTML = '<span></span><span></span><span></span>';
    messages.appendChild(typing);
    scrollToBottom();
}

function hideTyping() {
    const typing = document.getElementById('chatTypingIndicator');
    if (typing) {
        typing.remove();
    }
}

function syncInputState() {
    const { input, sendButton } = getChatElements();
    if (!input || !sendButton) {
        return;
    }

    const isManualMode = chatState.conversation?.handling_mode === 'manual';
    input.placeholder = isManualMode
        ? 'Nhập tin nhắn để admin hỗ trợ...'
        : 'Nhập tin nhắn...';

    input.disabled = false;
    sendButton.disabled = false;
}

async function loadChatHistory() {
    const { messages } = getChatElements();
    if (!messages) {
        return;
    }

    try {
        const response = await fetch('/chat/messages', { credentials: 'same-origin' });
        const data = await response.json();

        if (!data.success) {
            return;
        }

        chatState.conversation = data.conversation || null;
        chatState.renderedMessageIds.clear();
        messages.querySelectorAll('.chat-msg, .chat-typing').forEach((element) => element.remove());

        data.messages.forEach((message) => {
            appendMessageRecord(message);
        });

        syncInputState();
        chatState.loaded = true;
        updateChatBadge(0);
        scrollToBottom();
    } catch (error) {
        console.error('Load chat history error:', error);
    }
}

async function sendChatMessage(event) {
    event.preventDefault();

    const { input, sendButton } = getChatElements();
    if (!input || !sendButton) {
        return;
    }

    const message = input.value.trim();
    if (!message) {
        return;
    }

    appendMessage('customer', message, new Date().toISOString());
    input.value = '';
    sendButton.disabled = true;
    showTyping();

    try {
        const response = await fetch('/chat/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ message })
        });

        const data = await response.json();
        hideTyping();

        if (!response.ok || !data.success) {
            appendMessage('system', data.message || 'Không thể gửi tin nhắn lúc này.', new Date().toISOString());
            sendButton.disabled = false;
            input.focus();
            return;
        }

        if (data.customerMessage?.id) {
            chatState.renderedMessageIds.add(data.customerMessage.id);
        }

        chatState.conversation = {
            id: data.conversationId || chatState.conversation?.id || null,
            status: 'active',
            handling_mode: data.manualMode ? 'manual' : 'ai'
        };

        if (data.notice) {
            appendMessage('system', data.notice, new Date().toISOString());
        }

        if (data.botMessage) {
            appendMessageRecord(data.botMessage);
        }

        syncInputState();
    } catch (error) {
        hideTyping();
        appendMessage('system', 'Xin lỗi, có lỗi xảy ra. Vui lòng thử lại!', new Date().toISOString());
    }

    sendButton.disabled = false;
    input.focus();
    scrollToBottom();
}

async function pollNewMessages() {
    if (!chatState.open) {
        return;
    }

    if (chatState.pollErrors >= 3) {
        stopChatPolling();
        return;
    }

    try {
        const response = await fetch('/chat/messages', { credentials: 'same-origin' });
        if (!response.ok) {
            chatState.pollErrors += 1;
            return;
        }

        const data = await response.json();
        if (!data.success) {
            chatState.pollErrors += 1;
            return;
        }

        chatState.pollErrors = 0;
        chatState.conversation = data.conversation || null;

        let hasNewSupportMessage = false;
        data.messages.forEach((message) => {
            if (message.sender_type === 'customer') {
                if (message.id) {
                    chatState.renderedMessageIds.add(message.id);
                }
                return;
            }

            if (!chatState.renderedMessageIds.has(message.id)) {
                appendMessageRecord(message);
                hasNewSupportMessage = true;
            }
        });

        syncInputState();
        updateChatBadge(0);

        if (hasNewSupportMessage) {
            scrollToBottom();
        }
    } catch (error) {
        chatState.pollErrors += 1;
    }
}

function startChatPolling() {
    if (chatState.pollInterval || !chatState.open || !isChatPageVisible()) {
        return;
    }

    chatState.pollErrors = 0;
    chatState.pollInterval = setInterval(() => {
        if (!chatState.open || !isChatPageVisible()) {
            return;
        }

        pollNewMessages();
    }, 7000);
}

function stopChatPolling() {
    if (chatState.pollInterval) {
        clearInterval(chatState.pollInterval);
        chatState.pollInterval = null;
    }
}

function toggleChatWidget() {
    const { box, toggleButton, input } = getChatElements();
    if (!box || !toggleButton) {
        return;
    }

    chatState.open = !chatState.open;

    if (chatState.open) {
        box.hidden = false;
        toggleButton.hidden = true;

        if (!chatState.loaded) {
            loadChatHistory();
        } else {
            pollNewMessages();
        }

        startChatPolling();
        refreshChatBadge();
        input?.focus();
        return;
    }

    box.hidden = true;
    toggleButton.hidden = false;
    stopChatPolling();
    refreshChatBadge();
}

function syncChatAfterFocus() {
    if (!isChatPageVisible()) {
        stopChatPolling();
        return;
    }

    if (chatState.open) {
        if (!chatState.loaded) {
            loadChatHistory();
        } else {
            pollNewMessages();
        }

        startChatPolling();
        return;
    }

    refreshChatBadge();
}

function initChatWidget() {
    const { toggleButton } = getChatElements();
    if (!toggleButton || chatState.initialized) {
        return;
    }

    chatState.initialized = true;
    runChatTaskWhenIdle(() => refreshChatBadge());

    toggleButton.addEventListener('click', toggleChatWidget);
    document.querySelector('.chat-widget__close')?.addEventListener('click', toggleChatWidget);
    document.getElementById('chatForm')?.addEventListener('submit', sendChatMessage);

    document.addEventListener('visibilitychange', syncChatAfterFocus);
    window.addEventListener('pagehide', stopChatPolling, { passive: true });
}

document.addEventListener('DOMContentLoaded', initChatWidget);
