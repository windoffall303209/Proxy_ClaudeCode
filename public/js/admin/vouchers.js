const adminVouchersBootstrap = JSON.parse(document.getElementById('adminVouchersBootstrap').textContent);
const adminVoucherProducts = adminVouchersBootstrap.products || [];
const adminSubscriberCount = Number(adminVouchersBootstrap.subscriberCount || 0);
const adminVouchers = adminVouchersBootstrap.vouchers || [];
const adminVouchersMap = new Map(adminVouchers.map((voucher) => [Number(voucher.id), voucher]));

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

    if (!adminVoucherProducts.length) {
        container.innerHTML = '<div class="admin-product-checklist__empty">Không có sản phẩm để chọn.</div>';
        return;
    }

    container.innerHTML = adminVoucherProducts.map((product) => {
        const productId = Number(product.id);
        const checkboxId = `${prefix}-${productId}`;
        const checked = selectedSet.has(productId) ? 'checked' : '';
        const searchText = escapeHtml([product.name, product.sku].filter(Boolean).join(' ').toLowerCase());
        const meta = product.sku ? `SKU: ${escapeHtml(product.sku)}` : 'Không có SKU';

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

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
    }
}

async function confirmAction(options) {
    if (typeof showGlobalConfirm === 'function') {
        return showGlobalConfirm(options);
    }

    return window.confirm(options?.message || 'Bạn có chắc muốn tiếp tục?');
}

function toggleMaxDiscount(selectId = 'voucherType', groupId = 'maxDiscountGroup') {
    const typeElement = document.getElementById(selectId);
    const maxDiscountGroup = document.getElementById(groupId);

    if (!typeElement || !maxDiscountGroup) {
        return;
    }

    const input = maxDiscountGroup.querySelector('input');
    const isPercentage = typeElement.value === 'percentage';

    maxDiscountGroup.style.display = isPercentage ? 'flex' : 'none';

    if (input) {
        input.disabled = !isPercentage;
        if (!isPercentage) {
            input.value = '';
        }
    }
}

function editVoucher(voucherId) {
    const voucher = adminVouchersMap.get(Number(voucherId));
    const form = document.getElementById('editVoucherForm');

    if (!voucher || !form) {
        showToast('Không tìm thấy dữ liệu voucher', 'error');
        return;
    }

    form.dataset.voucherId = String(voucher.id);
    form.elements.code.value = voucher.code || '';
    form.elements.name.value = voucher.name || '';
    form.elements.description.value = voucher.description || '';
    form.elements.type.value = voucher.type || 'percentage';
    form.elements.value.value = voucher.value || '';
    form.elements.min_order_amount.value = voucher.min_order_amount || 0;
    form.elements.max_discount_amount.value = voucher.max_discount_amount || '';
    form.elements.usage_limit.value = voucher.usage_limit || '';
    form.elements.user_limit.value = voucher.user_limit || 1;
    form.elements.start_date.value = toDatetimeLocal(voucher.start_date);
    form.elements.end_date.value = toDatetimeLocal(voucher.end_date);
    form.elements.is_active.checked = Boolean(voucher.is_active);

    renderProductChecklist('editVoucherProducts', voucher.product_ids || [], {
        prefix: `edit-voucher-${voucher.id}`
    });

    toggleMaxDiscount('editVoucherType', 'editMaxDiscountGroup');
    openModal('editVoucherModal');
}

async function submitEditVoucher(event) {
    event.preventDefault();

    const form = event.currentTarget;
    if (!form.reportValidity()) {
        return;
    }

    const voucherId = form.dataset.voucherId;
    if (!voucherId) {
        showToast('Không xác định được voucher cần sửa', 'error');
        return;
    }

    const payload = {
        code: form.elements.code.value.trim().toUpperCase(),
        name: form.elements.name.value.trim(),
        description: form.elements.description.value.trim(),
        type: form.elements.type.value,
        value: form.elements.value.value,
        min_order_amount: form.elements.min_order_amount.value || 0,
        max_discount_amount: form.elements.max_discount_amount.value || null,
        usage_limit: form.elements.usage_limit.value || null,
        user_limit: form.elements.user_limit.value || 1,
        start_date: form.elements.start_date.value,
        end_date: form.elements.end_date.value,
        is_active: form.elements.is_active.checked,
        product_ids: getCheckedProductIds('editVoucherProducts')
    };

    try {
        const response = await fetch('/admin/vouchers/' + voucherId, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Không thể cập nhật voucher');
        }

        showToast(data.message || 'Đã cập nhật voucher');
        closeModal('editVoucherModal');
        setTimeout(() => location.reload(), 500);
    } catch (error) {
        showToast(error.message || 'Có lỗi xảy ra', 'error');
    }
}

async function deleteVoucher(voucherId) {
    const voucher = adminVouchersMap.get(Number(voucherId));
    const confirmed = await confirmAction({
        title: 'Xóa voucher',
        message: `Bạn có chắc muốn xóa voucher ${voucher?.code || 'này'} không?`,
        confirmText: 'Xóa',
        cancelText: 'Hủy',
        tone: 'danger'
    });

    if (!confirmed) {
        return;
    }

    try {
        const response = await fetch('/admin/vouchers/' + voucherId, {
            method: 'DELETE'
        });
        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Không thể xóa voucher');
        }

        showToast('Đã xóa voucher thành công');
        setTimeout(() => location.reload(), 500);
    } catch (error) {
        showToast(error.message || 'Có lỗi xảy ra', 'error');
    }
}

