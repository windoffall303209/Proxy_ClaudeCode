// Điều phối tương tác trình duyệt cho sản phẩm chi tiết, tách khỏi template EJS.
const productDetailState = {
    currentImageIndex: 0,
    productImages: [],
    selectedColor: null,
    selectedSize: null,
    selectedVariantId: null,
    bootstrap: null
};

// Xử lý vào numeric giá.
function toNumericPrice(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

// Định dạng currency.
function formatCurrency(value) {
    return `${toNumericPrice(value).toLocaleString('vi-VN')}đ`;
}

// Xử lý read sản phẩm chi tiết bootstrap.
function readProductDetailBootstrap() {
    if (productDetailState.bootstrap) {
        return productDetailState.bootstrap;
    }

    const bootstrapElement = document.getElementById('productDetailBootstrap');
    if (!bootstrapElement?.textContent) {
        productDetailState.bootstrap = {};
        return productDetailState.bootstrap;
    }

    try {
        productDetailState.bootstrap = JSON.parse(bootstrapElement.textContent);
        productDetailState.bootstrap.baseCurrentPrice = toNumericPrice(productDetailState.bootstrap.baseCurrentPrice);
        productDetailState.bootstrap.baseOriginalPrice = toNumericPrice(productDetailState.bootstrap.baseOriginalPrice);
        productDetailState.bootstrap.productStock = toNumericPrice(productDetailState.bootstrap.productStock);
        productDetailState.bootstrap.variants = Array.isArray(productDetailState.bootstrap.variants)
            ? productDetailState.bootstrap.variants.map((variant) => ({
                ...variant,
                additional_price: toNumericPrice(variant.additional_price),
                stock_quantity: toNumericPrice(variant.stock_quantity)
            }))
            : [];
    } catch (error) {
        console.error('Product detail bootstrap parse error:', error);
        productDetailState.bootstrap = {};
    }

    return productDetailState.bootstrap;
}

// Chuẩn hóa ảnh url.
function normalizeImageUrl(imageUrl) {
    if (!imageUrl) return '';

    try {
        return new URL(imageUrl, window.location.origin).href;
    } catch (error) {
        return String(imageUrl);
    }
}

// Lấy main ảnh element.
function getMainImageElement() {
    return document.getElementById('mainImage');
}

// Lấy fallback element.
function getFallbackElement() {
    return document.getElementById('fallbackIcon');
}

// Xử lý show main ảnh.
function showMainImage() {
    const mainImage = getMainImageElement();
    const fallback = getFallbackElement();

    if (mainImage) mainImage.hidden = false;
    if (fallback) fallback.hidden = true;
}

// Xử lý show gallery fallback.
function showGalleryFallback() {
    const mainImage = getMainImageElement();
    const fallback = getFallbackElement();

    if (mainImage) mainImage.hidden = true;
    if (fallback) fallback.hidden = false;
}

// Xử lý scroll đang bật thumb into view.
function scrollActiveThumbIntoView(index) {
    const activeThumb = document.querySelectorAll('.product-gallery__thumb')[index];
    activeThumb?.scrollIntoView({
        block: 'nearest',
        inline: 'nearest',
        behavior: 'smooth'
    });
}

// Cập nhật gallery thumb state.
function updateGalleryThumbState(index) {
    document.querySelectorAll('.product-gallery__thumb').forEach((thumb, thumbIndex) => {
        thumb.classList.toggle('product-gallery__thumb--active', thumbIndex === index);
    });

    const counter = document.getElementById('currentIndex');
    if (counter) counter.textContent = index + 1;

    scrollActiveThumbIntoView(index);
}

// Xử lý select ảnh.
function selectImage(index, imageUrl) {
    if (productDetailState.productImages.length === 0) return;

    const normalizedTarget = normalizeImageUrl(imageUrl || productDetailState.productImages[index]);
    const resolvedIndex = Number.isInteger(index) && index >= 0 && index < productDetailState.productImages.length
        ? index
        : productDetailState.productImages.findIndex((url) => normalizeImageUrl(url) === normalizedTarget);

    const nextIndex = resolvedIndex >= 0 ? resolvedIndex : 0;
    const nextImageUrl = productDetailState.productImages[nextIndex] || imageUrl;

    productDetailState.currentImageIndex = nextIndex;
    const mainImage = getMainImageElement();
    if (mainImage) {
        if (normalizeImageUrl(mainImage.getAttribute('src') || mainImage.src) !== normalizeImageUrl(nextImageUrl)) {
            mainImage.src = nextImageUrl;
        }
        showMainImage();
    }

    updateGalleryThumbState(nextIndex);
}

// Xử lý switch gallery vào ảnh.
function switchGalleryToImage(imageUrl) {
    if (!imageUrl || !productDetailState.productImages.length) return;

    const normalizedTarget = normalizeImageUrl(imageUrl);
    const index = productDetailState.productImages.findIndex((url) => normalizeImageUrl(url) === normalizedTarget);
    if (index >= 0) {
        selectImage(index, productDetailState.productImages[index]);
    }
}

// Xử lý prev ảnh.
function prevImage() {
    if (productDetailState.productImages.length === 0) return;
    productDetailState.currentImageIndex =
        (productDetailState.currentImageIndex - 1 + productDetailState.productImages.length) %
        productDetailState.productImages.length;
    selectImage(productDetailState.currentImageIndex, productDetailState.productImages[productDetailState.currentImageIndex]);
}

// Xử lý next ảnh.
function nextImage() {
    if (productDetailState.productImages.length === 0) return;
    productDetailState.currentImageIndex =
        (productDetailState.currentImageIndex + 1) % productDetailState.productImages.length;
    selectImage(productDetailState.currentImageIndex, productDetailState.productImages[productDetailState.currentImageIndex]);
}

// Xử lý set selected class.
function setSelectedClass(selector, activeButton) {
    document.querySelectorAll(selector).forEach((button) => {
        button.classList.toggle('is-selected', button === activeButton);
    });
}

// Cập nhật giá display.
function updatePriceDisplay(currentPrice, originalPrice = null, hasDiscount = false) {
    const currentPriceElement = document.getElementById('productPrice');
    const originalPriceElement = document.querySelector('.product-info__price-original');
    const discountBadgeElement = document.querySelector('.product-info__discount-badge');

    if (currentPriceElement) {
        currentPriceElement.textContent = formatCurrency(currentPrice);
    }

    if (originalPriceElement) {
        if (hasDiscount && originalPrice !== null && originalPrice > currentPrice) {
            originalPriceElement.textContent = formatCurrency(originalPrice);
            originalPriceElement.hidden = false;
        } else {
            originalPriceElement.hidden = true;
        }
    }

    if (discountBadgeElement) {
        if (hasDiscount && originalPrice !== null && originalPrice > currentPrice) {
            const discountPercent = Math.max(1, Math.round((1 - (currentPrice / originalPrice)) * 100));
            discountBadgeElement.textContent = `Giảm ${discountPercent}%`;
            discountBadgeElement.hidden = false;
        } else {
            discountBadgeElement.hidden = true;
        }
    }
}

// Cập nhật biến thể stock tin nhắn.
function updateVariantStockMessage(stockQuantity = null) {
    const stockElement = document.getElementById('variantStock');
    if (!stockElement) {
        return;
    }

    if (stockQuantity === null || stockQuantity === undefined) {
        stockElement.textContent = '';
        delete stockElement.dataset.state;
        return;
    }

    if (stockQuantity > 0) {
        stockElement.textContent = `Còn ${stockQuantity.toLocaleString('vi-VN')} sản phẩm có sẵn`;
        stockElement.dataset.state = 'in-stock';
        return;
    }

    stockElement.textContent = 'Biến thể này đã hết hàng';
    stockElement.dataset.state = 'out-of-stock';
}

// Lấy current stock limit.
function getCurrentStockLimit() {
    const bootstrap = readProductDetailBootstrap();
    const variants = bootstrap.variants || [];

    if (variants.length === 0) {
        return Math.max(0, bootstrap.productStock || 0);
    }

    if (!productDetailState.selectedVariantId) {
        return null;
    }

    const selectedVariant = variants.find((variant) => variant.id === productDetailState.selectedVariantId);
    return selectedVariant ? Math.max(0, selectedVariant.stock_quantity) : null;
}

// Đồng bộ quantity input với stock.
function syncQuantityInputWithStock(showWarning = false) {
    const qtyInput = document.getElementById('productQty');
    const stockLimit = getCurrentStockLimit();

    if (!qtyInput) {
        return;
    }

    if (stockLimit === null) {
        qtyInput.removeAttribute('max');
        qtyInput.value = String(Math.max(1, parseInt(qtyInput.value, 10) || 1));
        return;
    }

    const safeStockLimit = Math.max(0, stockLimit);
    qtyInput.max = String(Math.max(1, safeStockLimit));

    let nextValue = Math.max(1, parseInt(qtyInput.value, 10) || 1);
    if (safeStockLimit > 0 && nextValue > safeStockLimit) {
        nextValue = safeStockLimit;
        if (showWarning) {
            showNotification(`Số lượng tồn kho chỉ còn ${safeStockLimit.toLocaleString('vi-VN')} sản phẩm`, 'warning');
        }
    }

    qtyInput.value = String(nextValue);
}

// Xác định biến thể.
function resolveVariant() {
    const bootstrap = readProductDetailBootstrap();
    const variants = bootstrap.variants || [];
    if (variants.length === 0) return;

    const colors = [...new Set(variants.filter((variant) => variant.color).map((variant) => variant.color))];
    const sizes = [...new Set(variants.filter((variant) => variant.size).map((variant) => variant.size))];
    const hasColors = colors.length > 0;
    const hasSizes = sizes.length > 0;

    const match = variants.find((variant) => {
        const colorMatch = !hasColors || variant.color === productDetailState.selectedColor;
        const sizeMatch = !hasSizes || variant.size === productDetailState.selectedSize;
        return colorMatch && sizeMatch;
    });

    const stockElement = document.getElementById('variantStock');

    if (match) {
        productDetailState.selectedVariantId = match.id;

        updatePriceDisplay(
            bootstrap.baseCurrentPrice + match.additional_price,
            bootstrap.hasDiscount ? bootstrap.baseOriginalPrice + match.additional_price : null,
            Boolean(bootstrap.hasDiscount)
        );

        if (stockElement) {
            if (match.stock_quantity > 0) {
                stockElement.textContent = `Còn ${match.stock_quantity} sản phẩm có sẵn`;
                stockElement.dataset.state = 'in-stock';
            } else {
                stockElement.textContent = 'Hết hàng';
                stockElement.dataset.state = 'out-of-stock';
            }
        }

        if (match.variant_image_url) {
            switchGalleryToImage(match.variant_image_url);
        }
    } else {
        productDetailState.selectedVariantId = null;
        if (stockElement) {
            stockElement.textContent = '';
            delete stockElement.dataset.state;
        }
    }
}

// Cập nhật biến thể availability.
function updateVariantAvailability() {
    const bootstrap = readProductDetailBootstrap();
    const variants = bootstrap.variants || [];
    if (variants.length === 0) return;

    const selectedColor = productDetailState.selectedColor;
    const selectedSize = productDetailState.selectedSize;

    // Tìm các size khả dụng cho màu đang chọn
    const availableSizesForColor = new Set();
    if (selectedColor) {
        variants.forEach(v => {
            if (v.color === selectedColor && v.stock_quantity > 0 && v.size) {
                availableSizesForColor.add(v.size);
            }
        });
    }

    // Tìm các màu khả dụng cho size đang chọn
    const availableColorsForSize = new Set();
    if (selectedSize) {
        variants.forEach(v => {
            if (v.size === selectedSize && v.stock_quantity > 0 && v.color) {
                availableColorsForSize.add(v.color);
            }
        });
    }

    // Cập nhật trạng thái nút size
    document.querySelectorAll('.size-btn').forEach(btn => {
        const size = btn.dataset.size;
        if (selectedColor) {
            const isAvailable = availableSizesForColor.has(size);
            btn.classList.toggle('is-unavailable', !isAvailable);
            btn.disabled = !isAvailable;
        } else {
            btn.classList.remove('is-unavailable');
            btn.disabled = false;
        }
    });

    // Cập nhật trạng thái nút màu
    document.querySelectorAll('.color-btn').forEach(btn => {
        const color = btn.dataset.color;
        if (selectedSize) {
            const isAvailable = availableColorsForSize.has(color);
            btn.classList.toggle('is-unavailable', !isAvailable);
            btn.disabled = !isAvailable;
        } else {
            btn.classList.remove('is-unavailable');
            btn.disabled = false;
        }
    });
}

// Xử lý biến thể button click.
function handleVariantButtonClick(button) {
    if (button.classList.contains('color-btn')) {
        const clickedColor = button.dataset.color || null;

        // Toggle: click lần nữa để bỏ chọn
        if (productDetailState.selectedColor === clickedColor) {
            productDetailState.selectedColor = null;
            setSelectedClass('.color-btn', null);
        } else {
            productDetailState.selectedColor = clickedColor;
            setSelectedClass('.color-btn', button);

            // Nếu size hiện tại không khả dụng cho màu mới → bỏ chọn size
            const bootstrap = readProductDetailBootstrap();
            const variants = bootstrap.variants || [];
            if (productDetailState.selectedSize) {
                const combo = variants.find(v =>
                    v.color === clickedColor &&
                    v.size === productDetailState.selectedSize &&
                    v.stock_quantity > 0
                );
                if (!combo) {
                    productDetailState.selectedSize = null;
                    setSelectedClass('.size-btn', null);
                }
            }
        }
    }

    if (button.classList.contains('size-btn')) {
        const clickedSize = button.dataset.size || null;

        // Toggle: click lần nữa để bỏ chọn
        if (productDetailState.selectedSize === clickedSize) {
            productDetailState.selectedSize = null;
            setSelectedClass('.size-btn', null);
        } else {
            productDetailState.selectedSize = clickedSize;
            setSelectedClass('.size-btn', button);

            // Nếu màu hiện tại không khả dụng cho size mới → bỏ chọn màu
            const bootstrap = readProductDetailBootstrap();
            const variants = bootstrap.variants || [];
            if (productDetailState.selectedColor) {
                const combo = variants.find(v =>
                    v.size === clickedSize &&
                    v.color === productDetailState.selectedColor &&
                    v.stock_quantity > 0
                );
                if (!combo) {
                    productDetailState.selectedColor = null;
                    setSelectedClass('.color-btn', null);
                }
            }
        }
    }

    resolveVariant();
    updateVariantAvailability();

    // Reset quantity khi đổi variant vì stock có thể khác nhau
    const qtyInput = document.getElementById('productQty');
    if (qtyInput) qtyInput.value = 1;
}

// Lấy current sản phẩm điều hướng.
function getCurrentProductRedirect() {
    return `${window.location.pathname}${window.location.search}` || '/products';
}

// Xử lý show đăng nhập required dialog.
function showLoginRequiredDialog(payload = {}) {
    const loginUrl = payload.loginUrl || `/auth/login?redirect=${encodeURIComponent(getCurrentProductRedirect())}`;
    const message = payload.message || 'Vui lòng đăng nhập để thêm sản phẩm vào giỏ hàng.';
    let dialog = document.querySelector('.login-required-dialog');

    if (!dialog) {
        dialog = document.createElement('div');
        dialog.className = 'login-required-dialog';
        dialog.innerHTML = `
            <div class="login-required-dialog__backdrop" data-login-dialog-close></div>
            <div class="login-required-dialog__panel" role="dialog" aria-modal="true" aria-labelledby="loginRequiredTitle">
                <button type="button" class="login-required-dialog__close" data-login-dialog-close aria-label="Dong thong bao">&times;</button>
                <h3 id="loginRequiredTitle">Cần đăng nhập</h3>
                <p class="login-required-dialog__message"></p>
                <div class="login-required-dialog__actions">
                    <button type="button" class="login-required-dialog__secondary" data-login-dialog-close>Để sau</button>
                    <a class="login-required-dialog__primary" href="#">Đăng nhập</a>
                </div>
            </div>
        `;
        document.body.appendChild(dialog);
        dialog.querySelectorAll('[data-login-dialog-close]').forEach((button) => {
            button.addEventListener('click', () => {
                dialog.classList.remove('is-open');
                document.body.classList.remove('login-required-dialog-open');
            });
        });
    }

    dialog.querySelector('.login-required-dialog__message').textContent = message;
    const primaryAction = dialog.querySelector('.login-required-dialog__primary');
    primaryAction.href = loginUrl;
    primaryAction.textContent = payload.requiresEmailVerification ? 'Xác thực email' : 'Đăng nhập';
    dialog.classList.add('is-open');
    document.body.classList.add('login-required-dialog-open');
}

// Lấy selected biến thể stock legacy.
function getSelectedVariantStockLegacy() {
    const bootstrap = readProductDetailBootstrap();
    const variants = bootstrap.variants || [];
    if (variants.length === 0) return Infinity;

    const match = variants.find(v => v.id === productDetailState.selectedVariantId);
    return match ? match.stock_quantity : 0;
}

// Thêm vào giỏ hàng với biến thể.
async function addToCartWithVariant() {
    const bootstrap = readProductDetailBootstrap();
    const variants = bootstrap.variants || [];
    if (variants.length > 0 && !productDetailState.selectedVariantId) {
        showNotification('Vui lòng chọn phân loại sản phẩm', 'warning');
        return;
    }

    const quantity = getSelectedQuantity();
    const stock = getSelectedVariantStock();

    if (quantity > stock) {
        showNotification(`Số lượng tồn kho chỉ còn ${stock} sản phẩm`, 'warning');
        return;
    }

    try {
        const response = await fetch('/cart/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({
                product_id: bootstrap.productId,
                variant_id: productDetailState.selectedVariantId,
                quantity: quantity,
                redirect: getCurrentProductRedirect()
            })
        });

        const data = await response.json();
        if (response.status === 401 || response.status === 403 || data.requiresLogin || data.requiresEmailVerification) {
            showLoginRequiredDialog(data);
            return;
        }

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

