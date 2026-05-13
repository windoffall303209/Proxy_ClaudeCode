// Điều phối tương tác trình duyệt cho chat widget, tách khỏi template EJS.
const chatState = window.__tmdtChatWidgetState || (window.__tmdtChatWidgetState = {
    open: false,
    loaded: false,
    pollInterval: null,
    pollErrors: 0,
    renderedMessageIds: new Set(),
    pendingCustomerMessage: null,
    conversation: null,
    initialized: false,
    badgeRequest: null,
    expanded: false,
    attachmentPreviewUrls: []
});
chatState.attachmentPreviewUrls = chatState.attachmentPreviewUrls || [];

// Lấy chat elements.
function getChatElements() {
    return {
        box: document.getElementById('chatBox'),
        toggleButton: document.getElementById('chatToggleBtn'),
        badge: document.getElementById('chatBadge'),
        messages: document.getElementById('chatMessages'),
        input: document.getElementById('chatInput'),
        sendButton: document.getElementById('chatSendBtn'),
        attachButton: document.getElementById('chatAttachBtn'),
        fileInput: document.getElementById('chatMediaInput'),
        attachmentPreview: document.getElementById('chatAttachmentPreview'),
        attachmentPreviewMedia: document.getElementById('chatAttachmentPreviewMedia'),
        attachmentPreviewText: document.getElementById('chatAttachmentPreviewText'),
        attachmentClearButton: document.getElementById('chatAttachmentClearBtn'),
        expandButton: document.getElementById('chatExpandBtn'),
        expandIcon: document.querySelector('.chat-widget__action-icon--expand'),
        collapseIcon: document.querySelector('.chat-widget__action-icon--collapse')
    };
}

// Cập nhật chat badge.
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

// Kiểm tra chat trang visible.
function isChatPageVisible() {
    return document.visibilityState !== 'hidden';
}

// Xử lý run chat task when idle.
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

// Xử lý refresh chat badge.
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

// Định dạng chat time.
function formatChatTime(date) {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
}

// Xử lý scroll vào bottom.
function scrollToBottom() {
    const { messages } = getChatElements();
    if (!messages) {
        return;
    }

    window.setTimeout(() => {
        messages.scrollTop = messages.scrollHeight;
    }, 50);
}

// Tạo dữ liệu tin nhắn label.
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

// Tạo tin nhắn object.
function createMessageObject(type, text, time, metadata) {
    return {
        sender_type: type,
        message: typeof text === 'string' ? text : '',
        created_at: time,
        message_metadata: metadata || null
    };
}

// Chuẩn hóa pending tin nhắn text.
function normalizePendingMessageText(value) {
    return typeof value === 'string' ? value.trim() : '';
}

// Xử lý set pending customer tin nhắn.
function setPendingCustomerMessage(text, element) {
    chatState.pendingCustomerMessage = {
        text: normalizePendingMessageText(text),
        element: element || null
    };
}

// Xử lý clear pending customer tin nhắn.
function clearPendingCustomerMessage(options = {}) {
    const pending = chatState.pendingCustomerMessage;
    chatState.pendingCustomerMessage = null;

    if (options.removeElement && pending?.element?.isConnected) {
        pending.element.remove();
    }
}

// Xử lý reconcile pending customer tin nhắn.
function reconcilePendingCustomerMessage(message) {
    if (!message || message.sender_type !== 'customer' || !message.id) {
        return false;
    }

    const pending = chatState.pendingCustomerMessage;
    if (!pending || pending.text !== normalizePendingMessageText(message.message)) {
        return false;
    }

    const wrapper = pending.element;
    chatState.pendingCustomerMessage = null;

    if (!wrapper || !wrapper.isConnected) {
        return false;
    }

    wrapper.dataset.messageId = String(message.id);
    chatState.renderedMessageIds.add(message.id);

    const content = wrapper.querySelector('.chat-msg__content');
    if (content) {
        content.innerHTML = '';
        window.ChatRichMessage.renderMessageContent(content, message);
    }

    const timeElement = wrapper.querySelector('.chat-msg__time');
    if (timeElement) {
        timeElement.textContent = message.created_at
            ? formatChatTime(new Date(message.created_at))
            : formatChatTime(new Date());
    }

    return true;
}

