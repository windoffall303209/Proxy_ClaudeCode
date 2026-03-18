function showBannerToast(message, type = 'success') {
    if (typeof showGlobalToast === 'function') {
        showGlobalToast(message, type);
    }
}

function showBannerConfirm(message, title = 'Xác nhận') {
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

function toggleBannerSection(titleElement) {
    const section = titleElement.closest('.admin-section--collapsible');
    section?.classList.toggle('is-open');
}

async function deleteBanner(bannerId) {
    const confirmed = await showBannerConfirm('Bạn có chắc muốn xóa banner này?', 'Xóa Banner');
    if (!confirmed) return;

    try {
        const response = await fetch(`/admin/banners/${bannerId}`, {
            method: 'DELETE',
            credentials: 'same-origin'
        });

        if (response.ok) {
            showBannerToast('Đã xóa banner thành công!', 'success');
            setTimeout(() => location.reload(), 1500);
        } else {
            const result = await response.json();
            showBannerToast(`Lỗi: ${result.message || 'Không thể xóa banner'}`, 'error');
        }
    } catch (error) {
        showBannerToast(`Lỗi: ${error.message}`, 'error');
    }
}

function initAdminBannersPage() {
    document.querySelectorAll('[data-admin-toggle="section"]').forEach((button) => {
        button.addEventListener('click', () => toggleBannerSection(button));
    });

    document.querySelectorAll('[data-banner-action="delete"]').forEach((button) => {
        button.addEventListener('click', () => deleteBanner(button.dataset.bannerId));
    });
}

document.addEventListener('DOMContentLoaded', initAdminBannersPage);
