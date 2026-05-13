// Điều phối tương tác trình duyệt cho màn quản trị đơn hàng trong khu vực admin.
function showOrdersToast(message, type = 'success') {
    if (typeof showGlobalToast === 'function') {
        showGlobalToast(message, type);
    }
}

// Cập nhật đơn hàng trạng thái.
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

// Đóng đơn hàng modal.
function closeOrderModal() {
    document.getElementById('orderDetailModal')?.style.setProperty('display', 'none');
}

// Xử lý print đơn hàng.
function printOrder(orderId) {
    window.open(`/admin/orders/${orderId}/print`, '_blank');
}

// Khởi tạo đơn hàng tabs.
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

function formatPaymentCountdown(milliseconds) {
    if (milliseconds <= 0) {
        return 'Đã quá hạn';
    }

    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `Còn ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function initPaymentCountdowns() {
    const countdowns = Array.from(document.querySelectorAll('[data-payment-countdown]'));
    if (countdowns.length === 0) {
        return;
    }

    const tick = () => {
        const now = Date.now();
        countdowns.forEach((node) => {
            const expiresAt = new Date(node.dataset.expiresAt || '').getTime();
            const remaining = Number.isFinite(expiresAt) ? expiresAt - now : 0;
            node.textContent = formatPaymentCountdown(remaining);
            node.classList.toggle('is-expired', remaining <= 0);
        });
    };

    tick();
    setInterval(tick, 1000);
}

// Khởi tạo đơn hàng actions.
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

// Khởi tạo quản trị đơn hàng trang.
function initAdminOrdersPage() {
    initOrderTabs();
    initOrderActions();
    initPaymentCountdowns();
}
document.addEventListener('DOMContentLoaded', initAdminOrdersPage);
