const productDetailState = {
    currentImageIndex: 0,
    productImages: [],
    selectedColor: null,
    selectedSize: null,
    selectedVariantId: null,
    bootstrap: null
};

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

        const newPrice = (bootstrap.basePrice || 0) + (match.additional_price || 0);
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

function handleVariantButtonClick(button) {
    if (button.classList.contains('color-btn')) {
        productDetailState.selectedColor = button.dataset.color || null;
        setSelectedClass('.color-btn', button);
    }

    if (button.classList.contains('size-btn')) {
        productDetailState.selectedSize = button.dataset.size || null;
        setSelectedClass('.size-btn', button);
    }

    resolveVariant();
}

function addToCartWithVariant() {
    const bootstrap = readProductDetailBootstrap();
    const variants = bootstrap.variants || [];
    if (variants.length > 0 && !productDetailState.selectedVariantId) {
        showNotification('Vui lòng chọn phân loại sản phẩm', 'warning');
        return;
    }

    addToCart(bootstrap.productId, productDetailState.selectedVariantId);
}

function buyNowWithVariant() {
    const bootstrap = readProductDetailBootstrap();
    const variants = bootstrap.variants || [];
    if (variants.length > 0 && !productDetailState.selectedVariantId) {
        showNotification('Vui lòng chọn phân loại sản phẩm', 'warning');
        return;
    }

    const variantParam = productDetailState.selectedVariantId ? `?variant_id=${productDetailState.selectedVariantId}` : '';
    window.location.href = `/orders/buy-now/${bootstrap.productId}${variantParam}`;
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

function initProductDetailPage() {
    readProductDetailBootstrap();
    initProductGallery();

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
