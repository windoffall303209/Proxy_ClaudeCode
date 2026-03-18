function initAdminDashboardPage() {
    document.querySelectorAll('[data-dashboard-action="refresh"]').forEach((button) => {
        button.addEventListener('click', () => {
            window.location.reload();
        });
    });
}

document.addEventListener('DOMContentLoaded', initAdminDashboardPage);
