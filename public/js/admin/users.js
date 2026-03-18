function showUsersToast(message, type = 'success') {
    if (typeof showGlobalToast === 'function') {
        showGlobalToast(message, type);
    }
}

function showUsersConfirm(message, title = 'Xác nhận', yesText = 'Xác nhận', yesColor = '#f44336') {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirmModal');
        document.getElementById('confirmTitle').textContent = title;
        document.getElementById('confirmMessage').textContent = message;
        document.getElementById('confirmYes').textContent = yesText;
        document.getElementById('confirmYes').style.background = yesColor;
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

function changePerPage(limit) {
    const url = new URL(window.location.href);
    url.searchParams.set('page', '1');
    url.searchParams.set('limit', limit);
    window.location.href = url.toString();
}

async function toggleUserStatus(userId, currentStatus) {
    const action = currentStatus ? 'khóa' : 'mở khóa';
    const yesColor = currentStatus ? '#f44336' : '#4caf50';
    const confirmed = await showUsersConfirm(
        `Bạn có chắc muốn ${action} người dùng này?`,
        currentStatus ? 'Xác nhận Khóa người dùng' : 'Xác nhận Mở khóa người dùng',
        currentStatus ? 'Khóa' : 'Mở khóa',
        yesColor
    );
    if (!confirmed) return;

    try {
        const response = await fetch(`/admin/users/${userId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ is_active: String(!currentStatus) })
        });
        if (response.ok) {
            showUsersToast(`Đã ${action} người dùng thành công!`, 'success');
            setTimeout(() => location.reload(), 1500);
        } else {
            const result = await response.json();
            showUsersToast(`Lỗi: ${result.message || 'Không thể cập nhật trạng thái'}`, 'error');
        }
    } catch (error) {
        showUsersToast(`Lỗi: ${error.message}`, 'error');
    }
}

async function viewUser(userId) {
    const modal = document.getElementById('userDetailModal');
    const content = document.getElementById('userDetailContent');
    if (!modal || !content) return;

    content.innerHTML = '<p style="text-align:center; color: var(--admin-text-muted); padding: 40px;">Đang tải...</p>';
    modal.style.display = 'flex';

    try {
        const response = await fetch(`/admin/users/${userId}`, { credentials: 'same-origin' });
        const data = await response.json();

        if (!data.success || !data.user) {
            content.innerHTML = '<p style="text-align:center; color: var(--admin-danger); padding: 40px;">Không tìm thấy người dùng</p>';
            return;
        }

        const user = data.user;
        const statusBadge = user.is_active
            ? '<span class="admin-table__badge admin-table__badge--delivered">Hoạt động</span>'
            : '<span class="admin-table__badge admin-table__badge--cancelled">Bị khóa</span>';
        const roleBadge = user.role === 'admin'
            ? '<span class="admin-table__badge admin-table__badge--processing">Admin</span>'
            : '<span class="admin-table__badge" style="background:var(--admin-bg);color:var(--admin-text-secondary);">Khách hàng</span>';

        let html = `
            <div class="user-detail-profile">
                <div class="user-detail-avatar">
                    ${user.avatar_url
                        ? `<img src="${user.avatar_url}" alt="${user.full_name || ''}">`
                        : `<span>${(user.full_name || user.email || 'U').charAt(0).toUpperCase()}</span>`
                    }
                </div>
                <div class="user-detail-info">
                    <h3>${user.full_name || 'Chưa đặt tên'}</h3>
                    <p>${user.email}</p>
                    <div style="display:flex; gap:8px; margin-top:8px;">${roleBadge} ${statusBadge}</div>
                </div>
            </div>

            <div class="user-detail-section">
                <h4>Thông tin cá nhân</h4>
                <div class="user-detail-row"><span>SĐT</span><span>${user.phone || 'Chưa cập nhật'}</span></div>
                <div class="user-detail-row"><span>Ngày sinh</span><span>${user.birthday ? new Date(user.birthday).toLocaleDateString('vi-VN') : 'Chưa cập nhật'}</span></div>
                <div class="user-detail-row"><span>Email xác thực</span><span>${user.email_verified ? '✅ Đã xác thực' : '❌ Chưa xác thực'}</span></div>
                <div class="user-detail-row"><span>Nhận KM</span><span>${user.marketing_consent ? '✅ Có' : '❌ Không'}</span></div>
                <div class="user-detail-row"><span>Ngày đăng ký</span><span>${new Date(user.created_at).toLocaleDateString('vi-VN')}</span></div>
            </div>
        `;

        if (user.addresses && user.addresses.length > 0) {
            html += '<div class="user-detail-section"><h4>Địa chỉ (' + user.addresses.length + ')</h4>';
            user.addresses.forEach((address) => {
                html += `<div class="user-detail-address">
                    <strong>${address.full_name}</strong> - ${address.phone}<br>
                    <small>${address.address_line || ''}${address.ward ? ', ' + address.ward : ''}${address.district ? ', ' + address.district : ''}${address.city ? ', ' + address.city : ''}</small>
                    ${address.is_default ? ' <span class="admin-table__badge admin-table__badge--processing" style="font-size:10px;">Mặc định</span>' : ''}
                </div>`;
            });
            html += '</div>';
        }

        if (user.recent_orders && user.recent_orders.length > 0) {
            html += '<div class="user-detail-section"><h4>Đơn hàng gần đây</h4>';
            user.recent_orders.forEach((order) => {
                let statusBadgeMarkup = '';
                switch (order.status) {
                    case 'pending':
                        statusBadgeMarkup = '<span class="admin-table__badge admin-table__badge--pending">Chờ</span>';
                        break;
                    case 'confirmed':
                        statusBadgeMarkup = '<span class="admin-table__badge admin-table__badge--processing">Xác nhận</span>';
                        break;
                    case 'shipping':
                        statusBadgeMarkup = '<span class="admin-table__badge admin-table__badge--shipped">Giao</span>';
                        break;
                    case 'delivered':
                        statusBadgeMarkup = '<span class="admin-table__badge admin-table__badge--delivered">Đã giao</span>';
                        break;
                    case 'cancelled':
                        statusBadgeMarkup = '<span class="admin-table__badge admin-table__badge--cancelled">Hủy</span>';
                        break;
                    default:
                        statusBadgeMarkup = order.status;
                }

                html += `<div class="user-detail-order">
                    <a href="/admin/orders/${order.id}" class="admin-table__link">${order.order_code}</a>
                    <span class="admin-table__price">${(order.final_amount || order.total_amount || 0).toLocaleString('vi-VN')}đ</span>
                    ${statusBadgeMarkup}
                    <span style="font-size:12px;color:var(--admin-text-muted);">${new Date(order.created_at).toLocaleDateString('vi-VN')}</span>
                </div>`;
            });
            html += '</div>';
        }

        content.innerHTML = html;
    } catch (error) {
        content.innerHTML = `<p style="text-align:center; color: var(--admin-danger); padding: 40px;">Lỗi: ${error.message}</p>`;
    }
}

function closeUserDetailModal() {
    const modal = document.getElementById('userDetailModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function initAdminUsersPage() {
    document.getElementById('perpageSelect')?.addEventListener('change', (event) => {
        changePerPage(event.target.value);
    });

    document.querySelectorAll('[data-user-action="view"]').forEach((button) => {
        button.addEventListener('click', () => viewUser(button.dataset.userId));
    });

    document.querySelectorAll('[data-user-action="toggle-status"]').forEach((button) => {
        button.addEventListener('click', () => {
            toggleUserStatus(button.dataset.userId, button.dataset.userActive === 'true');
        });
    });

    document.querySelectorAll('[data-user-action="close-modal"]').forEach((button) => {
        button.addEventListener('click', closeUserDetailModal);
    });

    document.getElementById('userDetailModal')?.addEventListener('click', (event) => {
        if (event.target.id === 'userDetailModal') {
            closeUserDetailModal();
        }
    });
}

document.addEventListener('DOMContentLoaded', initAdminUsersPage);
