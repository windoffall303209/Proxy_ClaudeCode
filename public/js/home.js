// Home page JavaScript
// Extracted from views/home/index.ejs

const POPUP_BANNER_STORAGE_PREFIX = 'popupBanner:lastSeen:';
const POPUP_BANNER_COOLDOWN_MS = 6 * 60 * 60 * 1000;

function getPopupBannerElement() {
    return document.getElementById('popupBanner');
}

function getPopupBannerStorageKey(popupBanner) {
    const bannerKey = popupBanner?.dataset.popupBannerKey || 'default';
    return `${POPUP_BANNER_STORAGE_PREFIX}${bannerKey}`;
}

function readPopupBannerTimestamp(storageKey) {
    try {
        const rawValue = window.localStorage.getItem(storageKey);
        if (!rawValue) return null;

        const timestamp = Number(rawValue);
        return Number.isFinite(timestamp) ? timestamp : null;
    } catch (error) {
        console.warn('Cannot read popup banner state:', error);
        return null;
    }
}

function writePopupBannerTimestamp(storageKey, timestamp) {
    try {
        window.localStorage.setItem(storageKey, String(timestamp));
    } catch (error) {
        console.warn('Cannot persist popup banner state:', error);
    }
}

function removePopupBannerTimestamp(storageKey) {
    try {
        window.localStorage.removeItem(storageKey);
    } catch (error) {
        console.warn('Cannot clear popup banner state:', error);
    }
}

function shouldHidePopupBanner(popupBanner) {
    if (!popupBanner) return true;

    const storageKey = getPopupBannerStorageKey(popupBanner);
    const lastSeenAt = readPopupBannerTimestamp(storageKey);
    if (!lastSeenAt) {
        return false;
    }

    const age = Date.now() - lastSeenAt;
    if (age < POPUP_BANNER_COOLDOWN_MS) {
        return true;
    }

    removePopupBannerTimestamp(storageKey);
    return false;
}

function markPopupBannerAsSeen(popupBanner) {
    if (!popupBanner) return;
    writePopupBannerTimestamp(getPopupBannerStorageKey(popupBanner), Date.now());
}

function closePopup() {
    const popupBanner = getPopupBannerElement();
    if (!popupBanner) return;

    popupBanner.hidden = true;
    markPopupBannerAsSeen(popupBanner);
}

document.addEventListener('DOMContentLoaded', function() {
    const popupBanner = getPopupBannerElement();

    document.querySelectorAll('[data-popup-close]').forEach((element) => {
        element.addEventListener('click', closePopup);
    });

    if (popupBanner) {
        if (shouldHidePopupBanner(popupBanner)) {
            popupBanner.hidden = true;
        } else {
            popupBanner.hidden = false;
            markPopupBannerAsSeen(popupBanner);
        }

        window.addEventListener('storage', (event) => {
            if (event.key === getPopupBannerStorageKey(popupBanner) && event.newValue) {
                popupBanner.hidden = true;
            }
        });
    }

    // =========================================================================
    // HERO BANNER CAROUSEL
    // =========================================================================
    const carousel = document.getElementById('heroCarousel');
    if (!carousel) return;

    const slides = carousel.querySelectorAll('.hero-carousel__slide');
    const dots = carousel.querySelectorAll('.hero-carousel__dot');
    if (slides.length <= 1) return;

    let currentIndex = 0;
    let autoSlideTimer = null;

    function goToSlide(index) {
        slides[currentIndex].classList.remove('is-active');
        if (dots[currentIndex]) dots[currentIndex].classList.remove('is-active');

        currentIndex = (index + slides.length) % slides.length;

        slides[currentIndex].classList.add('is-active');
        if (dots[currentIndex]) dots[currentIndex].classList.add('is-active');
    }

    function startAutoSlide() {
        stopAutoSlide();
        autoSlideTimer = setInterval(() => goToSlide(currentIndex + 1), 5000);
    }

    function stopAutoSlide() {
        if (autoSlideTimer) {
            clearInterval(autoSlideTimer);
            autoSlideTimer = null;
        }
    }

    // Prev/Next buttons
    carousel.querySelector('[data-carousel="prev"]')?.addEventListener('click', () => {
        goToSlide(currentIndex - 1);
        startAutoSlide();
    });

    carousel.querySelector('[data-carousel="next"]')?.addEventListener('click', () => {
        goToSlide(currentIndex + 1);
        startAutoSlide();
    });

    // Dot indicators
    dots.forEach((dot) => {
        dot.addEventListener('click', () => {
            goToSlide(parseInt(dot.dataset.carouselDot, 10));
            startAutoSlide();
        });
    });

    // Pause on hover
    carousel.addEventListener('mouseenter', stopAutoSlide);
    carousel.addEventListener('mouseleave', startAutoSlide);

    startAutoSlide();
});
