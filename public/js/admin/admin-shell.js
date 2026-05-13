// Điều phối tương tác trình duyệt cho màn quản trị khung giao diện trong khu vực admin.
let adminSavedScrollY = 0;

// Khởi tạo quản trị mobile menu.
function initAdminMobileMenu() {
    const button = document.getElementById('adminMobileMenuBtn');
    const sidebar = document.getElementById('adminSidebar');
    const overlay = document.getElementById('adminMobileOverlay');

    if (!button || !sidebar || button.dataset.initialized === 'true') {
        return;
    }

    button.dataset.initialized = 'true';

    // Mở menu.
    function openMenu() {
        adminSavedScrollY = window.scrollY;
        button.classList.add('active');
        sidebar.classList.add('active');
        overlay?.classList.add('active');
        document.body.classList.add('admin-menu-open');
        document.body.style.top = `-${adminSavedScrollY}px`;
    }

    // Đóng menu.
    function closeMenu() {
        button.classList.remove('active');
        sidebar.classList.remove('active');
        overlay?.classList.remove('active');
        document.body.classList.remove('admin-menu-open');
        document.body.style.top = '';
        window.scrollTo(0, adminSavedScrollY);
    }
    button.addEventListener('click', () => {
        if (sidebar.classList.contains('active')) {
            closeMenu();
        } else {
            openMenu();
        }
    });

    overlay?.addEventListener('click', closeMenu);
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeMenu();
        }
    });
    window.addEventListener('resize', () => {
        if (window.innerWidth > 1100) {
            closeMenu();
        }
    });
}

// Khởi tạo quản trị notice toast.
function initAdminNoticeToast() {
    const params = new URLSearchParams(window.location.search);
    const notice = params.get('notice');

    if (!notice || typeof showGlobalToast !== 'function') {
        return;
    }

    const type = params.get('notice_type') || 'info';
    showGlobalToast(notice, type);

    params.delete('notice');
    params.delete('notice_type');

    const nextUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}${window.location.hash || ''}`;
    window.history.replaceState({}, '', nextUrl);
}

function ensureAdminOtpModal() {
    let modal = document.getElementById('adminOtpModal');
    if (modal) {
        return modal;
    }

    modal = document.createElement('div');
    modal.id = 'adminOtpModal';
    modal.className = 'admin-otp-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'adminOtpModalTitle');
    modal.innerHTML = `
        <div class="admin-otp-modal__content">
            <div class="admin-otp-modal__icon" aria-hidden="true">
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
            </div>
            <div class="admin-otp-modal__text">
                <h3 id="adminOtpModalTitle"></h3>
                <p id="adminOtpModalMessage"></p>
            </div>
            <label class="admin-otp-modal__label" for="adminOtpModalInput"></label>
            <input id="adminOtpModalInput" class="admin-otp-modal__input" type="text" inputmode="numeric" autocomplete="one-time-code" spellcheck="false">
            <small id="adminOtpModalHint" class="admin-otp-modal__hint"></small>
            <div class="admin-otp-modal__buttons">
                <button type="button" class="admin-btn admin-btn--ghost" id="adminOtpModalCancel">Hủy</button>
                <button type="button" class="admin-btn admin-btn--primary" id="adminOtpModalConfirm">Xác nhận</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    return modal;
}

window.showAdminOtpModal = function showAdminOtpModal(options = {}) {
    return new Promise((resolve) => {
        const modal = ensureAdminOtpModal();
        const title = modal.querySelector('#adminOtpModalTitle');
        const message = modal.querySelector('#adminOtpModalMessage');
        const label = modal.querySelector('.admin-otp-modal__label');
        const input = modal.querySelector('#adminOtpModalInput');
        const hint = modal.querySelector('#adminOtpModalHint');
        const cancelButton = modal.querySelector('#adminOtpModalCancel');
        const confirmButton = modal.querySelector('#adminOtpModalConfirm');
        const email = options.email || 'email mặc định';

        const closeModal = (value) => {
            modal.classList.remove('is-open');
            document.body.classList.remove('admin-modal-open');
            input.value = '';
            hint.textContent = '';
            confirmButton.disabled = false;
            modal.onclick = null;
            cancelButton.onclick = null;
            confirmButton.onclick = null;
            input.oninput = null;
            input.onkeydown = null;
            document.removeEventListener('keydown', handleEscape);
            resolve(value);
        };

        const handleEscape = (event) => {
            if (event.key === 'Escape') {
                closeModal(null);
            }
        };

        title.textContent = options.title || 'Nhập mã xác thực';
        message.textContent = options.message || `Mã xác thực đã được gửi tới ${email}.`;
        label.textContent = options.label || `Nhập mã xác thực vừa gửi tới ${email}:`;
        input.placeholder = options.placeholder || 'Nhập mã xác thực';
        confirmButton.textContent = options.confirmText || 'Xác nhận';
        cancelButton.textContent = options.cancelText || 'Hủy';

        input.oninput = () => {
            hint.textContent = input.value.trim() ? '' : 'Vui lòng nhập mã xác thực để tiếp tục.';
        };
        input.onkeydown = (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                confirmButton.click();
            }
        };
        cancelButton.onclick = () => closeModal(null);
        confirmButton.onclick = () => {
            const code = input.value.trim();
            if (!code) {
                hint.textContent = 'Vui lòng nhập mã xác thực để tiếp tục.';
                input.focus();
                return;
            }

            closeModal(code);
        };
        modal.onclick = (event) => {
            if (event.target === modal) {
                closeModal(null);
            }
        };

        modal.classList.add('is-open');
        document.body.classList.add('admin-modal-open');
        document.addEventListener('keydown', handleEscape);
        window.setTimeout(() => input.focus(), 0);
    });
};

document.addEventListener('DOMContentLoaded', () => {
    initAdminMobileMenu();
    initAdminNoticeToast();
});
