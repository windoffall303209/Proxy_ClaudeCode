function initAdminOrderDetailPage() {
    const page = document.querySelector('.admin-page[data-order-id]');
    const orderId = page?.dataset.orderId;
    const statusSelect = document.getElementById('statusSelect');

    if (!orderId || !statusSelect) {
        return;
    }

    document.querySelectorAll('[data-order-detail-action="update-status"]').forEach((button) => {
        button.addEventListener('click', async () => {
            try {
                const response = await fetch(`/admin/orders/${orderId}/status`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: statusSelect.value })
                });

                if (response.ok) {
                    if (typeof showGlobalToast === 'function') {
                        showGlobalToast('Cập nhật trạng thái thành công!', 'success');
                    }
                    setTimeout(() => location.reload(), 1000);
                } else if (typeof showGlobalToast === 'function') {
                    showGlobalToast('Lỗi cập nhật trạng thái', 'error');
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
