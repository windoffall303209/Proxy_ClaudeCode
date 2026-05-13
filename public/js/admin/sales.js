// Điều phối tương tác trình duyệt cho màn quản trị khuyến mãi trong khu vực admin.
const adminSalesBootstrap = JSON.parse(document.getElementById('adminSalesBootstrap').textContent);
const adminSaleProducts = adminSalesBootstrap.products || [];
const adminSubscriberCount = Number(adminSalesBootstrap.subscriberCount || 0);
const adminSales = adminSalesBootstrap.sales || [];
const adminSalesMap = new Map(adminSales.map((sale) => [Number(sale.id), sale]));

// Xử lý escape html.
function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Hiển thị sản phẩm checklist.
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

// Lọc sản phẩm checklist.
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

// Xử lý set checklist state.
function setChecklistState(containerId, checked) {
    const container = document.getElementById(containerId);
    if (!container) {
        return;
    }

    container.querySelectorAll('input[type="checkbox"]').forEach((input) => {
        input.checked = checked;
    });
}

// Lấy checked sản phẩm ids.
function getCheckedProductIds(containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
        return [];
    }

    return Array.from(container.querySelectorAll('input[type="checkbox"]:checked'))
        .map((input) => Number(input.value))
        .filter((value) => Number.isInteger(value) && value > 0);
}

// Xử lý vào datetime local.
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

// Đồng bộ percentage warning.
function syncPercentageWarning(selectId, inputId, warningId) {
    const typeElement = document.getElementById(selectId);
    const valueInput = document.getElementById(inputId);
    const warningElement = document.getElementById(warningId);

    if (!typeElement || !valueInput) {
        return;
    }

    const isPercentage = typeElement.value === 'percentage';
    const valueNumber = Number(valueInput.value);
    const isInvalid = isPercentage && Number.isFinite(valueNumber) && valueInput.value !== '' && valueNumber >= 100;

    valueInput.setCustomValidity(isInvalid ? 'Giá trị phần trăm phải nhỏ hơn 100%.' : '');
    if (warningElement) {
        warningElement.hidden = !isInvalid;
    }
}

// Bật/tắt khuyến mãi value constraints.
function toggleSaleValueConstraints(selectId, inputId, warningId) {
    const typeElement = document.getElementById(selectId);
    const valueInput = document.getElementById(inputId);

    if (!typeElement || !valueInput) {
        return;
    }

    valueInput.min = '0.01';

    if (typeElement.value === 'percentage') {
        valueInput.max = '99.99';
    } else {
        valueInput.removeAttribute('max');
    }

    syncPercentageWarning(selectId, inputId, warningId);
}

// Đóng modal.
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}

// Mở modal.
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
    }
}

// Xử lý confirm action.
async function confirmAction(options) {
    if (typeof showGlobalConfirm === 'function') {
        return showGlobalConfirm(options);
    }

    return window.confirm(options?.message || 'Bạn có chắc muốn tiếp tục?');
}

// Xử lý edit khuyến mãi.
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
    toggleSaleValueConstraints('editSaleType', 'editSaleValue', 'editSaleValueWarning');

    renderProductChecklist('editSaleProducts', sale.product_ids || [], {
        prefix: `edit-sale-${sale.id}`,
        showSale: true
    });

    openModal('editSaleModal');
}

// Xử lý submit edit khuyến mãi.
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

// Xóa khuyến mãi.
async function deleteSale(saleId) {
    const sale = adminSalesMap.get(Number(saleId));
    const confirmed = await confirmAction({
        title: 'Xóa khuyến mãi',
        message: `Bạn có chắc muốn ngừng khuyến mãi ${sale?.name || 'này'} không?`,
        confirmText: 'Xóa',
        cancelText: 'Hủy',
        tone: 'danger'
    });

    if (!confirmed) {
        return;
    }

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
}

// Xử lý show toast.
function showToast(message, type = 'success') {
    if (typeof showGlobalToast === 'function') {
        showGlobalToast(message, type);
    }
}

// Mở add khuyến mãi form.
function openAddSaleForm() {
    const section = document.querySelector('.admin-section--collapsible');
    if (section) {
        section.classList.add('is-open');
        section.scrollIntoView({ behavior: 'smooth' });
    }
}

