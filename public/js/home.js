// Home page JavaScript
// Extracted from views/home/index.ejs

/**
 * Close the popup banner
 */
function closePopup() {
    const popupBanner = document.getElementById('popupBanner');
    if (popupBanner) {
        popupBanner.hidden = true;
        sessionStorage.setItem('bannerClosed', 'true');
    }
}

// Auto-close if already dismissed in this session
document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('[data-popup-close]').forEach((element) => {
        element.addEventListener('click', closePopup);
    });

    if (sessionStorage.getItem('bannerClosed')) {
        const popupBanner = document.getElementById('popupBanner');
        if (popupBanner) {
            popupBanner.hidden = true;
        }
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
