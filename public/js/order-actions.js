// Coordinates order action interactions without inline confirmation blocks.

const orderActionText = {
    defaultTitle: '\u0058\u00e1\u0063 \u006e\u0068\u1ead\u006e \u0074\u0068\u0061\u006f \u0074\u00e1\u0063',
    cancelTitle: '\u0058\u00e1\u0063 \u006e\u0068\u1ead\u006e \u0068\u1ee7\u0079 \u0111\u01a1\u006e',
    defaultMessage: '\u0042\u1ea1\u006e \u0063\u0068\u1eaf\u0063 \u0063\u0068\u1eaf\u006e \u006d\u0075\u1ed1\u006e \u0074\u0068\u1ef1\u0063 \u0068\u0069\u1ec7\u006e \u0074\u0068\u0061\u006f \u0074\u00e1\u0063 \u006e\u00e0\u0079\u003f',
    cancelButton: '\u004b\u0068\u00f4\u006e\u0067',
    defaultCancelButton: '\u0048\u1ee7\u0079',
    confirmCancelButton: '\u0058\u00e1\u0063 \u006e\u0068\u1ead\u006e \u0048\u1ee7\u0079',
    confirmDefaultButton: '\u0054\u0069\u1ebf\u0070 \u0074\u1ee5\u0063',
    cancelling: '\u0110\u0061\u006e\u0067 \u0068\u1ee7\u0079...',
    processing: '\u0110\u0061\u006e\u0067 \u0078\u1eed \u006c\u00fd...',
    expiredPayment: '\u0110\u00e3 \u0071\u0075\u00e1 \u0068\u1ea1\u006e \u0074\u0068\u0061\u006e\u0068 \u0074\u006f\u00e1\u006e',
    paymentPrefix: '\u0043\u00f2\u006e',
    paymentSuffix: '\u0111\u1ec3 \u0074\u0068\u0061\u006e\u0068 \u0074\u006f\u00e1\u006e'
};

function isCancelOrderForm(form) {
    try {
        const actionUrl = new URL(form.action || '', window.location.href);
        return /^\/orders\/[^/]+\/cancel\/?$/.test(actionUrl.pathname);
    } catch (error) {
        return String(form.getAttribute('action') || '').includes('/cancel');
    }
}

async function confirmOrderAction(form) {
    const isCancelForm = isCancelOrderForm(form);
    const message = form.dataset.confirmMessage || orderActionText.defaultMessage;

    if (typeof window.showGlobalConfirm === 'function') {
        return window.showGlobalConfirm({
            title: isCancelForm ? orderActionText.cancelTitle : orderActionText.defaultTitle,
            message,
            tone: isCancelForm ? 'danger' : 'default',
            cancelText: isCancelForm ? orderActionText.cancelButton : orderActionText.defaultCancelButton,
            confirmText: isCancelForm ? orderActionText.confirmCancelButton : orderActionText.confirmDefaultButton
        });
    }

    return window.confirm(message);
}

function submitConfirmedOrderAction(form) {
    const isCancelForm = isCancelOrderForm(form);
    form.dataset.modalConfirmed = 'true';

    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = isCancelForm ? orderActionText.cancelling : orderActionText.processing;
    }

    if (typeof form.requestSubmit === 'function') {
        form.requestSubmit();
    } else {
        form.submit();
    }
}

function bindConfirmSubmitForms(root = document) {
    root.querySelectorAll('[data-confirm-submit]').forEach((form) => {
        if (form.dataset.confirmSubmitBound === 'true') {
            return;
        }

        form.dataset.confirmSubmitBound = 'true';
        form.addEventListener('submit', async (event) => {
            if (form.dataset.modalConfirmed === 'true') {
                return;
            }

            event.preventDefault();

            const confirmed = await confirmOrderAction(form);
            if (confirmed) {
                submitConfirmedOrderAction(form);
            }
        });
    });
}

function formatPaymentCountdown(milliseconds) {
    if (milliseconds <= 0) {
        return orderActionText.expiredPayment;
    }

    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const time = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    return `${orderActionText.paymentPrefix} ${time} ${orderActionText.paymentSuffix}`;
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
