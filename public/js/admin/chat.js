// Điều phối tương tác trình duyệt cho màn quản trị chat trong khu vực admin.
document.body.classList.add('admin-body--chat');
document.querySelector('.admin-main-wrapper')?.classList.add('admin-main-wrapper--chat');
document.querySelector('.admin-main-content')?.classList.add('admin-main-content--chat');

const adminChatBootstrap = JSON.parse(document.getElementById('adminChatBootstrap').textContent);

const adminChatState = {
    conversations: adminChatBootstrap.conversations || [],
    currentConversationId: null,
    currentConversation: null,
    searchTerm: '',
    detailPollInterval: null,
    listPollInterval: null,
    attachmentPreviewUrls: []
};

// Xử lý show quản trị chat toast.
function showAdminChatToast(message, type = 'success') {
    if (typeof showGlobalToast === 'function') {
        showGlobalToast(message, type);
    }
}

// Che email.
function maskEmail(value) {
    const email = String(value || '').trim();
    const atIndex = email.indexOf('@');
    if (atIndex <= 0) return email || '';
    const local = email.slice(0, atIndex);
    const domain = email.slice(atIndex);
    if (local.length <= 5) {
        return `${local.slice(0, 1)}****${local.slice(-1)}${domain}`;
    }
    return `${local.slice(0, 3)}****${local.slice(-2)}${domain}`;
}

// Định dạng cuộc trò chuyện time.
function formatConversationTime(dateString) {
    if (!dateString) {
        return '';
    }

    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) {
        return '';
    }

    const now = new Date();
    const sameDay =
        date.getDate() === now.getDate() &&
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear();

    if (sameDay) {
        return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    }

    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
}

// Lấy cuộc trò chuyện display name.
function getConversationDisplayName(conversation) {
    return conversation.user_name || maskEmail(conversation.user_email) || conversation.guest_name || 'Khách';
}

// Lấy cuộc trò chuyện email.
function getConversationEmail(conversation) {
    if (conversation.user_email) {
        return maskEmail(conversation.user_email);
    }

    return conversation.user_id ? 'Khách hàng đã đăng nhập' : 'Khách vãng lai';
}

// Lấy cuộc trò chuyện trạng thái label.
function getConversationStatusLabel(status) {
    return status === 'closed' ? 'Đã đóng' : 'Đang mở';
}

// Lấy cuộc trò chuyện mode label.
function getConversationModeLabel(mode) {
    return mode === 'manual' ? 'Admin tiếp quản' : 'AI tự động';
}

// Cập nhật title unread badge.
function updateTitleUnreadBadge(count) {
    const badge = document.getElementById('adminChatUnreadCountBadge');
    if (!badge) {
        return;
    }

    if (!count || count <= 0) {
        badge.hidden = true;
        badge.textContent = '0 chưa đọc';
        return;
    }

    badge.hidden = false;
    badge.textContent = `${count} chưa đọc`;
}

// Cập nhật danh sách summary.
function updateListSummary() {
    const summary = document.getElementById('chatListSummary');
    if (!summary) {
        return;
    }

    const filteredTotal = getFilteredConversations().length;
    const total = adminChatState.conversations.length;
    const unread = adminChatState.conversations.filter((conversation) => conversation.unread_count > 0).length;
    const totalLabel = filteredTotal !== total
        ? `${filteredTotal}/${total} cuộc trò chuyện`
        : `${total} cuộc trò chuyện`;
    summary.textContent = unread > 0
        ? `${totalLabel}, ${unread} cuộc chưa đọc`
        : totalLabel;
}

