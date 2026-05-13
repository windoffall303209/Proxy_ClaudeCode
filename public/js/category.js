// Điều phối tương tác trình duyệt cho danh mục, tách khỏi template EJS.
const filterButtons = document.querySelectorAll('.filter-btn');
const sortSelect = document.getElementById('sortProducts');
const productCount = document.getElementById('productCount');

filterButtons.forEach((button) => {
    button.addEventListener('click', function() {
        filterButtons.forEach((item) => item.classList.remove('active'));
        this.classList.add('active');
        filterProducts(this.dataset.filter);
    });
});

// Lọc sản phẩm.
function filterProducts(filter) {
    const cards = document.querySelectorAll('.product-card');
    let visibleCount = 0;

    cards.forEach((card) => {
        const hasSale = card.querySelector('.product-card__badge--sale');
        const shouldShow = filter === 'sale' ? Boolean(hasSale) : true;
        card.style.display = shouldShow ? '' : 'none';
        if (shouldShow) visibleCount++;
    });

    if (productCount) {
        productCount.textContent = visibleCount;
    }
}

if (sortSelect) {
    sortSelect.addEventListener('change', function() {
        const currentUrl = new URL(window.location.href);
        const grid = document.getElementById('productsGrid');

        if (grid) {
            grid.style.opacity = '0.5';
            grid.style.pointerEvents = 'none';
        }

        currentUrl.searchParams.set('sort', this.value);

        fetch(currentUrl.toString(), {
            headers: {
                Accept: 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            }
        })
            .then((response) => response.json())
            .then((data) => {
                window.history.pushState({}, '', currentUrl.toString());
                renderProducts(data.products || []);
                if (productCount) {
                    productCount.textContent = (data.products || []).length;
                }
            })
            .catch((error) => {
                console.error('Sort error:', error);
                window.location.href = currentUrl.toString();
            })
            .finally(() => {
                if (grid) {
                    grid.style.opacity = '1';
                    grid.style.pointerEvents = '';
                }
            });
    });
}

// Hiển thị sản phẩm.
function renderProducts(products) {
    const grid = document.getElementById('productsGrid');
    if (!grid) return;

    if (!products || products.length === 0) {
        grid.innerHTML = `
            <div class="empty-panel" style="grid-column: 1 / -1;">
                <h3>Chưa có sản phẩm</h3>
                <p>Thử đổi bộ lọc hoặc quay lại trang sản phẩm để tiếp tục mua sắm.</p>
                <a href="/products" class="btn btn-primary">Xem tất cả sản phẩm</a>
            </div>
        `;
        return;
    }

    grid.innerHTML = products.map((product) => buildProductCard(product)).join('');
}

// Tạo dữ liệu sản phẩm card.
function buildProductCard(product) {
    const slug = product.slug || product.id;
    const price = Number(product.price || 0);
    const finalPrice = Number(product.final_price || price);
    const hasDiscount = finalPrice < price;
    const isNew = product.created_at && (new Date() - new Date(product.created_at)) < 7 * 24 * 60 * 60 * 1000;
    const colors = Array.isArray(product.variants)
        ? [...new Set(product.variants.map((variant) => variant.color).filter(Boolean))].slice(0, 3)
        : [];

    const saleBadge = product.sale_type
        ? `<span class="product-card__badge product-card__badge--sale">${product.sale_type === 'percentage' ? `-${product.sale_value}%` : 'Sale'}</span>`
        : '';
    const stateBadge = product.stock_quantity === 0
        ? '<span class="product-card__badge product-card__badge--soldout">Hết hàng</span>'
        : (isNew ? '<span class="product-card__badge product-card__badge--new">Mới</span>' : '');
    const tagsHtml = colors.length
        ? `<div class="product-card__tags">${colors.map((color) => `<span class="product-card__tag">${color}</span>`).join('')}</div>`
        : '';
    const ratingHtml = product.review_count > 0
        ? `<span class="product-card__rating">${Number(product.average_rating || 0).toFixed(1)} / 5</span>`
        : '';
    const priceHtml = hasDiscount
        ? `
            <span class="product-card__price product-card__price--sale">${finalPrice.toLocaleString('vi-VN')}đ</span>
            <span class="product-card__price-original">${price.toLocaleString('vi-VN')}đ</span>
        `
        : `<span class="product-card__price">${price.toLocaleString('vi-VN')}đ</span>`;

    const imageHtml = product.primary_image
        ? `
            <img class="img-primary" src="${product.card_image || product.primary_image}" alt="${product.name}">
            ${product.secondary_image ? `<img class="img-secondary" src="${product.secondary_image}" alt="${product.name}">` : ''}
        `
        : `
            <div class="product-card__image-placeholder">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21,15 16,10 5,21"/>
                </svg>
            </div>
        `;

    return `
        <article class="product-card">
            <a href="/products/${slug}" class="product-card__link">
                <div class="product-card__image">
                    ${saleBadge}
                    ${stateBadge}
                    ${imageHtml}
                    <button class="product-card__quick-add" onclick="event.preventDefault(); event.stopPropagation(); addToCart(${product.id})" ${product.stock_quantity === 0 ? 'disabled' : ''}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="9" cy="21" r="1"/>
                            <circle cx="20" cy="21" r="1"/>
                            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                        </svg>
                        Thêm vào giỏ
                    </button>
                </div>
                <div class="product-card__info">
                    <div class="product-card__meta">
                        <span class="product-card__collection">${product.category_name || 'WIND OF FALL'}</span>
                        ${ratingHtml}
                    </div>
                    <h3 class="product-card__name">${product.name}</h3>
                    ${tagsHtml}
                    <div class="product-card__price-row">
                        ${priceHtml}
                    </div>
                </div>
            </a>
        </article>
    `;
}

(function setInitialSortValue() {
    if (!sortSelect) return;
    const urlParams = new URLSearchParams(window.location.search);
    const sort = urlParams.get('sort');
    if (sort) {
        sortSelect.value = sort;
    }
})();
