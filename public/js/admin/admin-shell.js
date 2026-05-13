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
document.addEventListener('DOMContentLoaded', () => {
    initAdminMobileMenu();
    initAdminNoticeToast();
});