// Xử lý buy now với biến thể.
function buyNowWithVariant() {
    const bootstrap = readProductDetailBootstrap();
    const variants = bootstrap.variants || [];
    if (variants.length > 0 && !productDetailState.selectedVariantId) {
        showNotification('Vui lòng chọn phân loại sản phẩm', 'warning');
        return;
    }

    const quantity = getSelectedQuantity();
    const stock = getSelectedVariantStock();

    if (quantity > stock) {
        showNotification(`Số lượng tồn kho chỉ còn ${stock} sản phẩm`, 'warning');
        return;
    }

    const params = new URLSearchParams();
    if (productDetailState.selectedVariantId) params.set('variant_id', productDetailState.selectedVariantId);
    if (quantity > 1) params.set('quantity', quantity);
    const queryString = params.toString() ? `?${params.toString()}` : '';
    window.location.href = `/orders/buy-now/${bootstrap.productId}${queryString}`;
}

// Xử lý bind gallery events.
function bindGalleryEvents() {
    const mainImage = getMainImageElement();
    if (mainImage && mainImage.dataset.galleryBound !== 'true') {
        mainImage.dataset.galleryBound = 'true';
        mainImage.addEventListener('load', showMainImage);
        mainImage.addEventListener('error', showGalleryFallback);
    }

    document.querySelectorAll('.product-gallery__thumb').forEach((thumb, thumbIndex) => {
        if (thumb.dataset.galleryBound === 'true') return;

        thumb.dataset.galleryBound = 'true';
        thumb.addEventListener('click', () => {
            const thumbIndexValue = parseInt(thumb.dataset.index, 10);
            const imageUrl =
                thumb.dataset.imageUrl ||
                productDetailState.productImages[thumbIndex] ||
                thumb.getAttribute('src');
            selectImage(Number.isNaN(thumbIndexValue) ? thumbIndex : thumbIndexValue, imageUrl);
        });
    });

    document.querySelectorAll('[data-gallery-nav]').forEach((button) => {
        if (button.dataset.galleryBound === 'true') return;

        button.dataset.galleryBound = 'true';
        button.addEventListener('click', () => {
            if (button.dataset.galleryNav === 'prev') {
                prevImage();
            } else {
                nextImage();
            }
        });
    });
}

