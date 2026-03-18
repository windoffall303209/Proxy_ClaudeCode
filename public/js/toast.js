/**
 * Global Toast Notification Utility
 * Used across all pages (admin + frontend)
 */
(function() {
    // Create container if not exists
    function getContainer() {
        let container = document.getElementById('globalToastContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'globalToastContainer';
            container.style.cssText = 'position:fixed;top:80px;right:20px;z-index:99999;display:flex;flex-direction:column;gap:8px;max-width:380px;width:calc(100% - 40px);pointer-events:none;';
            document.body.appendChild(container);
        }
        return container;
    }

    function createToast(message, type) {
        const container = getContainer();
        const toast = document.createElement('div');
        
        const colors = {
            success: { bg: 'linear-gradient(135deg, #10b981, #059669)', icon: '✅' },
            error:   { bg: 'linear-gradient(135deg, #ef4444, #dc2626)', icon: '❌' },
            info:    { bg: 'linear-gradient(135deg, #3b82f6, #2563eb)', icon: 'ℹ️' },
            warning: { bg: 'linear-gradient(135deg, #f59e0b, #d97706)', icon: '⚠️' }
        };
        const c = colors[type] || colors.info;

        toast.style.cssText = `
            display:flex;align-items:center;gap:12px;
            background:${c.bg};color:#fff;
            padding:14px 20px;border-radius:12px;
            box-shadow:0 8px 32px rgba(0,0,0,0.18);
            font-size:14px;font-weight:500;font-family:inherit;
            pointer-events:auto;
            animation:toastSlideIn 0.35s cubic-bezier(0.21,1.02,0.73,1);
            transition:all 0.3s ease;
        `;
        toast.innerHTML = `
            <span style="font-size:18px;flex-shrink:0;">${c.icon}</span>
            <span style="flex:1;line-height:1.4;">${message}</span>
            <button onclick="this.parentElement.style.animation='toastSlideOut 0.3s ease forwards';setTimeout(()=>this.parentElement.remove(),300)" 
                style="background:none;border:none;color:rgba(255,255,255,0.8);font-size:18px;cursor:pointer;padding:0 0 0 8px;flex-shrink:0;">×</button>
        `;
        container.appendChild(toast);

        // Auto remove
        setTimeout(() => {
            if (toast.parentElement) {
                toast.style.animation = 'toastSlideOut 0.3s ease forwards';
                setTimeout(() => toast.remove(), 300);
            }
        }, 4000);
    }

    // Inject keyframes if not present
    if (!document.getElementById('toastKeyframes')) {
        const style = document.createElement('style');
        style.id = 'toastKeyframes';
        style.textContent = `
            @keyframes toastSlideIn {
                from { transform: translateX(120%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes toastSlideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(120%); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }

    // Expose globally
    window.showGlobalToast = createToast;

    // Also expose as showToast if not already defined (fallback)
    if (typeof window.showToast === 'undefined') {
        window.showToast = createToast;
    }

    // Also expose as showNotification if not already defined
    if (typeof window.showNotification === 'undefined') {
        window.showNotification = createToast;
    }
})();