// Lấy filtered conversations.
function getFilteredConversations() {
    const keyword = String(adminChatState.searchTerm || '').trim().toLowerCase();
    if (!keyword) {
        return adminChatState.conversations;
    }

    return adminChatState.conversations.filter((conversation) => {
        const haystack = [
            conversation.user_name,
            conversation.user_email,
            conversation.guest_name,
            conversation.last_message
        ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();

        return haystack.includes(keyword);
    });
}

// Cập nhật chat search.
function updateChatSearch(value) {
    adminChatState.searchTerm = value || '';
    renderConversationList();
}

// Tạo cuộc trò chuyện item.
function createConversationItem(conversation) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'admin-chat-list__item';
    button.dataset.id = String(conversation.id);

    if (conversation.id === adminChatState.currentConversationId) {
        button.classList.add('active');
    }

    if (conversation.unread_count > 0 && conversation.id !== adminChatState.currentConversationId) {
        button.classList.add('unread');
    }
    button.addEventListener('click', () => {
        selectConversation(conversation.id);
    });

    const avatar = document.createElement('div');
    avatar.className = 'admin-chat-list__avatar';
    if (conversation.user_avatar) {
        const image = document.createElement('img');
        image.src = conversation.user_avatar;
        image.alt = getConversationDisplayName(conversation);
        avatar.appendChild(image);
    } else {
        avatar.textContent = getConversationDisplayName(conversation).charAt(0).toUpperCase();
    }

    const info = document.createElement('div');
    info.className = 'admin-chat-list__info';

    const nameRow = document.createElement('div');
    nameRow.className = 'admin-chat-list__name-row';

    const name = document.createElement('div');
    name.className = 'admin-chat-list__name';
    name.textContent = getConversationDisplayName(conversation);
    nameRow.appendChild(name);

    if (conversation.handling_mode === 'manual') {
        const modeChip = document.createElement('span');
        modeChip.className = 'admin-chat-list__chip admin-chat-list__chip--manual';
        modeChip.textContent = 'Admin';
        nameRow.appendChild(modeChip);
    }

    if (conversation.status === 'closed') {
        const statusChip = document.createElement('span');
        statusChip.className = 'admin-chat-list__chip admin-chat-list__chip--closed';
        statusChip.textContent = 'Đóng';
        nameRow.appendChild(statusChip);
    }

    const preview = document.createElement('div');
    preview.className = 'admin-chat-list__preview';

    if (conversation.last_message) {
        let prefix = '';
        if (conversation.last_sender === 'admin') {
            prefix = 'Admin: ';
        } else if (conversation.last_sender === 'bot') {
            prefix = 'AI: ';
        }
        preview.textContent = `${prefix}${conversation.last_message}`;
    } else {
        preview.textContent = 'Chưa có tin nhắn';
    }

    const meta = document.createElement('div');
    meta.className = 'admin-chat-list__meta';
    meta.textContent = `${getConversationStatusLabel(conversation.status)} • ${getConversationModeLabel(conversation.handling_mode)}${conversation.last_message_at ? ` • ${formatConversationTime(conversation.last_message_at)}` : ''}`;

    info.appendChild(nameRow);
    info.appendChild(preview);
    info.appendChild(meta);

    button.appendChild(avatar);
    button.appendChild(info);

    if (conversation.unread_count > 0 && conversation.id !== adminChatState.currentConversationId) {
        const badge = document.createElement('span');
        badge.className = 'admin-chat-list__badge';
        badge.textContent = String(conversation.unread_count);
        button.appendChild(badge);
    }

    return button;
}

// Hiển thị cuộc trò chuyện danh sách.
function renderConversationList() {
    const container = document.getElementById('chatListItems');
    if (!container) {
        return;
    }

    container.innerHTML = '';

    const filteredConversations = getFilteredConversations();
    if (!filteredConversations.length) {
        const emptyState = document.createElement('div');
        emptyState.className = 'admin-chat-list__empty';
        emptyState.textContent = adminChatState.searchTerm
            ? 'Không tìm thấy cuộc trò chuyện phù hợp.'
            : 'Chưa có cuộc trò chuyện nào.';
        container.appendChild(emptyState);
        updateListSummary();
        updateTitleUnreadBadge(adminChatState.conversations.filter((conversation) => conversation.unread_count > 0).length);
        return;
    }

    filteredConversations.forEach((conversation) => {
        container.appendChild(createConversationItem(conversation));
    });

    updateListSummary();
    updateTitleUnreadBadge(adminChatState.conversations.filter((conversation) => conversation.unread_count > 0).length);
}

