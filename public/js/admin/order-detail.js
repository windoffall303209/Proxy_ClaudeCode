function updateStatusSelectClass(select) {
    if (!select) {
        return;
    }

    select.className = `admin-form__select order-status-select order-status-select--${select.value}`;
}

function getFieldValue(id) {
    return document.getElementById(id)?.value ?? '';
}

function buildTrackingPayload(statusValue) {
    return {
        status: statusValue,
        carrier: getFieldValue('carrierInput'),
        tracking_code: getFieldValue('trackingCodeInput'),
        tracking_url: getFieldValue('trackingUrlInput'),
        current_location_text: getFieldValue('locationInput'),
        current_lat: getFieldValue('latInput'),
        current_lng: getFieldValue('lngInput'),
        estimated_delivery_at: getFieldValue('etaInput'),
        status_title: getFieldValue('statusTitleInput'),
        status_note: getFieldValue('statusNoteInput')
    };
}

function initAdminOrderDetailPage() {
    const page = document.querySelector('.admin-page[data-order-id]');
    const orderId = page?.dataset.orderId;
    const statusSelect = document.getElementById('statusSelect');

    if (!orderId || !statusSelect) {
        return;
    }

    updateStatusSelectClass(statusSelect);
    statusSelect.addEventListener('change', () => updateStatusSelectClass(statusSelect));

    document.querySelectorAll('[data-order-detail-action="update-status"]').forEach((button) => {
        button.addEventListener('click', async () => {
            try {
                const response = await fetch(`/admin/orders/${orderId}/status`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(buildTrackingPayload(statusSelect.value))
                });

                if (response.ok) {
                    if (typeof showGlobalToast === 'function') {
                        showGlobalToast('Cập nhật tracking thành công.', 'success');
                    }
                    setTimeout(() => location.reload(), 800);
                    return;
                }

                const data = await response.json().catch(() => ({}));
                if (typeof showGlobalToast === 'function') {
                    showGlobalToast(data.message || 'Lỗi cập nhật tracking', 'error');
                }
            } catch (error) {
                if (typeof showGlobalToast === 'function') {
                    showGlobalToast(`Lỗi: ${error.message}`, 'error');
                }
            }
        });
    });
}

document.addEventListener('DOMContentLoaded', initAdminOrderDetailPage);
