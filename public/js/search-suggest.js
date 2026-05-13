/**
 * Search Autocomplete / Typeahead
 * Shows product suggestions as user types in the search bar
 */
(function () {
    const input = document.getElementById('searchInput');
    const dropdown = document.getElementById('searchSuggest');
    if (!input || !dropdown) return;

    let debounceTimer = null;
    let currentQuery = '';

    // Định dạng giá.
    function formatPrice(n) {
        return n.toLocaleString('vi-VN') + 'đ';
    }

    // Hiển thị gợi ý.
    function renderSuggestions(products, query) {
        if (!products.length) {
            dropdown.innerHTML = '<div class="search-suggest__empty">Không tìm thấy sản phẩm nào</div>';
            dropdown.classList.add('is-open');
            return;
        }

        // Xử lý highlight.
        const highlight = (text) => {
            const regex = new RegExp('(' + query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
            return text.replace(regex, '<mark>$1</mark>');
        };

        const html = products.map(p => `
            <a href="/products/${p.slug}" class="search-suggest__item">
                <div class="search-suggest__img">
                    ${p.image
                        ? `<img src="${p.image}" alt="${p.name}" loading="lazy">`
                        : `<div class="search-suggest__placeholder">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                                <circle cx="8.5" cy="8.5" r="1.5"/>
                                <polyline points="21 15 16 10 5 21"/>
                            </svg>
                           </div>`
                    }
                </div>
                <div class="search-suggest__info">
                    <span class="search-suggest__name">${highlight(p.name)}</span>
                    <span class="search-suggest__price">
                        ${formatPrice(p.price)}
                        ${p.originalPrice ? `<s>${formatPrice(p.originalPrice)}</s>` : ''}
                    </span>
                </div>
            </a>
        `).join('');

        dropdown.innerHTML = html + `
            <a href="/products/search?q=${encodeURIComponent(query)}" class="search-suggest__viewall">
                Xem tất cả kết quả cho "${query}"
            </a>
        `;
        dropdown.classList.add('is-open');
    }

    // Tải gợi ý.
    async function fetchSuggestions(query) {
        try {
            const res = await fetch(`/products/suggest?q=${encodeURIComponent(query)}`);
            const data = await res.json();
            if (query === currentQuery) {
                renderSuggestions(data, query);
            }
        } catch (e) {
            dropdown.classList.remove('is-open');
        }
    }
    input.addEventListener('input', () => {
        const q = input.value.trim();
        currentQuery = q;

        clearTimeout(debounceTimer);

        if (q.length < 1) {
            dropdown.classList.remove('is-open');
            dropdown.innerHTML = '';
            return;
        }

        debounceTimer = setTimeout(() => fetchSuggestions(q), 300);
    });
    input.addEventListener('focus', () => {
        if (input.value.trim().length >= 1 && dropdown.innerHTML) {
            dropdown.classList.add('is-open');
        }
    });
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.header-search')) {
            dropdown.classList.remove('is-open');
        }
    });

    // Keyboard navigation
    input.addEventListener('keydown', (e) => {
        const items = dropdown.querySelectorAll('.search-suggest__item, .search-suggest__viewall');
        if (!items.length) return;
        const active = dropdown.querySelector('.is-focused');
        let idx = [...items].indexOf(active);

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (active) active.classList.remove('is-focused');
            idx = (idx + 1) % items.length;
            items[idx].classList.add('is-focused');
            items[idx].scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (active) active.classList.remove('is-focused');
            idx = idx <= 0 ? items.length - 1 : idx - 1;
            items[idx].classList.add('is-focused');
            items[idx].scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'Enter' && active) {
            e.preventDefault();
            window.location.href = active.href;
        }
    });
})();