// Xử lý append tin nhắn.
function appendMessage(type, text, time, options = {}) {
    const { messages } = getChatElements();
    if (!messages) {
        return null;
    }

    if (options.messageId && chatState.renderedMessageIds.has(options.messageId)) {
        return null;
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

    const content = document.createElement('div');
    content.className = 'chat-msg__content';
    window.ChatRichMessage.renderMessageContent(
        content,
        createMessageObject(type, text, time, options.metadata)
    );
    wrapper.appendChild(content);

    const timeElement = document.createElement('div');
    timeElement.className = 'chat-msg__time';
    timeElement.textContent = time ? formatChatTime(new Date(time)) : formatChatTime(new Date());
    wrapper.appendChild(timeElement);

    messages.appendChild(wrapper);
    scrollToBottom();
    return wrapper;
}

// Xử lý append tin nhắn record.
function appendMessageRecord(message) {
    if (!message) {
        return;
    }

    if (reconcilePendingCustomerMessage(message)) {
        return;
    }

    if (message.id && chatState.renderedMessageIds.has(message.id)) {
        return;
    }

    appendMessage(message.sender_type, message.message, message.created_at, {
        messageId: message.id,
        metadata: message.message_metadata
    });
}

// Xử lý show typing.
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

// Xử lý hide typing.
function hideTyping() {
    const typing = document.getElementById('chatTypingIndicator');
    if (typing) {
        typing.remove();
    }
}

// Đồng bộ input state.
function syncInputState() {
    const { input, sendButton, attachButton } = getChatElements();
    if (!input || !sendButton || !attachButton) {
        return;
    }

    const isManualMode = chatState.conversation?.handling_mode === 'manual';
    input.placeholder = isManualMode
        ? 'Nhập tin nhắn để admin hỗ trợ...'
        : 'Nhập tin nhắn...';

    input.disabled = false;
    sendButton.disabled = false;
    attachButton.disabled = false;
}

// Xử lý describe selected tệp.
function describeSelectedFiles(files = []) {
    if (!files.length) {
        return '';
    }

    if (files.length === 1) {
        return `Đã chọn: ${files[0].name}`;
    }

    const fileNames = files.slice(0, 2).map((file) => file.name).join(', ');
    const remaining = files.length - 2;
    return remaining > 0
        ? `${files.length} tệp: ${fileNames} và ${remaining} tệp khác`
        : `${files.length} tệp: ${fileNames}`;
}

function revokeAttachmentPreviewUrls() {
    chatState.attachmentPreviewUrls.forEach((url) => URL.revokeObjectURL(url));
    chatState.attachmentPreviewUrls = [];
}

function renderAttachmentMediaPreview(files, container) {
    revokeAttachmentPreviewUrls();

    if (!container) return;
    container.replaceChildren();

    const previewFiles = files.slice(0, 6);
    previewFiles.forEach((file) => {
        const item = document.createElement('div');
        item.className = 'chat-widget__attachments-item';
        item.title = file.name;

        if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
            const url = URL.createObjectURL(file);
            chatState.attachmentPreviewUrls.push(url);

            const media = file.type.startsWith('video/')
                ? document.createElement('video')
                : document.createElement('img');
            media.src = url;
            media.title = file.name;
            if (media.tagName === 'IMG') {
                media.alt = file.name;
            } else {
                media.muted = true;
                media.playsInline = true;
                media.preload = 'metadata';
            }
            item.appendChild(media);
        } else {
            const fallback = document.createElement('span');
            fallback.textContent = file.name.slice(0, 3).toUpperCase();
            item.appendChild(fallback);
        }

        container.appendChild(item);
    });

    if (files.length > previewFiles.length) {
        const more = document.createElement('div');
        more.className = 'chat-widget__attachments-item chat-widget__attachments-item--more';
        more.textContent = `+${files.length - previewFiles.length}`;
        container.appendChild(more);
    }
}

// Cập nhật attachment preview.
function updateAttachmentPreview() {
    const { fileInput, attachmentPreview, attachmentPreviewMedia, attachmentPreviewText } = getChatElements();
    if (!fileInput || !attachmentPreview || !attachmentPreviewText) {
        return;
    }

    const files = Array.from(fileInput.files || []);
    if (!files.length) {
        attachmentPreview.hidden = true;
        attachmentPreviewText.textContent = '';
        renderAttachmentMediaPreview([], attachmentPreviewMedia);
        return;
    }

    attachmentPreview.hidden = false;
    attachmentPreviewText.textContent = describeSelectedFiles(files);
    renderAttachmentMediaPreview(files, attachmentPreviewMedia);
}

// Xử lý clear attachment selection.
function clearAttachmentSelection() {
    const { fileInput } = getChatElements();
    if (!fileInput) {
        return;
    }

    fileInput.value = '';
    updateAttachmentPreview();
}

// Nạp chat history.
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
        clearPendingCustomerMessage();
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