// Khởi tạo sản phẩm gallery.
function initProductGallery() {
    const bootstrap = readProductDetailBootstrap();
    productDetailState.productImages = Array.isArray(bootstrap.images)
        ? bootstrap.images.filter(Boolean)
        : [];

    bindGalleryEvents();

    const mainImage = getMainImageElement();
    if (!mainImage || productDetailState.productImages.length === 0) return;

    const currentSrc = normalizeImageUrl(
        mainImage.getAttribute('src') || mainImage.src || bootstrap.initialImage
    );

    const initialIndex = productDetailState.productImages.findIndex(
        (imageUrl) => normalizeImageUrl(imageUrl) === currentSrc
    );
    productDetailState.currentImageIndex = initialIndex >= 0 ? initialIndex : 0;

    if (initialIndex === -1 && productDetailState.productImages[productDetailState.currentImageIndex]) {
        mainImage.src = productDetailState.productImages[productDetailState.currentImageIndex];
    }

    updateGalleryThumbState(productDetailState.currentImageIndex);

    if (mainImage.complete) {
        if (mainImage.naturalWidth > 0) {
            showMainImage();
        } else {
            showGalleryFallback();
        }
    }
}

// Lấy selected quantity.
function getSelectedQuantity() {
    const qtyInput = document.getElementById('productQty');
    return qtyInput ? parseInt(qtyInput.value, 10) || 1 : 1;
}

