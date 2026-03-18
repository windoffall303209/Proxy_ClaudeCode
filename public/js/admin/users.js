// Admin Users page JavaScript
// Extracted from views/admin/users.ejs

// Use global toast from toast.js
function showToast(message, type = 'success') {
    if (typeof showGlobalToast === 'function') showGlobalToast(message, type);
}

/**
 * Show confirm modal
 * @param {string} message - Confirmation message
 * @param {string} title - Modal title
 * @param {string} yesText - Confirm button text
 * @param {string} yesColor - Confirm button color
 * @returns {Promise<boolean>}
 */
function showConfirm(message, title = 'Xác nhận', yesText = 'Xác nhận', yesColor = '#f44336') {
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

/**
 * Toggle user status (lock/unlock)
 * @param {number} userId - User ID
 * @param {boolean} currentStatus - Current is_active status
 */
async function toggleUserStatus(userId, currentStatus) {
    const action = currentStatus ? 'khóa' : 'mở khóa';
    const yesColor = currentStatus ? '#f44336' : '#4caf50';
    const confirmed = await showConfirm(
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
            showToast(`Đã ${action} người dùng thành công!`, 'success');
            setTimeout(() => location.reload(), 1500);
        } else {
            const result = await response.json();
            showToast('Lỗi: ' + (result.message || 'Không thể cập nhật trạng thái'), 'error');
        }
    } catch (error) {
        showToast('Lỗi: ' + error.message, 'error');
    }
}

/**
 * View user detail in a modal
 * @param {number} userId - User ID
 */
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

        const u = data.user;
        const statusBadge = u.is_active 
            ? '<span class="admin-table__badge admin-table__badge--delivered">Hoạt động</span>'
            : '<span class="admin-table__badge admin-table__badge--cancelled">Bị khóa</span>';
        const roleBadge = u.role === 'admin'
            ? '<span class="admin-table__badge admin-table__badge--processing">Admin</span>'
            : '<span class="admin-table__badge" style="background:var(--admin-bg);color:var(--admin-text-secondary);">Khách hàng</span>';

        let html = `
            <div class="user-detail-profile">
                <div class="user-detail-avatar">
                    ${u.avatar_url 
                        ? `<img src="${u.avatar_url}" alt="${u.full_name || ''}">`
                        : `<span>${(u.full_name || u.email || 'U').charAt(0).toUpperCase()}</span>`
                    }
                </div>
                <div class="user-detail-info">
                    <h3>${u.full_name || 'Chưa đặt tên'}</h3>
                    <p>${u.email}</p>
                    <div style="display:flex; gap:8px; margin-top:8px;">${roleBadge} ${statusBadge}</div>
                </div>
            </div>

            <div class="user-detail-section">
                <h4>Thông tin cá nhân</h4>
                <div class="user-detail-row"><span>SĐT</span><span>${u.phone || 'Chưa cập nhật'}</span></div>
                <div class="user-detail-row"><span>Ngày sinh</span><span>${u.birthday ? new Date(u.birthday).toLocaleDateString('vi-VN') : 'Chưa cập nhật'}</span></div>
                <div class="user-detail-row"><span>Email xác thực</span><span>${u.email_verified ? '✅ Đã xác thực' : '❌ Chưa xác thực'}</span></div>
                <div class="user-detail-row"><span>Nhận KM</span><span>${u.marketing_consent ? '✅ Có' : '❌ Không'}</span></div>
                <div class="user-detail-row"><span>Ngày đăng ký</span><span>${new Date(u.created_at).toLocaleDateString('vi-VN')}</span></div>
            </div>
        `;

        // Addresses
        if (u.addresses && u.addresses.length > 0) {
            html += `<div class="user-detail-section"><h4>Địa chỉ (${u.addresses.length})</h4>`;
            u.addresses.forEach(a => {
                html += `<div class="user-detail-address">
                    <strong>${a.full_name}</strong> - ${a.phone}<br>
                    <small>${a.address_line || ''}${a.ward ? ', ' + a.ward : ''}${a.district ? ', ' + a.district : ''}${a.city ? ', ' + a.city : ''}</small>
                    ${a.is_default ? ' <span class="admin-table__badge admin-table__badge--processing" style="font-size:10px;">Mặc định</span>' : ''}
                </div>`;
            });
            html += '</div>';
        }

        // Recent orders
        if (u.recent_orders && u.recent_orders.length > 0) {
            html += `<div class="user-detail-section"><h4>Đơn hàng gần đây</h4>`;
            u.recent_orders.forEach(o => {
                let oStatus = '';
                switch(o.status) {
                    case 'pending': oStatus = '<span class="admin-table__badge admin-table__badge--pending">Chờ</span>'; break;
                    case 'confirmed': oStatus = '<span class="admin-table__badge admin-table__badge--processing">Xác nhận</span>'; break;
                    case 'shipping': oStatus = '<span class="admin-table__badge admin-table__badge--shipped">Giao</span>'; break;
                    case 'delivered': oStatus = '<span class="admin-table__badge admin-table__badge--delivered">Đã giao</span>'; break;
                    case 'cancelled': oStatus = '<span class="admin-table__badge admin-table__badge--cancelled">Hủy</span>'; break;
                    default: oStatus = o.status;
                }
                html += `<div class="user-detail-order">
                    <a href="/admin/orders/${o.id}" class="admin-table__link">${o.order_code}</a>
                    <span class="admin-table__price">${(o.final_amount || o.total_amount || 0).toLocaleString('vi-VN')}đ</span>
                    ${oStatus}
                    <span style="font-size:12px;color:var(--admin-text-muted);">${new Date(o.created_at).toLocaleDateString('vi-VN')}</span>
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
    if (modal) modal.style.display = 'none';
}
