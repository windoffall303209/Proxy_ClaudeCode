/**
 * Product List Page JavaScript
 * Handles filtering and sorting products with AJAX
 */

// Current state
let currentSort = 'newest';
let currentFilter = 'all';

// Filter buttons
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        currentFilter = this.dataset.filter;
        loadProducts();
    });
});

// Sort products with AJAX
function sortProducts(value) {
    currentSort = value;
    loadProducts();
}

// Load products via AJAX
async function loadProducts() {
    const productsGrid = document.querySelector('.products-grid');
    const countEl = document.querySelector('.products-page__count');

    // Show loading state
    productsGrid.innerHTML = '<div class="products-loading">Đang tải...</div>';

    // Build URL with current params
    const url = new URL(window.location.href);
    url.searchParams.set('sort', currentSort);
    if (currentFilter !== 'all') {
        if (currentFilter === 'sale') {
            url.searchParams.set('sale', '1');
        } else if (currentFilter === 'new') {
            url.searchParams.set('sort', 'newest');
        }
    } else {
        url.searchParams.delete('sale');
    }

    // Update URL without reload (for bookmarking/sharing)
    window.history.replaceState({}, '', url.toString());

    try {
        // Fetch products as JSON
        const response = await fetch(url.toString(), {
            headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) throw new Error('Network error');

        const data = await response.json();

        // Render products
        if (data.products && data.products.length > 0) {
            productsGrid.innerHTML = data.products.map(product => renderProductCard(product)).join('');
            if (countEl) countEl.textContent = `${data.products.length} sản phẩm`;
        } else {
            productsGrid.innerHTML = `
                <div class="products-empty">
                    <div class="products-empty__icon">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                            <circle cx="11" cy="11" r="8"/>
                            <path d="M21 21l-4.35-4.35"/>
                        </svg>
                    </div>
                    <h3 class="products-empty__title">Không tìm thấy sản phẩm</h3>
                    <p class="products-empty__text">Vui lòng thử tìm kiếm với từ khóa khác.</p>
                </div>
            `;
            if (countEl) countEl.textContent = '0 sản phẩm';
        }
    } catch (error) {
        console.error('Load products error:', error);
        // Fallback: reload page
        window.location.href = url.toString();
    }
}

// Render a single product card
function renderProductCard(product) {
    const price = product.price || 0;
    const finalPrice = product.final_price || price;
    const hasDiscount = finalPrice < price;
    const discountPercent = hasDiscount ? Math.round((1 - finalPrice / price) * 100) : 0;
    const image = product.primary_image || product.images?.[0]?.image_url || '/images/placeholder.jpg';

    return `
        <a href="/products/${product.slug}" class="product-card">
            <div class="product-card__image">
                <img src="${image}" alt="${product.name}" loading="lazy">
                ${hasDiscount ? `<span class="product-card__badge">-${discountPercent}%</span>` : ''}
            </div>
            <div class="product-card__info">
                <h3 class="product-card__name">${product.name}</h3>
                <div class="product-card__price">
                    ${hasDiscount ? `<span class="product-card__price-old">${price.toLocaleString('vi-VN')}đ</span>` : ''}
                    <span class="product-card__price-current">${finalPrice.toLocaleString('vi-VN')}đ</span>
                </div>
            </div>
        </a>
    `;
}

// Set initial sort value from URL
document.addEventListener('DOMContentLoaded', function() {
    const urlParams = new URLSearchParams(window.location.search);
    const sortValue = urlParams.get('sort');
    if (sortValue) {
        currentSort = sortValue;
        const sortSelect = document.getElementById('sortProducts');
        if (sortSelect) sortSelect.value = sortValue;
    }
});

