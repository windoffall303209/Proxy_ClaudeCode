const mainState = window.__tmdtMainState || (window.__tmdtMainState = {
    initialized: false,
    cartCountRequest: null,
    productCardActionsBound: false
});

async function addToCart(eventOrProductId, productId = null, variantId = null) {
    let actualProductId;
    let actualVariantId;

    if (eventOrProductId && typeof eventOrProductId === 'object' && eventOrProductId.preventDefault) {
        eventOrProductId.preventDefault();
        eventOrProductId.stopPropagation();
        actualProductId = productId;
        actualVariantId = variantId;
    } else {
        actualProductId = eventOrProductId;
        actualVariantId = productId;
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
                quantity: 1
            })
        });

        const data = await response.json();

        if (data.success) {
            updateCartCount();
            showNotification(data.message || 'Đã thêm vào giỏ hàng!', 'success');
        } else {
            showNotification(data.message || 'Có lỗi xảy ra', 'error');
        }
    } catch (error) {
        console.error('Add to cart error:', error);
        showNotification('Có lỗi xảy ra khi thêm vào giỏ hàng', 'error');
    }
}

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

function showNotification(message, type = 'info') {
    if (typeof showGlobalToast === 'function') {
        showGlobalToast(message, type);
    }
}

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

function initHeaderScrollState() {
    const header = document.querySelector('.header');
    if (!header) {
        return;
    }

    const applyState = () => {
        header.classList.toggle('header--scrolled', window.scrollY > 32);
    };

    let ticking = false;
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

    runWhenBrowserIdle(() => {
        updateCartCount();
        initNewsletterForm();
    });

    initProductCardActions();
});

function initMobileMenu() {
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const mobileNav = document.getElementById('mobileNav');
    const mobileNavOverlay = document.getElementById('mobileNavOverlay');
    const mobileNavClose = document.getElementById('mobileNavClose');

    if (!mobileMenuBtn || !mobileNav || !mobileNavOverlay) return;
    if (mobileMenuBtn.dataset.initialized) return;
    mobileMenuBtn.dataset.initialized = 'true';

    function openMobileMenu() {
        mobileMenuBtn.classList.add('active');
        mobileNav.classList.add('active');
        mobileNavOverlay.classList.add('active');
        document.body.classList.add('mobile-menu-open');
    }

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

function dismissNewsletterBanner() {
    const newsletterSection = document.getElementById('newsletter-section');
    if (newsletterSection) {
        newsletterSection.hidden = true;
        localStorage.setItem('newsletter_dismissed_at', Date.now().toString());
    }
}
