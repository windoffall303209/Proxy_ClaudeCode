// Điều phối tương tác trình duyệt cho màn quản trị đổi trả trong khu vực admin.
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.return-status-form').forEach((form) => {
        form.addEventListener('submit', async (event) => {
            event.preventDefault();

            const returnId = form.dataset.returnId;
            const formData = new FormData(form);
            const button = form.querySelector('button[type="submit"]');
            const originalText = button ? button.textContent : '';

            if (button) {
                button.disabled = true;
                button.textContent = 'Đang lưu...';
            }

            try {
                const response = await fetch(`/admin/returns/${returnId}/status`, {
                    method: 'PUT',
                    credentials: 'same-origin',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        status: formData.get('status'),
                        admin_note: formData.get('admin_note')
                    })
                });
                const data = await response.json();

                if (!response.ok || data.success === false) {
                    throw new Error(data.message || 'Không thể cập nhật yêu cầu hoàn hàng');
                }

                if (typeof showGlobalToast === 'function') {
                    showGlobalToast(data.message || 'Đã cập nhật yêu cầu hoàn hàng', 'success');
                }

                window.setTimeout(() => window.location.reload(), 700);
            } catch (error) {
                if (typeof showGlobalToast === 'function') {
                    showGlobalToast(error.message, 'error');
                }
            } finally {
                if (button) {
                    button.disabled = false;
                    button.textContent = originalText;
                }
            }
        });
    });
});