// Khởi tạo quantity selector legacy.
function initQuantitySelectorLegacy() {
    const qtyInput = document.getElementById('productQty');
    const qtyMinus = document.getElementById('qtyMinus');
    const qtyPlus = document.getElementById('qtyPlus');

    if (!qtyInput) return;

    qtyMinus?.addEventListener('click', () => {
        const current = parseInt(qtyInput.value, 10) || 1;
        if (current > 1) qtyInput.value = current - 1;
    });

    qtyPlus?.addEventListener('click', () => {
        const current = parseInt(qtyInput.value, 10) || 1;
        const maxStock = getSelectedVariantStock();
        const max = maxStock === Infinity ? 99 : Math.min(maxStock, 99);
        if (current < max) {
            qtyInput.value = current + 1;
        } else {
            showNotification(`Số lượng tồn kho chỉ còn ${maxStock} sản phẩm`, 'warning');
        }
    });
    qtyInput.addEventListener('input', () => {
        qtyInput.value = qtyInput.value.replace(/[^0-9]/g, '');
    });
    qtyInput.addEventListener('blur', () => {
        let val = parseInt(qtyInput.value, 10);
        if (!val || val < 1) val = 1;
        const maxStock = getSelectedVariantStock();
        const max = maxStock === Infinity ? 99 : Math.min(maxStock, 99);
        if (val > max) {
            val = max;
            showNotification(`Số lượng tồn kho chỉ còn ${maxStock} sản phẩm`, 'warning');
        }
        qtyInput.value = val;
    });
}

