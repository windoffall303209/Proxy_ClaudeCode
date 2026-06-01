(function initAdminReviewFilters() {
    let submitTimer = null;
    let activeRequest = null;

    function getForm() {
        return document.querySelector('[data-review-filter-form]');
    }

    function getFilterCheckboxes(form) {
        return Array.from(form.querySelectorAll('input[name="product_ids"], input[name="ratings"]'));
    }

    function getSentimentSelect(form) {
        return form.querySelector('select[name="sentiment"]');
    }

    function setLoading(isLoading) {
        const page = document.querySelector('.admin-reviews-page');
        if (page) {
            page.dataset.reviewLoading = isLoading ? 'true' : 'false';
        }
    }

    function buildUrlFromForm(form) {
        const url = new URL(form.action, window.location.origin);
        const params = new URLSearchParams(new FormData(form));
        const query = params.toString();
        return `${url.pathname}${query ? `?${query}` : ''}`;
    }

    function replaceElement(selector, nextDocument) {
        const currentElement = document.querySelector(selector);
        const nextElement = nextDocument.querySelector(selector);
        if (currentElement && nextElement) {
            currentElement.replaceWith(nextElement);
        }
    }

    function updateSummary(form, groupName, emptyText, selectedText) {
        const summary = form.querySelector(`[data-review-summary="${groupName}"]`);
        if (!summary) {
            return;
        }

        const selectedCount = form.querySelectorAll(`input[name="${groupName}"]:checked`).length;
        summary.textContent = selectedCount ? selectedText(selectedCount) : emptyText;
    }

    function syncSummaries(form) {
        updateSummary(form, 'product_ids', 'Tất cả sản phẩm', (count) => `Đã chọn ${count} sản phẩm`);
        updateSummary(form, 'ratings', 'Mọi điểm', (count) => `Đã chọn ${count} mức sao`);
    }

    function syncAllState(form, groupName) {
        const allCheckbox = form.querySelector(`[data-review-all="${groupName}"]`);
        if (!allCheckbox) {
            return;
        }

        const groupCheckboxes = getFilterCheckboxes(form).filter((checkbox) => checkbox.name === groupName);
        allCheckbox.checked = groupCheckboxes.every((checkbox) => !checkbox.checked);
    }

    function syncClearLink(form) {
        const clearLink = form.querySelector('[data-review-clear]');
        if (!clearLink) {
            return;
        }

        const hasCheckboxFilter = getFilterCheckboxes(form).some((checkbox) => checkbox.checked);
        const hasSearchFilter = Boolean(form.querySelector('input[name="search"]')?.value.trim());
        const hasSentimentFilter = Boolean(getSentimentSelect(form)?.value);
        clearLink.hidden = !(hasCheckboxFilter || hasSearchFilter || hasSentimentFilter);
    }

    async function loadReviewUrl(url, pushState = true) {
        if (activeRequest) {
            activeRequest.abort();
        }

        const request = new AbortController();
        activeRequest = request;
        setLoading(true);

        try {
            const response = await fetch(url, {
                headers: { 'X-Requested-With': 'fetch' },
                signal: request.signal
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const html = await response.text();
            const nextDocument = new DOMParser().parseFromString(html, 'text/html');
            replaceElement('[data-review-total-label]', nextDocument);
            replaceElement('[data-review-export-actions]', nextDocument);
            replaceElement('[data-review-stats]', nextDocument);
            replaceElement('[data-review-results]', nextDocument);

            if (pushState) {
                window.history.pushState({}, '', url);
            }
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Không thể lọc đánh giá:', error);
                const form = getForm();
                if (form) {
                    window.location.href = buildUrlFromForm(form);
                }
            }
        } finally {
            if (activeRequest === request) {
                setLoading(false);
                activeRequest = null;
            }
        }
    }

    function submitFilters(delay = 0) {
        const form = getForm();
        if (!form) {
            return;
        }

        window.clearTimeout(submitTimer);
        submitTimer = window.setTimeout(() => {
            loadReviewUrl(buildUrlFromForm(form));
        }, delay);
    }

    function bindReviewFilters() {
        const form = getForm();
        if (!form || form.dataset.reviewBound === 'true') {
            return;
        }

        form.dataset.reviewBound = 'true';
        const pickers = Array.from(form.querySelectorAll('[data-review-picker]'));
        const allCheckboxes = Array.from(form.querySelectorAll('[data-review-all]'));
        const filterCheckboxes = getFilterCheckboxes(form);
        const searchInput = form.querySelector('input[name="search"]');
        const sentimentSelect = getSentimentSelect(form);

        form.addEventListener('submit', (event) => {
            event.preventDefault();
            loadReviewUrl(buildUrlFromForm(form));
        });

        allCheckboxes.forEach((allCheckbox) => {
            allCheckbox.addEventListener('change', () => {
                const groupName = allCheckbox.dataset.reviewAll;
                if (allCheckbox.checked) {
                    filterCheckboxes
                        .filter((checkbox) => checkbox.name === groupName)
                        .forEach((checkbox) => {
                            checkbox.checked = false;
                        });
                }

                syncSummaries(form);
                syncClearLink(form);
                submitFilters(100);
            });
        });

        filterCheckboxes.forEach((checkbox) => {
            checkbox.addEventListener('change', () => {
                syncAllState(form, checkbox.name);
                syncSummaries(form);
                syncClearLink(form);
                submitFilters(250);
            });
        });

        pickers.forEach((picker) => {
            picker.addEventListener('toggle', () => {
                if (!picker.open) {
                    return;
                }

                pickers.forEach((otherPicker) => {
                    if (otherPicker !== picker) {
                        otherPicker.open = false;
                    }
                });
            });
        });

        searchInput?.addEventListener('input', () => {
            syncClearLink(form);
            submitFilters(650);
        });

        sentimentSelect?.addEventListener('change', () => {
            syncClearLink(form);
            submitFilters(50);
        });

        syncSummaries(form);
        syncClearLink(form);
    }

    bindReviewFilters();

    document.addEventListener('click', (event) => {
        const link = event.target.closest('[data-review-ajax-link]');
        if (link) {
            event.preventDefault();

            if (link.matches('[data-review-clear]')) {
                const form = getForm();
                form?.reset();
                if (form) {
                    getFilterCheckboxes(form).forEach((checkbox) => {
                        checkbox.checked = false;
                    });
                    form.querySelectorAll('[data-review-all]').forEach((checkbox) => {
                        checkbox.checked = true;
                    });
                    const searchInput = form.querySelector('input[name="search"]');
                    if (searchInput) {
                        searchInput.value = '';
                    }
                    const sentimentSelect = getSentimentSelect(form);
                    if (sentimentSelect) {
                        sentimentSelect.value = '';
                    }
                    syncSummaries(form);
                    syncClearLink(form);
                }
            }

            loadReviewUrl(link.getAttribute('href'));
            return;
        }

        document.querySelectorAll('[data-review-picker][open]').forEach((picker) => {
            if (!picker.contains(event.target)) {
                picker.open = false;
            }
        });
    });

    window.addEventListener('popstate', () => {
        loadReviewUrl(window.location.href, false);
    });
})();
