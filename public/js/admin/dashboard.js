function getDashboardBootstrap() {
    const element = document.getElementById('adminDashboardBootstrap');
    if (!element) {
        return null;
    }

    try {
        return JSON.parse(element.textContent);
    } catch (error) {
        console.error('Không đọc được dữ liệu dashboard:', error);
        return null;
    }
}

function initRecentLimitSelector() {
    const select = document.querySelector('[data-dashboard-recent-limit]');
    if (!select) {
        return;
    }

    return select;
}

function resizeCanvas(canvas) {
    const pixelRatio = window.devicePixelRatio || 1;
    const width = Math.max(160, Math.floor(canvas.clientWidth));
    const height = Math.max(180, Math.floor(canvas.clientHeight));

    canvas.width = width * pixelRatio;
    canvas.height = height * pixelRatio;

    const ctx = canvas.getContext('2d');
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    return { ctx, width, height };
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
    const safeRadius = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + safeRadius, y);
    ctx.lineTo(x + width - safeRadius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
    ctx.lineTo(x + width, y + height - safeRadius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
    ctx.lineTo(x + safeRadius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
    ctx.lineTo(x, y + safeRadius);
    ctx.quadraticCurveTo(x, y, x + safeRadius, y);
    ctx.closePath();
}

function drawEmptyState(ctx, width, height, message) {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#8c7f6d';
    ctx.font = '600 14px Manrope, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(message, width / 2, height / 2);
}

function drawOrderStatusChart(data) {
    const canvas = document.getElementById('orderStatusChart');
    if (!canvas) {
        return;
    }

    const { ctx, width, height } = resizeCanvas(canvas);
    const chartData = [
        { label: 'Chờ xử lý', value: Number(data?.pending || 0), color: '#d98b1b' },
        { label: 'Đang xử lý', value: Number(data?.processing || 0), color: '#2f6fd3' },
        { label: 'Đã giao', value: Number(data?.delivered || 0), color: '#2e8b57' },
        { label: 'Đã hủy', value: Number(data?.cancelled || 0), color: '#c54f35' }
    ];

    const total = chartData.reduce((sum, item) => sum + item.value, 0);
    if (total === 0) {
        drawEmptyState(ctx, width, height, 'Chưa có dữ liệu đơn hàng');
        return;
    }

    const padding = { top: 20, right: 12, bottom: 52, left: 42 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    const maxValue = Math.max(...chartData.map((item) => item.value), 1);
    const steps = 4;

    ctx.clearRect(0, 0, width, height);

    for (let step = 0; step <= steps; step += 1) {
        const value = Math.round((maxValue / steps) * step);
        const y = padding.top + chartHeight - (chartHeight / steps) * step;

        ctx.strokeStyle = 'rgba(204, 191, 167, 0.28)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(width - padding.right, y);
        ctx.stroke();

        ctx.fillStyle = '#8c7f6d';
        ctx.font = '12px Manrope, sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(value), padding.left - 8, y);
    }

    const slotWidth = chartWidth / chartData.length;
    const barWidth = Math.min(56, slotWidth * 0.52);

    chartData.forEach((item, index) => {
        const barHeight = Math.max(item.value === 0 ? 0 : 8, (item.value / maxValue) * (chartHeight - 8));
        const x = padding.left + slotWidth * index + (slotWidth - barWidth) / 2;
        const y = padding.top + chartHeight - barHeight;

        ctx.fillStyle = item.color;
        drawRoundedRect(ctx, x, y, barWidth, barHeight, 14);
        ctx.fill();

        ctx.fillStyle = '#2a241a';
        ctx.font = '700 13px Manrope, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(String(item.value), x + barWidth / 2, y - 8);

        ctx.fillStyle = '#6f6455';
        ctx.font = '600 12px Manrope, sans-serif';
        ctx.textBaseline = 'top';
        ctx.fillText(item.label, x + barWidth / 2, height - padding.bottom + 16);
    });
}

function drawProductStatusChart(data) {
    const canvas = document.getElementById('productStatusChart');
    if (!canvas) {
        return;
    }

    const { ctx, width, height } = resizeCanvas(canvas);
    const segments = [
        { label: 'Đang bán', value: Number(data?.live || 0), color: '#e2b84b' },
        { label: 'Hết hàng', value: Number(data?.out_of_stock || 0), color: '#d98b1b' },
        { label: 'Đang ẩn', value: Number(data?.hidden || 0), color: '#b0a18d' }
    ];

    const total = segments.reduce((sum, item) => sum + item.value, 0);
    if (total === 0) {
        drawEmptyState(ctx, width, height, 'Chưa có dữ liệu sản phẩm');
        return;
    }

    ctx.clearRect(0, 0, width, height);

    const centerX = width / 2;
    const centerY = height / 2 - 6;
    const radius = Math.max(56, Math.min(width, height) / 2 - 30);
    const lineWidth = Math.min(32, radius * 0.34);
    const gapAngle = 0.035;
    let startAngle = -Math.PI / 2;

    segments.forEach((segment) => {
        if (segment.value <= 0) {
            return;
        }

        const ratio = segment.value / total;
        const segmentAngle = ratio * Math.PI * 2;
        const endAngle = startAngle + Math.max(segmentAngle - gapAngle, 0);

        ctx.strokeStyle = segment.color;
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        ctx.stroke();

        startAngle += segmentAngle;
    });

    ctx.fillStyle = '#221b0c';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '800 28px Manrope, sans-serif';
    ctx.fillText(String(total), centerX, centerY - 6);

    ctx.fillStyle = '#8c7f6d';
    ctx.font = '600 13px Manrope, sans-serif';
    ctx.fillText('sản phẩm', centerX, centerY + 22);
}

function createResizeHandler(callback) {
    let frameId = null;
    return () => {
        if (frameId) {
            window.cancelAnimationFrame(frameId);
        }

        frameId = window.requestAnimationFrame(() => {
            callback();
            frameId = null;
        });
    };
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatOrderStatus(status) {
    switch (status) {
        case 'pending':
            return { text: 'Chờ xử lý', className: 'admin-table__badge--pending' };
        case 'confirmed':
            return { text: 'Đã xác nhận', className: 'admin-table__badge--processing' };
        case 'shipping':
            return { text: 'Đang giao', className: 'admin-table__badge--shipped' };
        case 'delivered':
            return { text: 'Đã giao', className: 'admin-table__badge--delivered' };
        case 'cancelled':
            return { text: 'Đã hủy', className: 'admin-table__badge--cancelled' };
        default:
            return { text: status || 'Không xác định', className: '' };
    }
}

function renderRecentOrders(orders, limit) {
    const tbody = document.getElementById('dashboardRecentOrdersBody');
    const limitLabel = document.querySelector('[data-dashboard-limit-label]');

    if (!tbody) {
        return;
    }

    const visibleOrders = (orders || []).slice(0, limit);

    tbody.innerHTML = visibleOrders.map((order) => {
        const status = formatOrderStatus(order.status);
        const customerName = order.user_name || order.recipient_name || 'N/A';
        const createdAt = order.created_at ? new Date(order.created_at) : null;
        const dateText = createdAt && !Number.isNaN(createdAt.getTime())
            ? createdAt.toLocaleDateString('vi-VN')
            : 'N/A';

        return `
            <tr>
                <td>
                    <a href="/admin/orders/${escapeHtml(order.id)}" class="admin-table__link">
                        <strong>${escapeHtml(order.order_code)}</strong>
                    </a>
                </td>
                <td>
                    <div class="order-customer">
                        <span class="order-customer__name">${escapeHtml(customerName)}</span>
                    </div>
                </td>
                <td class="text-right">
                    <span class="admin-table__price">${Number(order.final_amount || 0).toLocaleString('vi-VN')}đ</span>
                </td>
                <td class="text-center">
                    <span class="admin-table__badge ${status.className}">${escapeHtml(status.text)}</span>
                </td>
                <td class="text-center">
                    <span class="order-date">${escapeHtml(dateText)}</span>
                </td>
                <td class="text-center">
                    <a href="/admin/orders/${escapeHtml(order.id)}" class="admin-btn admin-btn--edit" title="Xem chi tiết">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                    </a>
                </td>
            </tr>
        `;
    }).join('');

    if (limitLabel) {
        limitLabel.textContent = String(visibleOrders.length);
    }
}

function initAdminDashboardPage() {
    document.querySelectorAll('[data-dashboard-action="refresh"]').forEach((button) => {
        button.addEventListener('click', () => {
            window.location.reload();
        });
    });

    initRecentLimitSelector();

    const bootstrap = getDashboardBootstrap();
    if (!bootstrap) {
        return;
    }

    const recentLimitSelect = initRecentLimitSelector();

    const renderCharts = () => {
        drawOrderStatusChart(bootstrap.orderStatus || {});
        drawProductStatusChart(bootstrap.productStatus || {});
    };

    renderCharts();
    window.addEventListener('resize', createResizeHandler(renderCharts));

    renderRecentOrders(bootstrap.recentOrders || [], Number(bootstrap.recentLimit || 10));

    recentLimitSelect?.addEventListener('change', () => {
        renderRecentOrders(bootstrap.recentOrders || [], Number(recentLimitSelect.value || 10));
    });
}

document.addEventListener('DOMContentLoaded', initAdminDashboardPage);