// Xử lý refresh collapsible section.
function refreshCollapsibleSection(body) {
    if (!body || !body.classList.contains('is-open')) return;
    if (body.dataset.toggleMode === 'display') {
        body.style.maxHeight = '';
        return;
    }
    body.style.maxHeight = `${body.scrollHeight}px`;
}

// Xử lý set collapsible section state.
function setCollapsibleSectionState(toggle, body, isOpen) {
    if (!toggle || !body) return;

    const toggleMode = body.dataset.toggleMode || 'height';

    toggle.classList.toggle('is-open', isOpen);
    body.classList.toggle('is-open', isOpen);
    toggle.setAttribute('aria-expanded', String(isOpen));

    if (toggleMode === 'display') {
        body.style.maxHeight = '';
        return;
    }

    body.style.maxHeight = isOpen ? `${body.scrollHeight}px` : '0px';
}

// Khởi tạo collapsible section.
function initCollapsibleSection(toggleId, bodyId) {
    const toggle = document.getElementById(toggleId);
    const body = document.getElementById(bodyId);

    if (!toggle || !body) return;

    setCollapsibleSectionState(toggle, body, body.classList.contains('is-open'));
    toggle.addEventListener('click', () => {
        const isOpen = !body.classList.contains('is-open');
        setCollapsibleSectionState(toggle, body, isOpen);
    });
    window.addEventListener('resize', () => refreshCollapsibleSection(body));
}

