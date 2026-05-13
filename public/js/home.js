// Điều phối tương tác trang chủ, gồm layout động, popup banner và carousel hero.

const POPUP_BANNER_STORAGE_PREFIX = 'popupBanner:lastSeen:';
const DEFAULT_POPUP_BANNER_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/**
 * Ghi biến CSS số cột từ cấu hình storefront nếu giá trị hợp lệ.
 */
function setHomeLayoutVariable(name, value) {
    const parsedValue = Number.parseInt(value, 10);
    if (Number.isFinite(parsedValue) && parsedValue > 0) {
        document.documentElement.style.setProperty(name, String(parsedValue));
    }
}

/**
 * Đồng bộ cấu hình layout do EJS render vào CSS variables để tránh inline style.
 */
function applyHomeLayoutVariables(root = document) {
    const layoutSource = root.querySelector('[data-home-layout]');
    if (!layoutSource) {
        return;
    }

    setHomeLayoutVariable('--storefront-home-product-columns', layoutSource.dataset.productColumns);
    setHomeLayoutVariable('--storefront-home-product-columns-tablet', layoutSource.dataset.productColumnsTablet);
    setHomeLayoutVariable('--storefront-home-category-columns', layoutSource.dataset.categoryColumns);
    setHomeLayoutVariable('--storefront-home-category-columns-tablet', layoutSource.dataset.categoryColumnsTablet);
}

/**
 * Lấy popup banner hiện tại nếu trang chủ có cấu hình banner bật lên.
 */
function getPopupBannerElement() {
    return document.getElementById('popupBanner');
}

/**
 * Tạo key localStorage theo từng banner để banner mới không bị ẩn bởi trạng thái banner cũ.
 */
function getPopupBannerStorageKey(popupBanner) {
    const bannerKey = popupBanner?.dataset.popupBannerKey || 'default';
    return `${POPUP_BANNER_STORAGE_PREFIX}${bannerKey}`;
}

function getPopupBannerCooldownMs(popupBanner) {
    const hours = Number.parseInt(popupBanner?.dataset.popupCooldownHours, 10);
    if (!Number.isInteger(hours) || hours <= 0) {
        return DEFAULT_POPUP_BANNER_COOLDOWN_MS;
    }

    return hours * 60 * 60 * 1000;
}

/**
 * Đọc thời điểm người dùng đã thấy popup, trả null khi localStorage lỗi hoặc dữ liệu không hợp lệ.
 */
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

/**
 * Lưu thời điểm popup đã hiển thị để giới hạn tần suất xuất hiện.
 */
function writePopupBannerTimestamp(storageKey, timestamp) {
    try {
        window.localStorage.setItem(storageKey, String(timestamp));
    } catch (error) {
        console.warn('Cannot persist popup banner state:', error);
    }
}

/**
 * Xóa timestamp cũ khi hết thời gian cooldown để banner có thể hiển thị lại.
 */
function removePopupBannerTimestamp(storageKey) {
    try {
        window.localStorage.removeItem(storageKey);
    } catch (error) {
        console.warn('Cannot clear popup banner state:', error);
    }
}

/**
 * Quyết định có ẩn popup hay không dựa trên cooldown localStorage.
 */
function shouldHidePopupBanner(popupBanner) {
    if (!popupBanner) return true;

    const storageKey = getPopupBannerStorageKey(popupBanner);
    const lastSeenAt = readPopupBannerTimestamp(storageKey);
    if (!lastSeenAt) {
        return false;
    }

    const age = Date.now() - lastSeenAt;
    if (age < getPopupBannerCooldownMs(popupBanner)) {
        return true;
    }

    removePopupBannerTimestamp(storageKey);
    return false;
}

/**
 * Đánh dấu banner đã được nhìn thấy ngay khi hiển thị hoặc khi người dùng đóng popup.
 */
function markPopupBannerAsSeen(popupBanner) {
    if (!popupBanner) return;
    writePopupBannerTimestamp(getPopupBannerStorageKey(popupBanner), Date.now());
}

/**
 * Đóng popup banner và ghi lại trạng thái để các lần tải trang sau không hiện lại quá sớm.
 */
function closePopup() {
    const popupBanner = getPopupBannerElement();
    if (!popupBanner) return;

    popupBanner.hidden = true;
    markPopupBannerAsSeen(popupBanner);
}
document.addEventListener('DOMContentLoaded', function() {
    applyHomeLayoutVariables(document);

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

    // Carousel hero chỉ khởi tạo khi có từ hai slide để tránh timer thừa.
    const carousel = document.getElementById('heroCarousel');
    if (!carousel) return;

    const slides = carousel.querySelectorAll('.hero-carousel__slide');
    const dots = carousel.querySelectorAll('.hero-carousel__dot');
    if (slides.length <= 1) return;

    let currentIndex = 0;
    let autoSlideTimer = null;

    // Chuyển slide theo vòng lặp để nút trước/sau không vượt biên.
    function goToSlide(index) {
        slides[currentIndex].classList.remove('is-active');
        if (dots[currentIndex]) dots[currentIndex].classList.remove('is-active');

        currentIndex = (index + slides.length) % slides.length;

        slides[currentIndex].classList.add('is-active');
        if (dots[currentIndex]) dots[currentIndex].classList.add('is-active');
    }

    // Bắt đầu auto-slide sau khi đã xóa timer cũ.
    function startAutoSlide() {
        stopAutoSlide();
        autoSlideTimer = setInterval(() => goToSlide(currentIndex + 1), 5000);
    }

    // Dừng auto-slide khi hover hoặc trước khi tạo timer mới.
    function stopAutoSlide() {
        if (autoSlideTimer) {
            clearInterval(autoSlideTimer);
            autoSlideTimer = null;
        }
    }

    // Nút điều hướng thủ công đồng thời khởi động lại chu kỳ tự chạy.
    carousel.querySelector('[data-carousel="prev"]')?.addEventListener('click', () => {
        goToSlide(currentIndex - 1);
        startAutoSlide();
    });

    carousel.querySelector('[data-carousel="next"]')?.addEventListener('click', () => {
        goToSlide(currentIndex + 1);
        startAutoSlide();
    });

    // Dot chuyển thẳng tới slide tương ứng theo data attribute.
    dots.forEach((dot) => {
        dot.addEventListener('click', () => {
            goToSlide(parseInt(dot.dataset.carouselDot, 10));
            startAutoSlide();
        });
    });

    // Dừng auto-slide khi hover để người dùng đọc nội dung banner.
    carousel.addEventListener('mouseenter', stopAutoSlide);
    carousel.addEventListener('mouseleave', startAutoSlide);

    startAutoSlide();
});
