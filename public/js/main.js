// Điều phối tương tác trình duyệt cho tương tác chung, tách khỏi template EJS.
const mainState = window.__tmdtMainState || (window.__tmdtMainState = {
    initialized: false,
    cartCountRequest: null,
    productCardActionsBound: false
});

// Thêm vào giỏ hàng.
async function addToCart(eventOrProductId, productId = null, variantId = null, quantity = 1) {
    let actualProductId;
    let actualVariantId;
    let actualQuantity = quantity;

    if (eventOrProductId && typeof eventOrProductId === 'object' && eventOrProductId.preventDefault) {
        eventOrProductId.preventDefault();
        eventOrProductId.stopPropagation();
        actualProductId = productId;
        actualVariantId = variantId;
    } else {
        actualProductId = eventOrProductId;
        actualVariantId = productId;
        if (typeof variantId === 'number' && variantId > 0) {
            actualQuantity = variantId;
        }
    }

    if (!actualProductId) {
        showNotification('Không tìm thấy sản phẩm', 'error');
        return;
    }

    try {
        const response = await fetch('/cart/add', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'same-origin',
            body: JSON.stringify({
                product_id: actualProductId,
                variant_id: actualVariantId,
                quantity: actualQuantity
            })
        });

        const data = await response.json();

        if (data.success) {
            updateCartCount();
            showNotification(data.message || 'Đã thêm vào giỏ hàng!', 'success');
        } else if (data.requiresLogin && data.loginUrl) {
            showNotification(data.message || 'Vui lòng đăng nhập để sử dụng chức năng này.', 'warning');
            window.setTimeout(() => {
                window.location.href = data.loginUrl;
            }, 900);
        } else if (data.requiresEmailVerification && data.loginUrl) {
            showNotification(data.message || 'Vui lòng xác thực email trước khi tiếp tục.', 'warning');
            window.setTimeout(() => {
                window.location.href = data.loginUrl;
            }, 900);
        } else if (data.requiresVariant && data.productUrl) {
            showNotification(data.message || 'Vui lòng chọn phân loại sản phẩm.', 'warning');
            window.setTimeout(() => {
                window.location.href = data.productUrl;
            }, 900);
        } else {
            showNotification(data.message || 'Có lỗi xảy ra', 'error');
        }
    } catch (error) {
        console.error('Add to cart error:', error);
        showNotification('Có lỗi xảy ra khi thêm vào giỏ hàng', 'error');
    }
}

// Cập nhật giỏ hàng count.
async function updateCartCount() {
    const cartCountElement = document.getElementById('cart-count');
    if (!cartCountElement) {
        return;
    }

    if (mainState.cartCountRequest) {
        return mainState.cartCountRequest;
    }

    mainState.cartCountRequest = (async () => {
        try {
            const response = await fetch('/cart/count', {
                credentials: 'same-origin'
            });
            const data = await response.json();

            cartCountElement.textContent = data.count || 0;
        } catch (error) {
            console.error('Update cart count error:', error);
        } finally {
            mainState.cartCountRequest = null;
        }
    })();

    return mainState.cartCountRequest;
}

// Xử lý show notification.
function showNotification(message, type = 'info') {
    if (typeof showGlobalToast === 'function') {
        showGlobalToast(message, type);
    }
}

// Xử lý run when browser idle.
function runWhenBrowserIdle(callback, fallbackDelay = 250) {
    if (typeof callback !== 'function') {
        return;
    }

    if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(() => callback(), { timeout: 1500 });
        return;
    }

    window.setTimeout(callback, fallbackDelay);
}

// Khởi tạo header scroll state.
function initHeaderScrollState() {
    const header = document.querySelector('.header');
    if (!header) {
        return;
    }

    const root = document.documentElement;

    // Xử lý apply state.
    const applyState = () => {
        header.classList.toggle('header--scrolled', window.scrollY > 32);
        root.style.setProperty('--live-header-height', `${Math.round(header.getBoundingClientRect().height)}px`);
    };

    let ticking = false;
    // Xử lý on scroll.
    const onScroll = () => {
        if (ticking) {
            return;
        }

        ticking = true;
        window.requestAnimationFrame(() => {
            applyState();
            ticking = false;
        });
    };

    applyState();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', applyState);
}

