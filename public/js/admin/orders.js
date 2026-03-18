// Admin Orders page JavaScript

/**
 * Update order status
 * @param {number} orderId - Order ID
 * @param {string} status - New status
 */
async function updateOrderStatus(orderId, status) {
    try {
        const response = await fetch(`/admin/orders/${orderId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
        if (response.ok) {
            showGlobalToast('Cập nhật trạng thái thành công!', 'success');
            setTimeout(() => location.reload(), 1500);
        } else {
            showGlobalToast('Lỗi cập nhật trạng thái', 'error');
        }
    } catch (error) {
        showGlobalToast('Lỗi: ' + error.message, 'error');
    }
}

/**
 * View order detail
 * @param {number} orderId - Order ID
 */
function viewOrderDetail(orderId) {
    window.location.href = '/admin/orders/' + orderId;
}
