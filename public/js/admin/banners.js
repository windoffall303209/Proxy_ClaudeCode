// Admin Banners page JavaScript

// Use global toast from toast.js
function showToast(message, type = 'success') {
    if (typeof showGlobalToast === 'function') showGlobalToast(message, type);
}

/**
 * Show confirm modal
 * @param {string} message - Confirmation message
 * @param {string} title - Modal title
 * @returns {Promise<boolean>}
 */
function showConfirm(message, title = 'Xác nhận') {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirmModal');
        document.getElementById('confirmTitle').textContent = title;
        document.getElementById('confirmMessage').textContent = message;
        modal.style.display = 'flex';
        
        document.getElementById('confirmYes').onclick = () => {
            modal.style.display = 'none';
            resolve(true);
        };
        document.getElementById('confirmNo').onclick = () => {
            modal.style.display = 'none';
            resolve(false);
        };
    });
}

/**
 * Delete banner
 * @param {number} bannerId - Banner ID
 */
async function deleteBanner(bannerId) {
    const confirmed = await showConfirm('Bạn có chắc muốn xóa banner này?', 'Xóa Banner');
    if (!confirmed) return;
    
    try {
        const response = await fetch(`/admin/banners/${bannerId}`, {
            method: 'DELETE',
            credentials: 'same-origin'
        });
        
        if (response.ok) {
            showToast('Đã xóa banner thành công!', 'success');
            setTimeout(() => location.reload(), 1500);
        } else {
            const result = await response.json();
            showToast('Lỗi: ' + (result.message || 'Không thể xóa banner'), 'error');
        }
    } catch (error) {
        showToast('Lỗi: ' + error.message, 'error');
    }
}
