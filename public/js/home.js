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
});
