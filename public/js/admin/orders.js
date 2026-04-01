function showOrdersToast(message, type = 'success') {
    if (typeof showGlobalToast === 'function') {
        showGlobalToast(message, type);
    }
}

async function updateOrderStatus(orderId, status) {
    try {
        const response = await fetch(`/admin/orders/${orderId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });

        if (response.ok) {
            showOrdersToast('Cập nhật trạng thái thành công!', 'success');
            setTimeout(() => location.reload(), 1000);
            return;
        }

        const data = await response.json().catch(() => ({}));
        showOrdersToast(data.message || 'Lỗi cập nhật trạng thái', 'error');
    } catch (error) {
        showOrdersToast(`Lỗi: ${error.message}`, 'error');
    }
}

function closeOrderModal() {
    document.getElementById('orderDetailModal')?.style.setProperty('display', 'none');
}

function printOrder(orderId) {
    window.open(`/admin/orders/${orderId}/print`, '_blank');
}

function initOrderTabs() {
    document.querySelectorAll('.order-tab').forEach((tab) => {
        tab.addEventListener('click', function() {
            document.querySelectorAll('.order-tab').forEach((item) => item.classList.remove('active'));
            this.classList.add('active');

            const status = this.dataset.status;
            document.querySelectorAll('tbody tr[data-status]').forEach((row) => {
                row.hidden = !(status === 'all' || row.dataset.status === status);
            });
        });
    });
}

function initOrderActions() {
    document.querySelectorAll('.order-status-select[data-order-id]').forEach((select) => {
        select.addEventListener('change', () => {
            select.className = `order-status-select order-status-select--${select.value}`;
            updateOrderStatus(select.dataset.orderId, select.value);
        });
    });

    document.querySelectorAll('[data-order-action="print"]').forEach((button) => {
        button.addEventListener('click', () => {
            printOrder(button.dataset.orderId);
        });
    });

    document.querySelectorAll('[data-order-modal-close]').forEach((button) => {
        button.addEventListener('click', closeOrderModal);
    });

    document.getElementById('orderDetailModal')?.addEventListener('click', (event) => {
        if (event.target.id === 'orderDetailModal') {
            closeOrderModal();
        }
    });
}

function initAdminOrdersPage() {
    initOrderTabs();
    initOrderActions();
}

document.addEventListener('DOMContentLoaded', initAdminOrdersPage);