// Xử lý refresh đánh giá panels.
function refreshReviewPanels() {
    ['createReviewPanel', 'reviewEditPanel', 'myReviewPanel', 'reviewBody'].forEach((id) => {
        refreshCollapsibleSection(document.getElementById(id));
    });
}

// Xử lý clear transient đánh giá truy vấn state.
function clearTransientReviewQueryState() {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('review')) return;

    url.searchParams.delete('review');
    const nextUrl = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState({}, document.title, nextUrl);
}

// Cập nhật toggle label.
function updateToggleLabel(toggle, isOpen) {
    if (!toggle) return;
    toggle.textContent = isOpen
        ? (toggle.dataset.closeLabel || toggle.textContent)
        : (toggle.dataset.openLabel || toggle.textContent);
}

// Xử lý bind toggle label.
function bindToggleLabel(toggleId, panelId, afterToggle) {
    const toggle = document.getElementById(toggleId);
    const panel = document.getElementById(panelId);

    if (!toggle || !panel) return;

    updateToggleLabel(toggle, panel.classList.contains('is-open'));
    toggle.addEventListener('click', () => {
        window.requestAnimationFrame(() => {
            const isOpen = panel.classList.contains('is-open');
            updateToggleLabel(toggle, isOpen);
            if (typeof afterToggle === 'function') {
                afterToggle(isOpen, toggle, panel);
            }
            refreshReviewPanels();
        });
    });
}

// Đóng toggle section.
function closeToggleSection(toggleId, panelId) {
    const toggle = document.getElementById(toggleId);
    const panel = document.getElementById(panelId);

    if (!toggle || !panel) return;

    setCollapsibleSectionState(toggle, panel, false);
    updateToggleLabel(toggle, false);
}

// Khởi tạo các điều khiển tạo đánh giá.
function initCreateReviewControls() {
    initCollapsibleSection('createReviewToggle', 'createReviewPanel');
    bindToggleLabel('createReviewToggle', 'createReviewPanel');
}

// Khởi tạo own đánh giá controls.
function initOwnReviewControls() {
    initCollapsibleSection('myReviewToggle', 'myReviewPanel');
    initCollapsibleSection('reviewEditToggle', 'reviewEditPanel');

    bindToggleLabel('myReviewToggle', 'myReviewPanel', (isOpen) => {
        if (!isOpen) {
            closeToggleSection('reviewEditToggle', 'reviewEditPanel');
        }
    });
    bindToggleLabel('reviewEditToggle', 'reviewEditPanel');
}

