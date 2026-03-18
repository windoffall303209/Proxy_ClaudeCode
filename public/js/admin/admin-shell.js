let adminSavedScrollY = 0;

function initAdminMobileMenu() {
    const button = document.getElementById('adminMobileMenuBtn');
    const sidebar = document.getElementById('adminSidebar');
    const overlay = document.getElementById('adminMobileOverlay');

    if (!button || !sidebar || button.dataset.initialized === 'true') {
        return;
    }

    button.dataset.initialized = 'true';

    function openMenu() {
        adminSavedScrollY = window.scrollY;
        button.classList.add('active');
        sidebar.classList.add('active');
        overlay?.classList.add('active');
        document.body.classList.add('admin-menu-open');
        document.body.style.top = `-${adminSavedScrollY}px`;
    }

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

document.addEventListener('DOMContentLoaded', initAdminMobileMenu);
