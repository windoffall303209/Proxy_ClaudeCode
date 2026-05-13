// Điều phối tương tác trình duyệt cho màn quản trị banner trong khu vực admin.
function showBannerToast(message, type = 'success') {
    if (typeof showGlobalToast === 'function') {
        showGlobalToast(message, type);
    }
}

// Mở modal xác nhận và trả Promise để thao tác xóa/bật tắt chờ quyết định người dùng.
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

// Thu gọn hoặc mở rộng từng nhóm banner trong màn quản trị.
function toggleBannerSection(titleElement) {
    const section = titleElement.closest('.admin-section--collapsible');
    section?.classList.toggle('is-open');
}

// Xóa banner sau khi người dùng xác nhận trong modal.
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

// Bật/tắt trạng thái hiển thị banner mà không rời trang danh sách.
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

// Kéo thả để sắp xếp lại thứ tự banner trước khi lưu lên server.
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
        // Xóa highlight cũ trước khi đánh dấu vị trí thả mới.
        grid.querySelectorAll('.banner-card--drag-over').forEach(c => c.classList.remove('banner-card--drag-over'));

        // Lưu lại thứ tự mới ngay sau khi thả để giao diện và server đồng bộ.
        saveOrder();
    });
    grid.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        const overCard = e.target.closest('.banner-card');
        if (!overCard || overCard === draggedCard) return;

        // Chỉ giữ một vùng highlight để người dùng thấy rõ vị trí chèn.
        grid.querySelectorAll('.banner-card--drag-over').forEach(c => c.classList.remove('banner-card--drag-over'));
        overCard.classList.add('banner-card--drag-over');

        // So sánh vị trí chuột với giữa item để quyết định chèn trước hay sau.
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

// Gửi thứ tự banner hiện tại lên server sau khi kéo thả.
async function saveOrder() {
    const grid = document.getElementById('bannersGrid');
    if (!grid) return;

    const cards = grid.querySelectorAll('.banner-card');
    const items = [];
    cards.forEach((card, index) => {
        items.push({ id: parseInt(card.dataset.bannerId, 10), display_order: index });
        // Cập nhật số thứ tự hiển thị để người dùng thấy kết quả ngay.
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

// Dữ liệu bootstrap từ EJS giúp mở modal chỉnh sửa mà không cần gọi API riêng.
let bannersData = [];
try {
    const el = document.getElementById('bannersBootstrap');
    if (el) bannersData = JSON.parse(el.textContent);
} catch (_) { /* ignore */ }

// Nạp dữ liệu banner vào modal chỉnh sửa.
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

// Đóng modal chỉnh sửa banner.
function closeEditModal() {
    document.getElementById('editBannerModal').style.display = 'none';
}

// Gửi form cập nhật banner bằng FormData để hỗ trợ cả ảnh upload và URL ảnh.
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

// Khởi tạo các listener cho drag/drop và modal chỉnh sửa banner.
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

    // Các nút đóng modal đều dùng chung hàm reset.
    document.getElementById('editBannerClose')?.addEventListener('click', closeEditModal);
    document.getElementById('editBannerCancel')?.addEventListener('click', closeEditModal);
    document.getElementById('editBannerForm')?.addEventListener('submit', submitEditBanner);

    initDragAndDrop();
}
document.addEventListener('DOMContentLoaded', initAdminBannersPage);