// Khởi tạo đánh giá media input.
function initReviewMediaInput() {
    const input = document.getElementById('reviewMediaInput');
    const preview = document.getElementById('reviewMediaPreview');
    const meta = document.getElementById('reviewMediaMeta');
    const reviewBody = document.getElementById('reviewBody');

    if (!input || !preview || !meta) return;

    let objectUrls = [];

    // Hiển thị preview.
    const renderPreview = () => {
        objectUrls.forEach((url) => URL.revokeObjectURL(url));
        objectUrls = [];
        preview.innerHTML = '';

        const files = Array.from(input.files || []);
        if (files.length === 0) {
            input.setCustomValidity('');
            meta.textContent = 'Tối đa 5 ảnh và 1 video cho mỗi review.';
            meta.dataset.state = 'idle';
            refreshCollapsibleSection(reviewBody);
            refreshReviewPanels();
            return;
        }

        const counts = files.reduce((result, file) => {
            if (file.type.startsWith('video/')) {
                result.videos += 1;
            } else {
                result.images += 1;
            }
            return result;
        }, { images: 0, videos: 0 });

        const hasInvalidSelection =
            files.length > 6 ||
            counts.images > 5 ||
            counts.videos > 1;

        if (hasInvalidSelection) {
            input.setCustomValidity('Bạn chỉ có thể chọn tối đa 5 ảnh và 1 video.');
            meta.textContent = 'Bạn chỉ có thể chọn tối đa 5 ảnh và 1 video.';
            meta.dataset.state = 'error';
        } else {
            input.setCustomValidity('');
            meta.textContent = `Đã chọn ${counts.images} ảnh${counts.videos ? ` và ${counts.videos} video` : ''}.`;
            meta.dataset.state = 'success';
        }

        files.forEach((file) => {
            const card = document.createElement('div');
            card.className = 'product-review-form__preview-card';

            const objectUrl = URL.createObjectURL(file);
            objectUrls.push(objectUrl);

            let mediaNode;
            if (file.type.startsWith('video/')) {
                mediaNode = document.createElement('video');
                mediaNode.controls = true;
                mediaNode.preload = 'metadata';
                mediaNode.className = 'product-review-form__preview-video';
            } else {
                mediaNode = document.createElement('img');
                mediaNode.loading = 'lazy';
                mediaNode.decoding = 'async';
                mediaNode.alt = file.name;
                mediaNode.className = 'product-review-form__preview-image';
            }

            mediaNode.src = objectUrl;
            card.appendChild(mediaNode);

            const caption = document.createElement('span');
            caption.className = 'product-review-form__preview-name';
            caption.textContent = file.name;
            card.appendChild(caption);

            preview.appendChild(card);
        });

        refreshCollapsibleSection(reviewBody);
        refreshReviewPanels();
    };
    input.addEventListener('change', renderPreview);
    renderPreview();
}

// Khởi tạo description toggle.
function initDescriptionToggle() {
    initCollapsibleSection('descToggle', 'descBody');
}

// Xử lý scroll vào đánh giá section.
function scrollToReviewsSection() {
    const reviewSection = document.getElementById('productReviewsSection');
    const reviewToggle = document.getElementById('reviewToggle');
    const reviewBody = document.getElementById('reviewBody');

    if (!reviewSection || !reviewToggle || !reviewBody) {
        return;
    }

    if (!reviewBody.classList.contains('is-open')) {
        setCollapsibleSectionState(reviewToggle, reviewBody, true);
    }

    reviewSection.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
    });
}

// Xác định biến thể.
function resolveVariant() {
    const bootstrap = readProductDetailBootstrap();
    const variants = bootstrap.variants || [];
    if (variants.length === 0) {
        return;
    }

    const colors = [...new Set(variants.filter((variant) => variant.color).map((variant) => variant.color))];
    const sizes = [...new Set(variants.filter((variant) => variant.size).map((variant) => variant.size))];
    const hasColors = colors.length > 0;
    const hasSizes = sizes.length > 0;

    const match = variants.find((variant) => {
        const colorMatch = !hasColors || variant.color === productDetailState.selectedColor;
        const sizeMatch = !hasSizes || variant.size === productDetailState.selectedSize;
        return colorMatch && sizeMatch;
    });

    if (match) {
        productDetailState.selectedVariantId = match.id;
        updatePriceDisplay(
            bootstrap.baseCurrentPrice + match.additional_price,
            bootstrap.hasDiscount ? bootstrap.baseOriginalPrice + match.additional_price : null,
            Boolean(bootstrap.hasDiscount)
        );
        updateVariantStockMessage(match.stock_quantity);

        if (match.variant_image_url) {
            switchGalleryToImage(match.variant_image_url);
        }
    } else {
        productDetailState.selectedVariantId = null;
        updatePriceDisplay(
            bootstrap.baseCurrentPrice,
            bootstrap.hasDiscount ? bootstrap.baseOriginalPrice : null,
            Boolean(bootstrap.hasDiscount)
        );
        updateVariantStockMessage(null);
    }

    syncQuantityInputWithStock(true);
}

