// Điều phối tương tác trình duyệt cho toast, tách khỏi template EJS.
(function() {
    const TOAST_ROOT_ID = 'globalToastContainer';
    const DIALOG_ROOT_ID = 'globalDialogRoot';
    const STYLE_ID = 'globalFeedbackStyles';

    const ICONS = {
        success: `
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M20 6L9 17l-5-5"></path>
            </svg>
        `,
        error: `
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M18 6L6 18"></path>
                <path d="M6 6l12 12"></path>
            </svg>
        `,
        info: `
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 8h.01"></path>
                <path d="M11 12h1v4h1"></path>
                <circle cx="12" cy="12" r="9"></circle>
            </svg>
        `,
        warning: `
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 9v4"></path>
                <path d="M12 17h.01"></path>
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            </svg>
        `
    };

    const CONFIRM_TONES = new Set(['default', 'danger']);

    let activeConfirm = null;
    let activeKeyHandler = null;

    // Đảm bảo styles.
    function ensureStyles() {
        if (document.getElementById(STYLE_ID)) {
            return;
        }

        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            .global-feedback-toast-root {
                position: fixed;
                top: 88px;
                right: 20px;
                z-index: 10000;
                display: flex;
                flex-direction: column;
                gap: 12px;
                width: min(380px, calc(100vw - 24px));
                pointer-events: none;
            }

            .global-feedback-toast {
                display: grid;
                grid-template-columns: 44px 1fr auto;
                gap: 14px;
                align-items: start;
                padding: 16px 18px;
                border-radius: 24px;
                background: rgba(255, 250, 241, 0.98);
                border: 1px solid rgba(216, 166, 23, 0.2);
                color: #221b0c;
                box-shadow: 0 22px 60px rgba(39, 26, 4, 0.18);
                backdrop-filter: blur(16px);
                pointer-events: auto;
                animation: globalToastEnter 220ms ease forwards;
            }

            .global-feedback-toast[data-type="success"] {
                border-color: rgba(36, 122, 85, 0.22);
            }

            .global-feedback-toast[data-type="error"] {
                border-color: rgba(198, 64, 45, 0.22);
            }

            .global-feedback-toast[data-type="warning"] {
                border-color: rgba(225, 143, 17, 0.22);
            }

            .global-feedback-toast__icon {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 44px;
                height: 44px;
                border-radius: 16px;
                background: #fff4d6;
                color: #221b0c;
            }

            .global-feedback-toast[data-type="success"] .global-feedback-toast__icon {
                background: rgba(36, 122, 85, 0.14);
                color: #247a55;
            }

            .global-feedback-toast[data-type="error"] .global-feedback-toast__icon {
                background: rgba(198, 64, 45, 0.12);
                color: #c6402d;
            }

            .global-feedback-toast[data-type="warning"] .global-feedback-toast__icon {
                background: rgba(225, 143, 17, 0.14);
                color: #e18f11;
            }

            .global-feedback-toast__icon svg,
            .global-feedback-dialog__icon svg {
                width: 20px;
                height: 20px;
                stroke: currentColor;
                stroke-width: 2;
                fill: none;
                stroke-linecap: round;
                stroke-linejoin: round;
            }

            .global-feedback-toast__message {
                padding-top: 2px;
                font-size: 14px;
                line-height: 1.55;
                font-weight: 600;
            }

            .global-feedback-toast__close {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 34px;
                height: 34px;
                border-radius: 999px;
                background: rgba(34, 27, 12, 0.06);
                color: rgba(34, 27, 12, 0.68);
                transition: background-color 180ms ease, color 180ms ease, transform 180ms ease;
            }

            .global-feedback-toast__close:hover {
                background: rgba(34, 27, 12, 0.12);
                color: #221b0c;
                transform: scale(1.03);
            }

            .global-feedback-toast.is-leaving {
                animation: globalToastLeave 180ms ease forwards;
            }

            .global-feedback-dialog-root {
                position: fixed;
                inset: 0;
                z-index: 10020;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 24px;
                pointer-events: none;
                opacity: 0;
                transition: opacity 180ms ease;
            }

            .global-feedback-dialog-root.is-open {
                opacity: 1;
                pointer-events: auto;
            }

            .global-feedback-dialog__backdrop {
                position: absolute;
                inset: 0;
                background: rgba(24, 20, 13, 0.46);
                backdrop-filter: blur(4px);
            }

            .global-feedback-dialog {
                position: relative;
                width: min(520px, 100%);
                padding: 28px;
                border-radius: 32px;
                background:
                    radial-gradient(circle at top right, rgba(242, 201, 76, 0.16), transparent 34%),
                    linear-gradient(180deg, #fffdf8 0%, #fcfaf4 100%);
                border: 1px solid rgba(216, 166, 23, 0.22);
                box-shadow: 0 28px 80px rgba(32, 23, 7, 0.22);
                transform: translateY(16px) scale(0.98);
                transition: transform 180ms ease;
            }

            .global-feedback-dialog-root.is-open .global-feedback-dialog {
                transform: translateY(0) scale(1);
            }

            .global-feedback-dialog__top {
                display: grid;
                grid-template-columns: 56px 1fr;
                gap: 16px;
                align-items: start;
            }

            .global-feedback-dialog__icon {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 56px;
                height: 56px;
                border-radius: 20px;
                background: rgba(34, 27, 12, 0.06);
                color: #221b0c;
            }

            .global-feedback-dialog[data-tone="danger"] .global-feedback-dialog__icon {
                background: rgba(198, 64, 45, 0.12);
                color: #c6402d;
            }

            .global-feedback-dialog__title {
                font-size: clamp(24px, 3vw, 30px);
                line-height: 1.15;
                font-weight: 800;
                letter-spacing: -0.03em;
                color: #18140d;
            }

            .global-feedback-dialog__message {
                margin-top: 10px;
                color: #4f4639;
                font-size: 15px;
                line-height: 1.7;
            }

            .global-feedback-dialog__actions {
                display: flex;
                justify-content: flex-end;
                gap: 12px;
                margin-top: 28px;
            }

            .global-feedback-dialog__button {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                min-width: 122px;
                min-height: 50px;
                padding: 0 22px;
                border-radius: 999px;
                font-size: 14px;
                font-weight: 800;
                letter-spacing: 0.02em;
                transition: transform 180ms ease, box-shadow 180ms ease, background-color 180ms ease, color 180ms ease;
            }

            .global-feedback-dialog__button:hover {
                transform: translateY(-1px);
            }

            .global-feedback-dialog__button--secondary {
                background: rgba(34, 27, 12, 0.06);
                color: #221b0c;
                border: 1px solid rgba(34, 27, 12, 0.08);
            }

            .global-feedback-dialog__button--primary {
                background: #18140d;
                color: #ffffff;
                box-shadow: 0 16px 32px rgba(32, 23, 7, 0.14);
            }

            .global-feedback-dialog[data-tone="danger"] .global-feedback-dialog__button--primary {
                background: #c6402d;
            }

            @keyframes globalToastEnter {
                from {
                    opacity: 0;
                    transform: translate3d(0, -10px, 0) scale(0.98);
                }

                to {
                    opacity: 1;
                    transform: translate3d(0, 0, 0) scale(1);
                }
            }

            @keyframes globalToastLeave {
                from {
                    opacity: 1;
                    transform: translate3d(0, 0, 0) scale(1);
                }

                to {
                    opacity: 0;
                    transform: translate3d(0, -8px, 0) scale(0.98);
                }
            }

            @media (max-width: 768px) {
                .global-feedback-toast-root {
                    left: 12px;
                    right: 12px;
                    top: 72px;
                    width: auto;
                }

                .global-feedback-dialog-root {
                    align-items: end;
                    padding: 12px;
                }

                .global-feedback-dialog {
                    border-radius: 28px 28px 22px 22px;
                    padding: 24px 20px 20px;
                }

                .global-feedback-dialog__top {
                    grid-template-columns: 48px 1fr;
                    gap: 14px;
                }

                .global-feedback-dialog__icon {
                    width: 48px;
                    height: 48px;
                    border-radius: 18px;
                }

                .global-feedback-dialog__actions {
                    flex-direction: column-reverse;
                }

                .global-feedback-dialog__button {
                    width: 100%;
                }
            }
        `;

        document.head.appendChild(style);
    }

    // Tạo vùng chứa toast một lần để các thông báo dùng chung cùng một vị trí.
    function ensureToastContainer() {
        let container = document.getElementById(TOAST_ROOT_ID);
        if (!container) {
            container = document.createElement('div');
            container.id = TOAST_ROOT_ID;
            container.className = 'global-feedback-toast-root';
            document.body.appendChild(container);
        }

        return container;
    }

    // Đảm bảo dialog root.
    function ensureDialogRoot() {
        let root = document.getElementById(DIALOG_ROOT_ID);
        if (!root) {
            root = document.createElement('div');
            root.id = DIALOG_ROOT_ID;
            root.className = 'global-feedback-dialog-root';
            root.innerHTML = `
                <div class="global-feedback-dialog__backdrop" data-dialog-action="dismiss"></div>
                <div class="global-feedback-dialog" role="dialog" aria-modal="true" aria-labelledby="globalDialogTitle" aria-describedby="globalDialogMessage">
                    <div class="global-feedback-dialog__top">
                        <div class="global-feedback-dialog__icon" id="globalDialogIcon"></div>
                        <div>
                            <h3 class="global-feedback-dialog__title" id="globalDialogTitle"></h3>
                            <p class="global-feedback-dialog__message" id="globalDialogMessage"></p>
                        </div>
                    </div>
                    <div class="global-feedback-dialog__actions">
                        <button type="button" class="global-feedback-dialog__button global-feedback-dialog__button--secondary" data-dialog-action="cancel"></button>
                        <button type="button" class="global-feedback-dialog__button global-feedback-dialog__button--primary" data-dialog-action="confirm"></button>
                    </div>
                </div>
            `;
            document.body.appendChild(root);
        }

        return root;
    }

    // Lấy icon markup.
    function getIconMarkup(type) {
        return ICONS[type] || ICONS.info;
    }

    // Xử lý dismiss toast.
    function dismissToast(toast) {
        if (!toast || !toast.parentElement || toast.classList.contains('is-leaving')) {
            return;
        }

        toast.classList.add('is-leaving');
        window.setTimeout(() => {
            toast.remove();
        }, 180);
    }

    // Tạo toast.
    function createToast(message, type = 'info', options = {}) {
        ensureStyles();
        const container = ensureToastContainer();
        const toast = document.createElement('div');
        const normalizedType = ['success', 'error', 'warning', 'info'].includes(type) ? type : 'info';
        const duration = Number.isFinite(options.duration) ? options.duration : 4000;

        toast.className = 'global-feedback-toast';
        toast.dataset.type = normalizedType;
        toast.innerHTML = `
            <div class="global-feedback-toast__icon">${getIconMarkup(normalizedType)}</div>
            <div class="global-feedback-toast__message"></div>
            <button type="button" class="global-feedback-toast__close" aria-label="Đóng thông báo">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M18 6L6 18"></path>
                    <path d="M6 6l12 12"></path>
                </svg>
            </button>
        `;

        toast.querySelector('.global-feedback-toast__message').textContent = String(message || '');
        toast.querySelector('.global-feedback-toast__close').addEventListener('click', () => dismissToast(toast));

        container.appendChild(toast);

        if (duration > 0) {
            window.setTimeout(() => dismissToast(toast), duration);
        }

        return toast;
    }

    // Đóng confirm dialog.
    function closeConfirmDialog(result) {
        if (!activeConfirm) {
            return;
        }

        const { root, resolve } = activeConfirm;
        root.classList.remove('is-open');

        if (activeKeyHandler) {
            document.removeEventListener('keydown', activeKeyHandler);
            activeKeyHandler = null;
        }

        activeConfirm = null;

        window.setTimeout(() => {
            root.remove();
        }, 180);

        resolve(Boolean(result));
    }

    // Xử lý show global confirm.
    function showGlobalConfirm(options = {}) {
        ensureStyles();

        if (activeConfirm) {
            closeConfirmDialog(false);
        }

        const root = ensureDialogRoot();
        const dialog = root.querySelector('.global-feedback-dialog');
        const icon = root.querySelector('#globalDialogIcon');
        const title = root.querySelector('#globalDialogTitle');
        const message = root.querySelector('#globalDialogMessage');
        const cancelButton = root.querySelector('[data-dialog-action="cancel"]');
        const confirmButton = root.querySelector('[data-dialog-action="confirm"]');
        const tone = CONFIRM_TONES.has(options.tone) ? options.tone : 'default';

        dialog.dataset.tone = tone;
        icon.innerHTML = getIconMarkup(tone === 'danger' ? 'warning' : 'info');
        title.textContent = options.title || 'Xác nhận thao tác';
        message.textContent = options.message || 'Bạn có chắc muốn tiếp tục?';
        cancelButton.textContent = options.cancelText || 'Hủy';
        confirmButton.textContent = options.confirmText || 'Đồng ý';

        return new Promise((resolve) => {
            activeConfirm = { root, resolve };

            root.querySelectorAll('[data-dialog-action]').forEach((button) => {
                button.onclick = (event) => {
                    const action = event.currentTarget.dataset.dialogAction;
                    if (action === 'confirm') {
                        closeConfirmDialog(true);
                        return;
                    }

                    closeConfirmDialog(false);
                };
            });

            activeKeyHandler = (event) => {
                if (event.key === 'Escape') {
                    closeConfirmDialog(false);
                    return;
                }

                if (event.key === 'Enter') {
                    const activeElement = document.activeElement;
                    if (activeElement === cancelButton) {
                        return;
                    }

                    event.preventDefault();
                    closeConfirmDialog(true);
                }
            };
            document.addEventListener('keydown', activeKeyHandler);

            requestAnimationFrame(() => {
                root.classList.add('is-open');
                confirmButton.focus();
            });
        });
    }

    window.showGlobalToast = createToast;
    window.showGlobalConfirm = showGlobalConfirm;

    if (typeof window.showToast === 'undefined') {
        window.showToast = createToast;
    }

    if (typeof window.showNotification === 'undefined') {
        window.showNotification = createToast;
    }
})();
