// Gắn hộp xác nhận cho các form thao tác đơn hàng cần người dùng xác nhận.

/**
 * Bind một lần cho các form có data-confirm-submit để tránh lặp listener sau khi DOM được cập nhật.
 */
function bindConfirmSubmitForms(root = document) {
    root.querySelectorAll('[data-confirm-submit]').forEach((form) => {
        if (form.dataset.confirmSubmitBound === 'true') {
            return;
        }

        form.dataset.confirmSubmitBound = 'true';
        form.addEventListener('submit', (event) => {
            // Thông báo xác nhận nằm trong data attribute để EJS không cần inline JavaScript.
            const message = form.dataset.confirmMessage || 'Ban chac chan muon thuc hien thao tac nay?';
            if (!window.confirm(message)) {
                event.preventDefault();
            }
        });
    });
}

function formatPaymentCountdown(milliseconds) {
    if (milliseconds <= 0) {
        return 'Đã quá hạn thanh toán';
    }

    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `Còn ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')} để thanh toán`;
}

function bindPaymentCountdowns(root = document) {
    const countdowns = Array.from(root.querySelectorAll('[data-payment-countdown]'));
    if (countdowns.length === 0) {
        return;
    }

    const tick = () => {
        const now = Date.now();
        countdowns.forEach((node) => {
            const expiresAt = new Date(node.dataset.expiresAt || '').getTime();
            const remaining = Number.isFinite(expiresAt) ? expiresAt - now : 0;
            node.textContent = formatPaymentCountdown(remaining);
            node.classList.toggle('is-expired', remaining <= 0);
        });
    };

    tick();
    setInterval(tick, 1000);
}

document.addEventListener('DOMContentLoaded', () => {
    bindConfirmSubmitForms(document);
    bindPaymentCountdowns(document);
});