// Lấy selected biến thể stock.
function getSelectedVariantStock() {
    const stockLimit = getCurrentStockLimit();
    return stockLimit === null ? Infinity : stockLimit;
}

// Khởi tạo quantity selector.
function initQuantitySelector() {
    const qtyInput = document.getElementById('productQty');
    const qtyMinus = document.getElementById('qtyMinus');
    const qtyPlus = document.getElementById('qtyPlus');

    if (!qtyInput) {
        return;
    }

    qtyMinus?.addEventListener('click', () => {
        const current = parseInt(qtyInput.value, 10) || 1;
        if (current > 1) {
            qtyInput.value = current - 1;
        }
    });

    qtyPlus?.addEventListener('click', () => {
        const current = parseInt(qtyInput.value, 10) || 1;
        const maxStock = getCurrentStockLimit();

        if (maxStock === null) {
            qtyInput.value = current + 1;
            return;
        }

        if (maxStock > 0 && current < maxStock) {
            qtyInput.value = current + 1;
            return;
        }

        showNotification(`Số lượng tồn kho chỉ còn ${Math.max(0, maxStock).toLocaleString('vi-VN')} sản phẩm`, 'warning');
    });
    qtyInput.addEventListener('input', () => {
        qtyInput.value = qtyInput.value.replace(/[^0-9]/g, '');
    });
    qtyInput.addEventListener('blur', () => {
        let value = parseInt(qtyInput.value, 10);
        if (!value || value < 1) {
            value = 1;
        }

        qtyInput.value = value;
        syncQuantityInputWithStock(true);
    });
    qtyInput.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter') {
            return;
        }

        event.preventDefault();
        let value = parseInt(qtyInput.value, 10);
        if (!value || value < 1) {
            value = 1;
        }

        qtyInput.value = value;
        syncQuantityInputWithStock(true);
        qtyInput.blur();
    });
}

// Khởi tạo sản phẩm chi tiết trang.
function initProductDetailPage() {
    const bootstrap = readProductDetailBootstrap();

    initProductGallery();
    initQuantitySelector();
    initDescriptionToggle();
    initCollapsibleSection('reviewToggle', 'reviewBody');
    initCreateReviewControls();
    initOwnReviewControls();
    initReviewMediaInput();
    clearTransientReviewQueryState();

    updatePriceDisplay(
        bootstrap.baseCurrentPrice,
        bootstrap.hasDiscount ? bootstrap.baseOriginalPrice : null,
        Boolean(bootstrap.hasDiscount)
    );
    syncQuantityInputWithStock();

    document.querySelectorAll('.variant-btn').forEach((button) => {
        button.addEventListener('click', () => handleVariantButtonClick(button));
    });

    document.querySelectorAll('[data-product-action="add-to-cart"]').forEach((button) => {
        button.addEventListener('click', addToCartWithVariant);
    });

    document.querySelectorAll('[data-product-action="buy-now"]').forEach((button) => {
        button.addEventListener('click', buyNowWithVariant);
    });

    document.querySelectorAll('[data-scroll-to-reviews]').forEach((button) => {
        button.addEventListener('click', scrollToReviewsSection);
    });
}

// Khởi tạo sản phẩm chi tiết trang legacy.
function initProductDetailPageLegacy() {
    readProductDetailBootstrap();
    initProductGallery();
    initQuantitySelector();
    initDescriptionToggle();
    initCollapsibleSection('reviewToggle', 'reviewBody');
    initCreateReviewControls();
    initOwnReviewControls();
    initReviewMediaInput();
    clearTransientReviewQueryState();

    document.querySelectorAll('.variant-btn').forEach((button) => {
        button.addEventListener('click', () => handleVariantButtonClick(button));
    });

    document.querySelectorAll('[data-product-action="add-to-cart"]').forEach((button) => {
        button.addEventListener('click', addToCartWithVariant);
    });

    document.querySelectorAll('[data-product-action="buy-now"]').forEach((button) => {
        button.addEventListener('click', buyNowWithVariant);
    });

    document.querySelectorAll('[data-scroll-to-reviews]').forEach((button) => {
        button.addEventListener('click', scrollToReviewsSection);
    });
}
document.addEventListener('DOMContentLoaded', initProductDetailPage);