// Khởi tạo desktop danh mục dropdowns.
function initDesktopCategoryDropdowns() {
    const navItems = Array.from(document.querySelectorAll('.main-nav__item--has-dropdown'));
    if (!navItems.length) {
        return;
    }

    const hoverMedia = window.matchMedia('(hover: hover) and (pointer: fine)');
    const openDelay = 70;
    const closeDelay = 220;

    // Xử lý clear timers.
    const clearTimers = (item) => {
        if (item._dropdownOpenTimer) {
            window.clearTimeout(item._dropdownOpenTimer);
            item._dropdownOpenTimer = null;
        }

        if (item._dropdownCloseTimer) {
            window.clearTimeout(item._dropdownCloseTimer);
            item._dropdownCloseTimer = null;
        }
    };

    // Đóng item.
    const closeItem = (item) => {
        if (!item) {
            return;
        }

        item.classList.remove('is-open');
        const trigger = item.querySelector('.main-nav__trigger[aria-expanded]');
        if (trigger) {
            trigger.setAttribute('aria-expanded', 'false');
        }
    };

    // Mở item.
    const openItem = (item) => {
        navItems.forEach((navItem) => {
            if (navItem !== item) {
                clearTimers(navItem);
                closeItem(navItem);
            }
        });

        item.classList.add('is-open');
        const trigger = item.querySelector('.main-nav__trigger[aria-expanded]');
        if (trigger) {
            trigger.setAttribute('aria-expanded', 'true');
        }
    };

    // Lên lịch open.
    const scheduleOpen = (item) => {
        if (!hoverMedia.matches) {
            return;
        }

        clearTimers(item);
        item._dropdownOpenTimer = window.setTimeout(() => {
            openItem(item);
        }, openDelay);
    };

    // Lên lịch close.
    const scheduleClose = (item) => {
        clearTimers(item);
        item._dropdownCloseTimer = window.setTimeout(() => {
            closeItem(item);
        }, closeDelay);
    };

    navItems.forEach((item) => {
        const trigger = item.querySelector('.main-nav__trigger');
        const dropdown = item.querySelector('.main-nav__dropdown');
        if (!trigger || !dropdown) {
            return;
        }
        item.addEventListener('pointerenter', () => {
            scheduleOpen(item);
        });
        item.addEventListener('pointerleave', () => {
            if (!hoverMedia.matches) {
                closeItem(item);
                return;
            }

            scheduleClose(item);
        });
        item.addEventListener('focusin', () => {
            clearTimers(item);
            openItem(item);
        });
        item.addEventListener('focusout', (event) => {
            if (item.contains(event.relatedTarget)) {
                return;
            }

            scheduleClose(item);
        });
        item.addEventListener('keydown', (event) => {
            if (event.key !== 'Escape') {
                return;
            }

            clearTimers(item);
            closeItem(item);
            trigger.focus();
        });
    });

    // Đồng bộ hover mode.
    const syncHoverMode = () => {
        if (hoverMedia.matches) {
            return;
        }

        navItems.forEach((item) => {
            clearTimers(item);
            closeItem(item);
        });
    };

    if (typeof hoverMedia.addEventListener === 'function') {
        hoverMedia.addEventListener('change', syncHoverMode);
    } else if (typeof hoverMedia.addListener === 'function') {
        hoverMedia.addListener(syncHoverMode);
    }
    window.addEventListener('resize', syncHoverMode);
}

// Khởi tạo sản phẩm card actions.
function initProductCardActions() {
    if (mainState.productCardActionsBound) {
        return;
    }

    mainState.productCardActionsBound = true;
    document.addEventListener('click', (event) => {
        const quickAddButton = event.target.closest('.product-card__quick-add');
        if (!quickAddButton) {
            return;
        }

        const { productId } = quickAddButton.dataset;
        if (!productId || quickAddButton.disabled) {
            return;
        }

        addToCart(event, Number(productId));
    });
}
document.addEventListener('DOMContentLoaded', () => {
    if (mainState.initialized) {
        return;
    }

    mainState.initialized = true;

    initMobileMenu();
    initHeaderScrollState();
    initDesktopCategoryDropdowns();

    runWhenBrowserIdle(() => {
        updateCartCount();
        initNewsletterForm();
    });

    initProductCardActions();
});