// Tạo tin nhắn element.
function createMessageElement(message) {
    const wrapper = document.createElement('div');
    wrapper.className = `admin-chat-msg admin-chat-msg--${message.sender_type}`;
    wrapper.dataset.messageId = String(message.id);

    if (message.sender_type === 'admin' || message.sender_type === 'bot') {
        const label = document.createElement('div');
        label.className = 'admin-chat-msg__label';
        label.textContent = message.sender_type === 'admin' ? 'Admin' : 'Trợ lý AI';
        wrapper.appendChild(label);
    }

    const content = document.createElement('div');
    content.className = 'admin-chat-msg__content';
    window.ChatRichMessage.renderMessageContent(content, message);
    wrapper.appendChild(content);

    const time = document.createElement('div');
    time.className = 'admin-chat-msg__time';
    time.textContent = formatConversationTime(message.created_at);
    wrapper.appendChild(time);

    return wrapper;
}

// Hiển thị tin nhắn.
function renderMessages(messages, scrollToBottom = false) {
    const container = document.getElementById('adminChatMessages');
    if (!container) {
        return;
    }

    const shouldStickToBottom =
        scrollToBottom ||
        container.scrollHeight - container.scrollTop - container.clientHeight < 80;

    container.innerHTML = '';

    messages.forEach((message) => {
        container.appendChild(createMessageElement(message));
    });

    if (shouldStickToBottom) {
        container.scrollTop = container.scrollHeight;
    }
}

// Cập nhật cuộc trò chuyện header.
function updateConversationHeader(conversation) {
    const name = document.getElementById('chatUserName');
    const email = document.getElementById('chatUserEmail');
    const status = document.getElementById('chatConversationStatus');
    const mode = document.getElementById('chatConversationMode');
    const modeButton = document.getElementById('chatModeBtn');
    const statusButton = document.getElementById('chatStatusBtn');
    const replyInput = document.getElementById('adminReplyInput');
    const replyButton = document.getElementById('adminReplySendBtn');
    const attachButton = document.getElementById('adminReplyAttachBtn');
    const replyHint = document.getElementById('adminReplyHint');

    if (!conversation) {
        return;
    }

    name.textContent = getConversationDisplayName(conversation);
    email.textContent = getConversationEmail(conversation);

    status.textContent = getConversationStatusLabel(conversation.status);
    status.className = `admin-chat-detail__chip${conversation.status === 'closed' ? ' admin-chat-detail__chip--closed' : ''}`;

    mode.textContent = getConversationModeLabel(conversation.handling_mode);
    mode.className = `admin-chat-detail__chip admin-chat-detail__chip--mode${conversation.handling_mode === 'manual' ? ' admin-chat-detail__chip--manual' : ''}`;

    modeButton.textContent = conversation.handling_mode === 'manual' ? 'Bật AI' : 'Tiếp quản';
    modeButton.className = conversation.handling_mode === 'manual'
        ? 'admin-btn admin-btn--primary'
        : 'admin-btn admin-btn--ghost';

    statusButton.textContent = conversation.status === 'closed' ? 'Mở lại' : 'Đóng';
    statusButton.className = conversation.status === 'closed'
        ? 'admin-btn admin-btn--primary'
        : 'admin-btn admin-btn--danger';

    const isClosed = conversation.status === 'closed';
    replyInput.disabled = isClosed;
    replyButton.disabled = isClosed;
    if (attachButton) {
        attachButton.disabled = isClosed;
    }

    if (isClosed) {
        replyInput.placeholder = 'Cuộc trò chuyện đã đóng. Hãy mở lại để trả lời.';
        replyHint.textContent = 'Cuộc trò chuyện đang ở trạng thái đã đóng.';
    } else if (conversation.handling_mode === 'manual') {
        replyInput.placeholder = 'Nhập tin nhắn trả lời...';
        replyHint.textContent = 'AI đang tạm dừng cho cuộc trò chuyện này vì admin đang tiếp quản.';
    } else {
        replyInput.placeholder = 'Nhập tin nhắn trả lời...';
        replyHint.textContent = 'Gửi tin nhắn từ đây sẽ tự chuyển cuộc trò chuyện sang chế độ admin tiếp quản.';
    }
}

