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

// =========================================================================
// DELETE BANNER
// =========================================================================
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

// =========================================================================
// TOGGLE BANNER ACTIVE
// =========================================================================
async function toggleBannerActive(bannerId) {
    try {
        const response = await fetch(`/admin/banners/${bannerId}/toggle`, {
            method: 'PUT',
            credentials: 'same-origin'
        });

        const result = await response.json();
        if (result.success) {
            showBannerToast(result.is_active ? 'Banner đã được hiện!' : 'Banner đã được ẩn!', 'success');
            setTimeout(() => location.reload(), 800);
        } else {
            showBannerToast(`Lỗi: ${result.message}`, 'error');
        }
    } catch (error) {
        showBannerToast(`Lỗi: ${error.message}`, 'error');
    }
}

// =========================================================================
// DRAG AND DROP REORDER
// =========================================================================
function initDragAndDrop() {
    const grid = document.getElementById('bannersGrid');
    if (!grid) return;

    let draggedCard = null;

    grid.addEventListener('dragstart', (e) => {
        draggedCard = e.target.closest('.banner-card');
        if (!draggedCard) return;
        draggedCard.classList.add('banner-card--dragging');
        e.dataTransfer.effectAllowed = 'move';
    });

    grid.addEventListener('dragend', () => {
        if (draggedCard) {
            draggedCard.classList.remove('banner-card--dragging');
            draggedCard = null;
        }
        // Remove all drag-over classes
        grid.querySelectorAll('.banner-card--drag-over').forEach(c => c.classList.remove('banner-card--drag-over'));

        // Save new order
        saveOrder();
    });

    grid.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        const overCard = e.target.closest('.banner-card');
        if (!overCard || overCard === draggedCard) return;

        // Remove previous highlights
        grid.querySelectorAll('.banner-card--drag-over').forEach(c => c.classList.remove('banner-card--drag-over'));
        overCard.classList.add('banner-card--drag-over');

        // Determine insertion position
        const rect = overCard.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;

        if (e.clientY < midY) {
            grid.insertBefore(draggedCard, overCard);
        } else {
            grid.insertBefore(draggedCard, overCard.nextSibling);
        }
    });

    grid.addEventListener('dragleave', (e) => {
        const overCard = e.target.closest('.banner-card');
        if (overCard) overCard.classList.remove('banner-card--drag-over');
    });
}

async function saveOrder() {
    const grid = document.getElementById('bannersGrid');
    if (!grid) return;

    const cards = grid.querySelectorAll('.banner-card');
    const items = [];
    cards.forEach((card, index) => {
        items.push({ id: parseInt(card.dataset.bannerId, 10), display_order: index });
        // Update visual order number
        const orderBadge = card.querySelector('.banner-card__order');
        if (orderBadge) orderBadge.textContent = `#${index + 1}`;
    });

    try {
        const response = await fetch('/admin/banners/reorder', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ items })
        });

        const result = await response.json();
        if (result.success) {
            showBannerToast('Đã lưu thứ tự!', 'success');
        }
    } catch (error) {
        console.error('Reorder error:', error);
    }
}

// =========================================================================
// EDIT BANNER
// =========================================================================
let bannersData = [];
try {
    const el = document.getElementById('bannersBootstrap');
    if (el) bannersData = JSON.parse(el.textContent);
} catch (_) { /* ignore */ }

function openEditModal(bannerId) {
    const banner = bannersData.find(b => b.id === parseInt(bannerId, 10));
    if (!banner) return;

    document.getElementById('editBannerId').value = banner.id;
    document.getElementById('editBannerTitle').value = banner.title;
    document.getElementById('editBannerSubtitle').value = banner.subtitle;
    document.getElementById('editBannerLinkUrl').value = banner.link_url;
    document.getElementById('editBannerImage').value = '';

    document.getElementById('editBannerModal').style.display = 'flex';
}

function closeEditModal() {
    document.getElementById('editBannerModal').style.display = 'none';
}

async function submitEditBanner(e) {
    e.preventDefault();

    const id = document.getElementById('editBannerId').value;
    const formData = new FormData();
    formData.append('title', document.getElementById('editBannerTitle').value);
    formData.append('subtitle', document.getElementById('editBannerSubtitle').value);
    formData.append('link_url', document.getElementById('editBannerLinkUrl').value);

    const imageFile = document.getElementById('editBannerImage').files[0];
    if (imageFile) {
        formData.append('image', imageFile);
    }

    try {
        const response = await fetch(`/admin/banners/${id}`, {
            method: 'PUT',
            credentials: 'same-origin',
            body: formData
        });

        const result = await response.json();
        if (result.success) {
            showBannerToast('Đã cập nhật banner!', 'success');
            setTimeout(() => location.reload(), 1000);
        } else {
            showBannerToast(`Lỗi: ${result.message}`, 'error');
        }
    } catch (error) {
        showBannerToast(`Lỗi: ${error.message}`, 'error');
    }
}

// =========================================================================
// INIT
// =========================================================================
function initAdminBannersPage() {
    document.querySelectorAll('[data-admin-toggle="section"]').forEach((button) => {
        button.addEventListener('click', () => toggleBannerSection(button));
    });

    document.querySelectorAll('[data-banner-action="delete"]').forEach((button) => {
        button.addEventListener('click', () => deleteBanner(button.dataset.bannerId));
    });

    document.querySelectorAll('[data-banner-action="toggle"]').forEach((button) => {
        button.addEventListener('click', () => toggleBannerActive(button.dataset.bannerId));
    });

    document.querySelectorAll('[data-banner-action="edit"]').forEach((button) => {
        button.addEventListener('click', () => openEditModal(button.dataset.bannerId));
    });

    // Edit modal events
    document.getElementById('editBannerClose')?.addEventListener('click', closeEditModal);
    document.getElementById('editBannerCancel')?.addEventListener('click', closeEditModal);
    document.getElementById('editBannerForm')?.addEventListener('submit', submitEditBanner);

    initDragAndDrop();
}

document.addEventListener('DOMContentLoaded', initAdminBannersPage);
