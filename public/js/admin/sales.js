const adminSalesBootstrap = JSON.parse(document.getElementById('adminSalesBootstrap').textContent);
const adminSaleProducts = adminSalesBootstrap.products || [];
const adminSales = adminSalesBootstrap.sales || [];
const adminSalesMap = new Map(adminSales.map((sale) => [Number(sale.id), sale]));

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function renderProductChecklist(containerId, selectedIds = [], options = {}) {
    const container = document.getElementById(containerId);
    if (!container) {
        return;
    }

    const selectedSet = new Set((selectedIds || []).map((value) => Number(value)));
    const prefix = options.prefix || containerId;
    const inputName = options.inputName || 'product_ids[]';
    const showSale = options.showSale === true;

    if (!adminSaleProducts.length) {
        container.innerHTML = '<div class="admin-product-checklist__empty">Không có sản phẩm để chọn.</div>';
        return;
    }

    container.innerHTML = adminSaleProducts.map((product) => {
        const productId = Number(product.id);
        const metaParts = [];

        if (product.sku) {
            metaParts.push(`SKU: ${escapeHtml(product.sku)}`);
        }

        if (showSale && product.sale_name) {
            metaParts.push(`Đang ở: ${escapeHtml(product.sale_name)}`);
        }

        const checkboxId = `${prefix}-${productId}`;
        const meta = metaParts.length > 0 ? metaParts.join(' • ') : 'Không có thông tin bổ sung';
        const checked = selectedSet.has(productId) ? 'checked' : '';
        const searchText = escapeHtml([product.name, product.sku, product.sale_name].filter(Boolean).join(' ').toLowerCase());

        return `
            <label class="admin-product-checklist__item" data-search="${searchText}" for="${checkboxId}">
                <input type="checkbox" id="${checkboxId}" name="${inputName}" value="${productId}" ${checked}>
                <div class="admin-product-checklist__body">
                    <span class="admin-product-checklist__name">${escapeHtml(product.name)}</span>
                    <span class="admin-product-checklist__meta">${meta}</span>
                </div>
            </label>
        `;
    }).join('');
}

function filterProductChecklist(input, containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
        return;
    }

    const keyword = String(input.value || '').trim().toLowerCase();
    container.querySelectorAll('.admin-product-checklist__item').forEach((item) => {
        const searchText = item.dataset.search || item.textContent.toLowerCase();
        item.style.display = !keyword || searchText.includes(keyword) ? '' : 'none';
    });
}

function setChecklistState(containerId, checked) {
    const container = document.getElementById(containerId);
    if (!container) {
        return;
    }

    container.querySelectorAll('input[type="checkbox"]').forEach((input) => {
        input.checked = checked;
    });
}

function getCheckedProductIds(containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
        return [];
    }

    return Array.from(container.querySelectorAll('input[type="checkbox"]:checked'))
        .map((input) => Number(input.value))
        .filter((value) => Number.isInteger(value) && value > 0);
}

function toDatetimeLocal(value) {
    if (!value) {
        return '';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return '';
    }

    const timezoneOffset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16);
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}

function editSale(saleId) {
    const sale = adminSalesMap.get(Number(saleId));
    const form = document.getElementById('editSaleForm');

    if (!sale || !form) {
        showToast('Không tìm thấy dữ liệu khuyến mãi', 'error');
        return;
    }

    form.dataset.saleId = String(sale.id);
    form.elements.name.value = sale.name || '';
    form.elements.description.value = sale.description || '';
    form.elements.type.value = sale.type || 'percentage';
    form.elements.value.value = sale.value || '';
    form.elements.start_date.value = toDatetimeLocal(sale.start_date);
    form.elements.end_date.value = toDatetimeLocal(sale.end_date);
    form.elements.is_active.checked = Boolean(sale.is_active);

    renderProductChecklist('editSaleProducts', sale.product_ids || [], {
        prefix: `edit-sale-${sale.id}`,
        showSale: true
    });

    document.getElementById('editSaleModal').style.display = 'flex';
}

async function submitEditSale(event) {
    event.preventDefault();

    const form = event.currentTarget;
    if (!form.reportValidity()) {
        return;
    }

    const saleId = form.dataset.saleId;
    if (!saleId) {
        showToast('Không xác định được khuyến mãi cần sửa', 'error');
        return;
    }

    const payload = {
        name: form.name.value.trim(),
        description: form.description.value.trim(),
        type: form.type.value,
        value: form.value.value,
        start_date: form.start_date.value || null,
        end_date: form.end_date.value || null,
        is_active: form.is_active.checked,
        product_ids: getCheckedProductIds('editSaleProducts')
    };

    try {
        const response = await fetch('/admin/sales/' + saleId, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Không thể cập nhật khuyến mãi');
        }

        showToast(data.message || 'Đã cập nhật khuyến mãi');
        closeModal('editSaleModal');
        setTimeout(() => location.reload(), 500);
    } catch (error) {
        showToast(error.message || 'Có lỗi xảy ra', 'error');
    }
}

function deleteSale(saleId) {
    const modal = document.getElementById('confirmModal');
    modal.style.display = 'flex';

    document.getElementById('confirmYes').onclick = async function() {
        try {
            const response = await fetch('/admin/sales/' + saleId, {
                method: 'DELETE'
            });
            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Không thể xóa khuyến mãi');
            }

            showToast(data.message || 'Đã ngừng khuyến mãi');
            setTimeout(() => location.reload(), 500);
        } catch (error) {
            showToast(error.message || 'Có lỗi xảy ra', 'error');
        }

        modal.style.display = 'none';
    };

    document.getElementById('confirmNo').onclick = function() {
        modal.style.display = 'none';
    };
}

function toggleSection(titleElement) {
    const section = titleElement.closest('.admin-section--collapsible');
    section.classList.toggle('is-open');
}

function showToast(message, type = 'success') {
    if (typeof showGlobalToast === 'function') {
        showGlobalToast(message, type);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    renderProductChecklist('createSaleProducts', [], {
        prefix: 'create-sale',
        showSale: true
    });

    document.querySelectorAll('[data-admin-toggle="section"]').forEach((button) => {
        button.addEventListener('click', () => toggleSection(button));
    });

    document.querySelectorAll('[data-checklist-search]').forEach((input) => {
        input.addEventListener('input', () => filterProductChecklist(input, input.dataset.checklistSearch));
    });

    document.querySelectorAll('[data-checklist-toggle]').forEach((button) => {
        button.addEventListener('click', () => {
            setChecklistState(button.dataset.checklistTarget, button.dataset.checklistToggle === 'all');
        });
    });

    document.querySelectorAll('[data-sale-action="edit"]').forEach((button) => {
        button.addEventListener('click', () => editSale(button.dataset.saleId));
    });

    document.querySelectorAll('[data-sale-action="delete"]').forEach((button) => {
        button.addEventListener('click', () => deleteSale(button.dataset.saleId));
    });

    document.querySelectorAll('[data-sale-modal-close]').forEach((button) => {
        button.addEventListener('click', () => closeModal(button.dataset.saleModalClose));
    });

    document.getElementById('editSaleForm')?.addEventListener('submit', submitEditSale);

    ['editSaleModal', 'confirmModal'].forEach((modalId) => {
        const modal = document.getElementById(modalId);
        if (!modal) {
            return;
        }

        modal.addEventListener('click', function(event) {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        });
    });
});