async function toggleVoucherStatus(voucherId, newStatus) {
    try {
        const response = await fetch('/admin/vouchers/' + voucherId + '/status', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_active: newStatus })
        });
        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Có lỗi xảy ra');
        }

        showToast(newStatus ? 'Đã kích hoạt voucher' : 'Đã tạm dừng voucher');
        setTimeout(() => location.reload(), 500);
    } catch (error) {
        showToast(error.message || 'Có lỗi xảy ra', 'error');
    }
}

function showToast(message, type = 'success') {
    if (typeof showGlobalToast === 'function') {
        showGlobalToast(message, type);
    }
}

function openAddVoucherModal() {
    const section = document.querySelector('.admin-section--collapsible');
    if (section) {
        section.classList.add('is-open');
        section.scrollIntoView({ behavior: 'smooth' });
    }
}

function openVoucherEmailModal(voucherId = null) {
    const select = document.getElementById('voucherEmailSelect');

    if (!select || adminSubscriberCount <= 0 || adminVouchers.length === 0) {
        showToast('Hiện chưa thể gửi email thông báo cho voucher.', 'warning');
        return;
    }

    if (voucherId && adminVouchersMap.has(Number(voucherId))) {
        select.value = String(voucherId);
    }

    openModal('voucherEmailModal');
}

async function sendVoucherAnnouncementEmail(voucherId) {
    const response = await fetch('/admin/vouchers/' + voucherId + '/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    });
    const data = await response.json();

    if (!response.ok || data.success === false) {
        throw new Error(data.message || 'Không thể gửi email thông báo');
    }

    showToast(data.message || 'Đã gửi email thông báo', data.toastType || 'success');
    closeModal('voucherEmailModal');
}

async function confirmAndSendVoucherEmail(voucherId) {
    if (adminSubscriberCount <= 0) {
        showToast('Hiện chưa có người dùng đăng ký nhận bản tin.', 'warning');
        return;
    }

    const voucher = adminVouchersMap.get(Number(voucherId));
    if (!voucher) {
        showToast('Không tìm thấy voucher để gửi email', 'error');
        return;
    }

    const confirmed = await confirmAction({
        title: 'Gửi email thông báo',
        message: `Bạn chắc chắn muốn gửi thông báo về voucher ${voucher.code} tới người dùng đã đăng ký chứ?`,
        confirmText: 'Gửi email',
        cancelText: 'Hủy'
    });

    if (!confirmed) {
        return;
    }

    try {
        await sendVoucherAnnouncementEmail(voucherId);
    } catch (error) {
        showToast(error.message || 'Có lỗi xảy ra', 'error');
    }
}

async function submitVoucherEmailForm(event) {
    event.preventDefault();

    const select = document.getElementById('voucherEmailSelect');
    const voucherId = Number(select?.value);

    if (!voucherId) {
        showToast('Vui lòng chọn voucher cần gửi email', 'warning');
        return;
    }

    await confirmAndSendVoucherEmail(voucherId);
}

function toggleSection(titleElement) {
    const section = titleElement.closest('.admin-section--collapsible');
    section.classList.toggle('is-open');
}

document.addEventListener('DOMContentLoaded', function() {
    renderProductChecklist('createVoucherProducts', [], {
        prefix: 'create-voucher'
    });
    toggleMaxDiscount();

    document.querySelectorAll('[data-admin-toggle="section"]').forEach((button) => {
        button.addEventListener('click', () => toggleSection(button));
    });

    document.querySelectorAll('[data-voucher-action="scroll-to-form"]').forEach((button) => {
        button.addEventListener('click', openAddVoucherModal);
    });

    document.querySelectorAll('[data-voucher-action="open-email-modal"]').forEach((button) => {
        button.addEventListener('click', () => openVoucherEmailModal());
    });

    document.querySelectorAll('[data-checklist-search]').forEach((input) => {
        input.addEventListener('input', () => filterProductChecklist(input, input.dataset.checklistSearch));
    });

    document.querySelectorAll('[data-checklist-toggle]').forEach((button) => {
        button.addEventListener('click', () => {
            setChecklistState(button.dataset.checklistTarget, button.dataset.checklistToggle === 'all');
        });
    });

    document.querySelectorAll('[data-voucher-action="edit"]').forEach((button) => {
        button.addEventListener('click', () => editVoucher(button.dataset.voucherId));
    });

    document.querySelectorAll('[data-voucher-action="toggle-status"]').forEach((button) => {
        button.addEventListener('click', () => {
            toggleVoucherStatus(button.dataset.voucherId, button.dataset.voucherNextState === 'true');
        });
    });

    document.querySelectorAll('[data-voucher-action="delete"]').forEach((button) => {
        button.addEventListener('click', () => deleteVoucher(button.dataset.voucherId));
    });

    document.querySelectorAll('[data-voucher-action="email"]').forEach((button) => {
        button.addEventListener('click', () => confirmAndSendVoucherEmail(button.dataset.voucherId));
    });

    document.querySelectorAll('[data-voucher-modal-close]').forEach((button) => {
        button.addEventListener('click', () => closeModal(button.dataset.voucherModalClose));
    });

    document.getElementById('voucherType')?.addEventListener('change', () => toggleMaxDiscount());
    document.getElementById('editVoucherType')?.addEventListener('change', () => toggleMaxDiscount('editVoucherType', 'editMaxDiscountGroup'));
    document.getElementById('editVoucherForm')?.addEventListener('submit', submitEditVoucher);
    document.getElementById('voucherEmailForm')?.addEventListener('submit', submitVoucherEmailForm);

    ['editVoucherModal', 'voucherEmailModal'].forEach((modalId) => {
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