// Xử lý upsert cuộc trò chuyện.
function upsertConversation(conversation, messages = null) {
    if (!conversation) {
        return;
    }

    const updatedConversation = { ...conversation };
    if (Array.isArray(messages) && messages.length > 0) {
        const lastMessage = messages[messages.length - 1];
        updatedConversation.last_message = lastMessage.message
            || (lastMessage.message_type === 'media' ? '[Đã gửi media]' : '[Tin nhắn]');
        updatedConversation.last_sender = lastMessage.sender_type;
        updatedConversation.last_message_at = lastMessage.created_at;
    }

    if (updatedConversation.id === adminChatState.currentConversationId) {
        updatedConversation.unread_count = 0;
    }

    const index = adminChatState.conversations.findIndex((item) => item.id === updatedConversation.id);
    if (index >= 0) {
        adminChatState.conversations[index] = {
            ...adminChatState.conversations[index],
            ...updatedConversation
        };
    } else {
        adminChatState.conversations.unshift(updatedConversation);
    }

    adminChatState.conversations.sort((left, right) => {
        const rightValue = right.last_message_at ? new Date(right.last_message_at).getTime() : 0;
        const leftValue = left.last_message_at ? new Date(left.last_message_at).getTime() : 0;
        return rightValue - leftValue || right.id - left.id;
    });
}

// Xử lý refresh current cuộc trò chuyện.
async function refreshCurrentConversation({ forceScroll = false } = {}) {
    if (!adminChatState.currentConversationId) {
        return;
    }

    try {
        const response = await fetch(`/chat/admin/${adminChatState.currentConversationId}/messages`, {
            credentials: 'same-origin'
        });
        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Không thể tải cuộc trò chuyện');
        }

        adminChatState.currentConversation = data.conversation;
        upsertConversation(data.conversation, data.messages);
        renderMessages(data.messages, forceScroll);
        updateConversationHeader(data.conversation);
        renderConversationList();
    } catch (error) {
        console.error('Refresh current conversation error:', error);
    }
}

// Xử lý select cuộc trò chuyện.
async function selectConversation(conversationId, options = {}) {
    adminChatState.currentConversationId = conversationId;
    adminChatState.currentConversation = adminChatState.conversations.find((conversation) => conversation.id === conversationId) || null;
    clearAdminAttachmentSelection();

    document.getElementById('chatDetailEmpty').hidden = true;
    document.getElementById('chatDetailContent').hidden = false;

    await refreshCurrentConversation({ forceScroll: true });
    startDetailPolling();

    if (options.focusInput !== false) {
        document.getElementById('adminReplyInput')?.focus();
    }
}

// Xử lý refresh cuộc trò chuyện danh sách.
async function refreshConversationList() {
    try {
        const response = await fetch('/chat/admin/conversations', { credentials: 'same-origin' });
        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Không thể tải danh sách cuộc trò chuyện');
        }

        adminChatState.conversations = data.conversations || [];
        renderConversationList();

        if (
            adminChatState.currentConversationId &&
            !adminChatState.conversations.some((conversation) => conversation.id === adminChatState.currentConversationId)
        ) {
            clearCurrentConversation();
        }
    } catch (error) {
        console.error('Refresh conversation list error:', error);
    }
}