// Gửi chat tin nhắn.
async function sendChatMessage(event) {
    event.preventDefault();

    const { input, sendButton, attachButton, fileInput } = getChatElements();
    if (!input || !sendButton || !attachButton || !fileInput) {
        return;
    }

    const message = input.value.trim();
    const files = Array.from(fileInput.files || []);

    if (!message && !files.length) {
        return;
    }

    const textOnlyMessage = files.length === 0;
    if (textOnlyMessage) {
        const optimisticMessage = appendMessage('customer', message, new Date().toISOString());
        setPendingCustomerMessage(message, optimisticMessage);
    }

    input.value = '';
    sendButton.disabled = true;
    attachButton.disabled = true;
    showTyping();

    const formData = new FormData();
    formData.append('message', message);
    files.forEach((file) => {
        formData.append('messageMedia', file);
    });

    try {
        const response = await fetch('/chat/send', {
            method: 'POST',
            credentials: 'same-origin',
            body: formData
        });

        const data = await response.json();
        hideTyping();

        if (!response.ok || !data.success) {
            clearPendingCustomerMessage({ removeElement: textOnlyMessage });
            appendMessage('system', data.message || 'Không thể gửi tin nhắn lúc này.', new Date().toISOString());
            sendButton.disabled = false;
            attachButton.disabled = false;
            input.focus();
            return;
        }

        if (data.customerMessage) {
            appendMessageRecord(data.customerMessage);
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

        clearAttachmentSelection();
        syncInputState();
    } catch (error) {
        hideTyping();
        clearPendingCustomerMessage({ removeElement: textOnlyMessage });
        appendMessage('system', 'Xin lỗi, có lỗi xảy ra. Vui lòng thử lại!', new Date().toISOString());
    }

    sendButton.disabled = false;
    attachButton.disabled = false;
    input.focus();
    scrollToBottom();
}

// Xử lý poll new tin nhắn.
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

        let hasNewMessage = false;
        data.messages.forEach((message) => {
            if (!message?.id || !chatState.renderedMessageIds.has(message.id)) {
                appendMessageRecord(message);
                hasNewMessage = true;
            }
        });

        syncInputState();
        updateChatBadge(0);

        if (hasNewMessage) {
            scrollToBottom();
        }
    } catch (error) {
        chatState.pollErrors += 1;
    }
}

// Xử lý start chat polling.
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

// Xử lý stop chat polling.
function stopChatPolling() {
    if (chatState.pollInterval) {
        clearInterval(chatState.pollInterval);
        chatState.pollInterval = null;
    }
}

// Đồng bộ expand button.
function syncExpandButton() {
    const { box, expandButton, expandIcon, collapseIcon } = getChatElements();
    if (!box || !expandButton || !expandIcon || !collapseIcon) {
        return;
    }

    box.classList.toggle('chat-widget__box--expanded', chatState.expanded);
    expandIcon.hidden = chatState.expanded;
    collapseIcon.hidden = !chatState.expanded;
    expandButton.setAttribute(
        'aria-label',
        chatState.expanded ? 'Thu nhỏ cửa sổ chat' : 'Phóng to cửa sổ chat'
    );
}

// Bật/tắt chat expand.
function toggleChatExpand() {
    chatState.expanded = !chatState.expanded;
    syncExpandButton();
    scrollToBottom();
}

// Bật/tắt chat widget.
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
        syncExpandButton();
        input?.focus();
        return;
    }

    box.hidden = true;
    toggleButton.hidden = false;
    stopChatPolling();
    refreshChatBadge();
}

// Đồng bộ chat after focus.
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

// Khởi tạo chat widget.
function initChatWidget() {
    const {
        toggleButton,
        attachButton,
        fileInput,
        attachmentClearButton,
        expandButton
    } = getChatElements();

    if (!toggleButton || chatState.initialized || !window.ChatRichMessage) {
        return;
    }

    chatState.initialized = true;
    runChatTaskWhenIdle(() => refreshChatBadge());
    syncExpandButton();
    toggleButton.addEventListener('click', toggleChatWidget);
    document.querySelector('.chat-widget__close')?.addEventListener('click', toggleChatWidget);
    document.getElementById('chatForm')?.addEventListener('submit', sendChatMessage);
    attachButton?.addEventListener('click', () => fileInput?.click());
    fileInput?.addEventListener('change', updateAttachmentPreview);
    attachmentClearButton?.addEventListener('click', clearAttachmentSelection);
    expandButton?.addEventListener('click', toggleChatExpand);
    document.addEventListener('visibilitychange', syncChatAfterFocus);
    window.addEventListener('pagehide', revokeAttachmentPreviewUrls, { passive: true });
    window.addEventListener('pagehide', stopChatPolling, { passive: true });
}
document.addEventListener('DOMContentLoaded', initChatWidget);