// Mở khuyến mãi email modal.
function openSaleEmailModal(saleId = null) {
    const select = document.getElementById('saleEmailSelect');

    if (!select || adminSubscriberCount <= 0 || adminSales.length === 0) {
        showToast('Hiện chưa thể gửi email thông báo cho khuyến mãi.', 'warning');
        return;
    }

    if (saleId && adminSalesMap.has(Number(saleId))) {
        select.value = String(saleId);
    }

    openModal('saleEmailModal');
}

// Gửi khuyến mãi announcement email.
async function sendSaleAnnouncementEmail(saleId) {
    const response = await fetch('/admin/sales/' + saleId + '/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    });
    const data = await response.json();

    if (!response.ok || data.success === false) {
        throw new Error(data.message || 'Không thể gửi email thông báo');
    }

    showToast(data.message || 'Đã gửi email thông báo', data.toastType || 'success');
    closeModal('saleEmailModal');
}

// Xử lý confirm and send khuyến mãi email.
async function confirmAndSendSaleEmail(saleId) {
    if (adminSubscriberCount <= 0) {
        showToast('Hiện chưa có người dùng đăng ký nhận bản tin.', 'warning');
        return;
    }

    const sale = adminSalesMap.get(Number(saleId));
    if (!sale) {
        showToast('Không tìm thấy khuyến mãi để gửi email', 'error');
        return;
    }

    const confirmed = await confirmAction({
        title: 'Gửi email thông báo',
        message: `Bạn chắc chắn muốn gửi thông báo về khuyến mãi ${sale.name} tới người dùng đã đăng ký chứ?`,
        confirmText: 'Gửi email',
        cancelText: 'Hủy'
    });

    if (!confirmed) {
        return;
    }

    try {
        await sendSaleAnnouncementEmail(saleId);
    } catch (error) {
        showToast(error.message || 'Có lỗi xảy ra', 'error');
    }
}

// Xử lý submit khuyến mãi email form.
async function submitSaleEmailForm(event) {
    event.preventDefault();

    const select = document.getElementById('saleEmailSelect');
    const saleId = Number(select?.value);

    if (!saleId) {
        showToast('Vui lòng chọn khuyến mãi cần gửi email', 'warning');
        return;
    }

    await confirmAndSendSaleEmail(saleId);
}

// Bật/tắt section.
function toggleSection(titleElement) {
    const section = titleElement.closest('.admin-section--collapsible');
    section.classList.toggle('is-open');
}
document.addEventListener('DOMContentLoaded', function() {
    renderProductChecklist('createSaleProducts', [], {
        prefix: 'create-sale',
        showSale: true
    });
    toggleSaleValueConstraints('createSaleType', 'createSaleValue', 'createSaleValueWarning');
    toggleSaleValueConstraints('editSaleType', 'editSaleValue', 'editSaleValueWarning');

    document.querySelectorAll('[data-admin-toggle="section"]').forEach((button) => {
        button.addEventListener('click', () => toggleSection(button));
    });

    document.querySelectorAll('[data-sale-action="scroll-to-form"]').forEach((button) => {
        button.addEventListener('click', openAddSaleForm);
    });

    document.querySelectorAll('[data-sale-action="open-email-modal"]').forEach((button) => {
        button.addEventListener('click', () => openSaleEmailModal());
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

    document.querySelectorAll('[data-sale-action="email"]').forEach((button) => {
        button.addEventListener('click', () => confirmAndSendSaleEmail(button.dataset.saleId));
    });

    document.querySelectorAll('[data-sale-modal-close]').forEach((button) => {
        button.addEventListener('click', () => closeModal(button.dataset.saleModalClose));
    });

    document.getElementById('editSaleForm')?.addEventListener('submit', submitEditSale);
    document.getElementById('saleEmailForm')?.addEventListener('submit', submitSaleEmailForm);
    document.getElementById('createSaleType')?.addEventListener('change', () => toggleSaleValueConstraints('createSaleType', 'createSaleValue', 'createSaleValueWarning'));
    document.getElementById('editSaleType')?.addEventListener('change', () => toggleSaleValueConstraints('editSaleType', 'editSaleValue', 'editSaleValueWarning'));
    document.getElementById('createSaleValue')?.addEventListener('input', () => syncPercentageWarning('createSaleType', 'createSaleValue', 'createSaleValueWarning'));
    document.getElementById('editSaleValue')?.addEventListener('input', () => syncPercentageWarning('editSaleType', 'editSaleValue', 'editSaleValueWarning'));

    ['editSaleModal', 'saleEmailModal'].forEach((modalId) => {
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