// Khởi tạo mobile menu.
function initMobileMenu() {
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const mobileNav = document.getElementById('mobileNav');
    const mobileNavOverlay = document.getElementById('mobileNavOverlay');
    const mobileNavClose = document.getElementById('mobileNavClose');

    if (!mobileMenuBtn || !mobileNav || !mobileNavOverlay) return;
    if (mobileMenuBtn.dataset.initialized) return;
    mobileMenuBtn.dataset.initialized = 'true';

    // Mở mobile menu.
    function openMobileMenu() {
        mobileMenuBtn.classList.add('active');
        mobileNav.classList.add('active');
        mobileNavOverlay.classList.add('active');
        document.body.classList.add('mobile-menu-open');
    }

    // Đóng mobile menu.
    function closeMobileMenu() {
        mobileMenuBtn.classList.remove('active');
        mobileNav.classList.remove('active');
        mobileNavOverlay.classList.remove('active');
        document.body.classList.remove('mobile-menu-open');
    }
    mobileMenuBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (mobileNav.classList.contains('active')) {
            closeMobileMenu();
        } else {
            openMobileMenu();
        }
    });

    if (mobileNavClose) {
        mobileNavClose.addEventListener('click', closeMobileMenu);
    }
    mobileNavOverlay.addEventListener('click', closeMobileMenu);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && mobileNav.classList.contains('active')) {
            closeMobileMenu();
        }
    });

    const mobileNavLinks = mobileNav.querySelectorAll('a');
    mobileNavLinks.forEach((link) => {
        link.addEventListener('click', closeMobileMenu);
    });

    const mobileNavForms = mobileNav.querySelectorAll('form');
    mobileNavForms.forEach((form) => {
        form.addEventListener('submit', closeMobileMenu);
    });

    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            if (window.innerWidth > 960 && mobileNav.classList.contains('active')) {
                closeMobileMenu();
            }
        }, 100);
    });
}

// Khởi tạo newsletter form.
function initNewsletterForm() {
    const form = document.getElementById('newsletter-form');
    const successMsg = document.getElementById('newsletter-success');
    const errorMsg = document.getElementById('newsletter-error');
    const dismissButton = document.querySelector('.newsletter-dismiss');

    if (!form) return;

    checkNewsletterStatus();

    dismissButton?.addEventListener('click', dismissNewsletterBanner);
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const emailInput = document.getElementById('newsletter-email');
        const submitBtn = document.getElementById('newsletter-btn');
        const email = emailInput.value.trim();

        if (!email) return;

        submitBtn.disabled = true;
        submitBtn.textContent = 'Đang xử lý...';

        try {
            const response = await fetch('/newsletter/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            const data = await response.json();

            if (data.success) {
                form.hidden = true;
                if (successMsg) successMsg.hidden = false;
                if (errorMsg) errorMsg.hidden = true;

                localStorage.setItem('newsletter_subscribed', 'true');
                localStorage.setItem('newsletter_email', email);
            } else {
                if (errorMsg) {
                    errorMsg.textContent = data.message;
                    errorMsg.hidden = false;
                }
                showNotification(data.message, 'error');
                submitBtn.disabled = false;
                submitBtn.textContent = 'Đăng ký ngay';
            }
        } catch (error) {
            console.error('Newsletter error:', error);
            showNotification('Đã xảy ra lỗi. Vui lòng thử lại.', 'error');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Đăng ký ngay';
        }
    });
}

// Xử lý check newsletter trạng thái.
async function checkNewsletterStatus() {
    const form = document.getElementById('newsletter-form');
    const successMsg = document.getElementById('newsletter-success');
    const newsletterSection = document.getElementById('newsletter-section');
    const isAuthenticated = document.body?.dataset.userAuthenticated === 'true';

    if (!form || !successMsg || !newsletterSection) return;

    if (localStorage.getItem('newsletter_subscribed') === 'true') {
        form.hidden = true;
        successMsg.hidden = false;
        return;
    }

    const dismissedTime = localStorage.getItem('newsletter_dismissed_at');
    if (dismissedTime) {
        const timeSinceDismissed = Date.now() - parseInt(dismissedTime, 10);
        const twelveHours = 12 * 60 * 60 * 1000;

        if (timeSinceDismissed < twelveHours) {
            newsletterSection.hidden = true;
            return;
        }

        localStorage.removeItem('newsletter_dismissed_at');
    }

    const hasSeenBanner = sessionStorage.getItem('newsletter_banner_seen');
    if (!hasSeenBanner) {
        sessionStorage.setItem('newsletter_banner_seen', 'true');
        if (!localStorage.getItem('newsletter_first_shown')) {
            localStorage.setItem('newsletter_first_shown', Date.now().toString());
        }
    }

    if (!isAuthenticated) {
        return;
    }

    try {
        const response = await fetch('/newsletter/status', {
            credentials: 'same-origin'
        });
        const data = await response.json();

        if (data.subscribed) {
            form.hidden = true;
            successMsg.hidden = false;
            localStorage.setItem('newsletter_subscribed', 'true');
        }
    } catch (error) {
        return;
    }
}

// Xử lý dismiss newsletter banner.
function dismissNewsletterBanner() {
    const newsletterSection = document.getElementById('newsletter-section');
    if (newsletterSection) {
        newsletterSection.hidden = true;
        localStorage.setItem('newsletter_dismissed_at', Date.now().toString());
    }
}