// Xử lý describe selected quản trị tệp.
function describeSelectedAdminFiles(files = []) {
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

function revokeAdminAttachmentPreviewUrls() {
    adminChatState.attachmentPreviewUrls.forEach((url) => URL.revokeObjectURL(url));
    adminChatState.attachmentPreviewUrls = [];
}

function renderAdminAttachmentMediaPreview(files, container) {
    revokeAdminAttachmentPreviewUrls();

    if (!container) return;
    container.replaceChildren();

    const previewFiles = files.slice(0, 6);
    previewFiles.forEach((file) => {
        const item = document.createElement('div');
        item.className = 'admin-chat-detail__attachments-item';
        item.title = file.name;

        if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
            const url = URL.createObjectURL(file);
            adminChatState.attachmentPreviewUrls.push(url);

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
        more.className = 'admin-chat-detail__attachments-item admin-chat-detail__attachments-item--more';
        more.textContent = `+${files.length - previewFiles.length}`;
        container.appendChild(more);
    }
}

// Cập nhật quản trị attachment preview.
function updateAdminAttachmentPreview() {
    const fileInput = document.getElementById('adminReplyMediaInput');
    const preview = document.getElementById('adminReplyAttachmentPreview');
    const media = document.getElementById('adminReplyAttachmentPreviewMedia');
    const text = document.getElementById('adminReplyAttachmentPreviewText');

    if (!fileInput || !preview || !text) {
        return;
    }

    const files = Array.from(fileInput.files || []);
    if (!files.length) {
        preview.hidden = true;
        text.textContent = '';
        renderAdminAttachmentMediaPreview([], media);
        return;
    }

    preview.hidden = false;
    text.textContent = describeSelectedAdminFiles(files);
    renderAdminAttachmentMediaPreview(files, media);
}

// Xử lý clear quản trị attachment selection.
function clearAdminAttachmentSelection() {
    const fileInput = document.getElementById('adminReplyMediaInput');
    if (!fileInput) {
        return;
    }

    fileInput.value = '';
    updateAdminAttachmentPreview();
}

// Xử lý quản trị reply.
async function adminReply(event) {
    event.preventDefault();

    const input = document.getElementById('adminReplyInput');
    const sendButton = document.getElementById('adminReplySendBtn');
    const attachButton = document.getElementById('adminReplyAttachBtn');
    const fileInput = document.getElementById('adminReplyMediaInput');
    const message = input.value.trim();
    const files = Array.from(fileInput?.files || []);

    if ((!message && !files.length) || !adminChatState.currentConversationId) {
        return;
    }

    if (adminChatState.currentConversation?.status === 'closed') {
        showAdminChatToast('Cuộc trò chuyện đã đóng. Hãy mở lại trước khi trả lời.', 'warning');
        return;
    }

    sendButton.disabled = true;
    if (attachButton) {
        attachButton.disabled = true;
    }

    const formData = new FormData();
    formData.append('message', message);
    files.forEach((file) => {
        formData.append('messageMedia', file);
    });

    try {
        const response = await fetch(`/chat/admin/${adminChatState.currentConversationId}/reply`, {
            method: 'POST',
            credentials: 'same-origin',
            body: formData
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Không thể gửi tin nhắn');
        }

        input.value = '';
        clearAdminAttachmentSelection();
        adminChatState.currentConversation = data.conversation;
        upsertConversation(data.conversation, [data.message]);
        await refreshCurrentConversation({ forceScroll: true });
        renderConversationList();
    } catch (error) {
        showAdminChatToast(error.message || 'Lỗi gửi tin nhắn', 'error');
    }

    sendButton.disabled = false;
    if (attachButton) {
        attachButton.disabled = false;
    }
    input.focus();
}

// Bật/tắt current cuộc trò chuyện mode.
async function toggleCurrentConversationMode() {
    if (!adminChatState.currentConversationId || !adminChatState.currentConversation) {
        return;
    }

    const nextMode = adminChatState.currentConversation.handling_mode === 'manual' ? 'ai' : 'manual';

    try {
        const response = await fetch(`/chat/admin/${adminChatState.currentConversationId}/mode`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ mode: nextMode })
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Không thể đổi chế độ xử lý');
        }

        adminChatState.currentConversation = data.conversation;
        upsertConversation(data.conversation);
        updateConversationHeader(data.conversation);
        renderConversationList();
        showAdminChatToast(data.message, 'success');
    } catch (error) {
        showAdminChatToast(error.message || 'Không thể đổi chế độ xử lý', 'error');
    }
}

// Bật/tắt current cuộc trò chuyện trạng thái.
async function toggleCurrentConversationStatus() {
    if (!adminChatState.currentConversationId || !adminChatState.currentConversation) {
        return;
    }

    const endpoint = adminChatState.currentConversation.status === 'closed' ? 'reopen' : 'close';

    try {
        const response = await fetch(`/chat/admin/${adminChatState.currentConversationId}/${endpoint}`, {
            method: 'PUT',
            credentials: 'same-origin'
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Không thể cập nhật trạng thái cuộc trò chuyện');
        }

        await refreshCurrentConversation();
        renderConversationList();
        showAdminChatToast(data.message, 'success');
    } catch (error) {
        showAdminChatToast(error.message || 'Không thể cập nhật trạng thái cuộc trò chuyện', 'error');
    }
}

// Xử lý clear current cuộc trò chuyện.
function clearCurrentConversation() {
    adminChatState.currentConversationId = null;
    adminChatState.currentConversation = null;
    stopDetailPolling();
    clearAdminAttachmentSelection();

    document.getElementById('chatDetailEmpty').hidden = false;
    document.getElementById('chatDetailContent').hidden = true;
}

// Xử lý start chi tiết polling.
function startDetailPolling() {
    stopDetailPolling();
    adminChatState.detailPollInterval = setInterval(() => {
        refreshCurrentConversation();
    }, 3000);
}

// Xử lý stop chi tiết polling.
function stopDetailPolling() {
    if (adminChatState.detailPollInterval) {
        clearInterval(adminChatState.detailPollInterval);
        adminChatState.detailPollInterval = null;
    }
}

// Xử lý start danh sách polling.
function startListPolling() {
    if (adminChatState.listPollInterval) {
        return;
    }

    adminChatState.listPollInterval = setInterval(() => {
        refreshConversationList();
    }, 5000);
}

// Khởi tạo quản trị chat.
function initAdminChat() {
    if (!window.ChatRichMessage) {
        return;
    }

    document.getElementById('adminChatSearchInput')?.addEventListener('input', (event) => {
        updateChatSearch(event.target.value);
    });

    document.getElementById('chatModeBtn')?.addEventListener('click', toggleCurrentConversationMode);
    document.getElementById('chatStatusBtn')?.addEventListener('click', toggleCurrentConversationStatus);
    document.getElementById('adminReplyForm')?.addEventListener('submit', adminReply);
    document.getElementById('adminReplyAttachBtn')?.addEventListener('click', () => {
        document.getElementById('adminReplyMediaInput')?.click();
    });
    document.getElementById('adminReplyMediaInput')?.addEventListener('change', updateAdminAttachmentPreview);
    document.getElementById('adminReplyAttachmentClearBtn')?.addEventListener('click', clearAdminAttachmentSelection);
    window.addEventListener('pagehide', revokeAdminAttachmentPreviewUrls, { passive: true });

    renderConversationList();
    startListPolling();

    const initialConversation =
        adminChatState.conversations.find((conversation) => conversation.unread_count > 0) ||
        adminChatState.conversations[0];

    if (initialConversation) {
        selectConversation(initialConversation.id, { focusInput: false });
    }
}
window.addEventListener('beforeunload', () => {
    stopDetailPolling();
    if (adminChatState.listPollInterval) {
        clearInterval(adminChatState.listPollInterval);
    }
});
document.addEventListener('DOMContentLoaded', initAdminChat);
