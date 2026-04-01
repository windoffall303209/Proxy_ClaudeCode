const productDetailState = {
    currentImageIndex: 0,
    productImages: [],
    selectedColor: null,
    selectedSize: null,
    selectedVariantId: null,
    bootstrap: null
};

function toNumericPrice(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

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
        productDetailState.bootstrap.basePrice = toNumericPrice(productDetailState.bootstrap.basePrice);
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

function normalizeImageUrl(imageUrl) {
    if (!imageUrl) return '';

    try {
        return new URL(imageUrl, window.location.origin).href;
    } catch (error) {
        return String(imageUrl);
    }
}

function getMainImageElement() {
    return document.getElementById('mainImage');
}

function getFallbackElement() {
    return document.getElementById('fallbackIcon');
}

function showMainImage() {
    const mainImage = getMainImageElement();
    const fallback = getFallbackElement();

    if (mainImage) mainImage.hidden = false;
    if (fallback) fallback.hidden = true;
}

function showGalleryFallback() {
    const mainImage = getMainImageElement();
    const fallback = getFallbackElement();

    if (mainImage) mainImage.hidden = true;
    if (fallback) fallback.hidden = false;
}

function scrollActiveThumbIntoView(index) {
    const activeThumb = document.querySelectorAll('.product-gallery__thumb')[index];
    activeThumb?.scrollIntoView({
        block: 'nearest',
        inline: 'nearest',
        behavior: 'smooth'
    });
}

function updateGalleryThumbState(index) {
    document.querySelectorAll('.product-gallery__thumb').forEach((thumb, thumbIndex) => {
        thumb.classList.toggle('product-gallery__thumb--active', thumbIndex === index);
    });

    const counter = document.getElementById('currentIndex');
    if (counter) counter.textContent = index + 1;

    scrollActiveThumbIntoView(index);
}

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

function switchGalleryToImage(imageUrl) {
    if (!imageUrl || !productDetailState.productImages.length) return;

    const normalizedTarget = normalizeImageUrl(imageUrl);
    const index = productDetailState.productImages.findIndex((url) => normalizeImageUrl(url) === normalizedTarget);
    if (index >= 0) {
        selectImage(index, productDetailState.productImages[index]);
    }
}

function prevImage() {
    if (productDetailState.productImages.length === 0) return;
    productDetailState.currentImageIndex =
        (productDetailState.currentImageIndex - 1 + productDetailState.productImages.length) %
        productDetailState.productImages.length;
    selectImage(productDetailState.currentImageIndex, productDetailState.productImages[productDetailState.currentImageIndex]);
}

function nextImage() {
    if (productDetailState.productImages.length === 0) return;
    productDetailState.currentImageIndex =
        (productDetailState.currentImageIndex + 1) % productDetailState.productImages.length;
    selectImage(productDetailState.currentImageIndex, productDetailState.productImages[productDetailState.currentImageIndex]);
}

function setSelectedClass(selector, activeButton) {
    document.querySelectorAll(selector).forEach((button) => {
        button.classList.toggle('is-selected', button === activeButton);
    });
}

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

        const newPrice = bootstrap.basePrice + match.additional_price;
        const priceElement = document.getElementById('productPrice');
        if (priceElement) {
            priceElement.textContent = `${newPrice.toLocaleString('vi-VN')}đ`;
        }

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

function getSelectedVariantStock() {
    const bootstrap = readProductDetailBootstrap();
    const variants = bootstrap.variants || [];
    if (variants.length === 0) return Infinity;

    const match = variants.find(v => v.id === productDetailState.selectedVariantId);
    return match ? match.stock_quantity : 0;
}

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
                quantity: quantity
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

function getSelectedQuantity() {
    const qtyInput = document.getElementById('productQty');
    return qtyInput ? parseInt(qtyInput.value, 10) || 1 : 1;
}

function initQuantitySelector() {
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

function refreshCollapsibleSection(body) {
    if (!body || !body.classList.contains('is-open')) return;
    if (body.dataset.toggleMode === 'display') {
        body.style.maxHeight = '';
        return;
    }
    body.style.maxHeight = `${body.scrollHeight}px`;
}

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

function refreshReviewPanels() {
    ['createReviewPanel', 'reviewEditPanel', 'myReviewPanel', 'reviewBody'].forEach((id) => {
        refreshCollapsibleSection(document.getElementById(id));
    });
}

function clearTransientReviewQueryState() {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('review')) return;

    url.searchParams.delete('review');
    const nextUrl = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState({}, document.title, nextUrl);
}

function updateToggleLabel(toggle, isOpen) {
    if (!toggle) return;
    toggle.textContent = isOpen
        ? (toggle.dataset.closeLabel || toggle.textContent)
        : (toggle.dataset.openLabel || toggle.textContent);
}

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

function closeToggleSection(toggleId, panelId) {
    const toggle = document.getElementById(toggleId);
    const panel = document.getElementById(panelId);

    if (!toggle || !panel) return;

    setCollapsibleSectionState(toggle, panel, false);
    updateToggleLabel(toggle, false);
}

function initCreateReviewControls() {
    initCollapsibleSection('createReviewToggle', 'createReviewPanel');
    bindToggleLabel('createReviewToggle', 'createReviewPanel');
}

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

function initReviewMediaInput() {
    const input = document.getElementById('reviewMediaInput');
    const preview = document.getElementById('reviewMediaPreview');
    const meta = document.getElementById('reviewMediaMeta');
    const reviewBody = document.getElementById('reviewBody');

    if (!input || !preview || !meta) return;

    let objectUrls = [];

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

function initDescriptionToggle() {
    initCollapsibleSection('descToggle', 'descBody');
}

function initProductDetailPage() {
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
}

document.addEventListener('DOMContentLoaded', initProductDetailPage);
