function notifyStorefront(message, type = 'success') {
    if (typeof showToast === 'function') {
        showToast(message, type);
        return;
    }

    window.alert(message);
}

function initWebsiteManagementNavigation(root) {
    const buttons = Array.from(root.querySelectorAll('[data-website-section-target]'));
    const panels = Array.from(root.querySelectorAll('[data-website-section]'));

    const showMenu = () => {
        root.classList.add('is-menu-view');
        root.classList.remove('is-detail-view');
        buttons.forEach((button) => button.classList.remove('is-active'));
        panels.forEach((panel) => {
            panel.hidden = true;
        });
        root.querySelector('.website-management-sidebar')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const showSection = (sectionKey) => {
        const nextKey = sectionKey || '';
        if (!nextKey) {
            showMenu();
            return;
        }

        root.classList.remove('is-menu-view');
        root.classList.add('is-detail-view');
        buttons.forEach((button) => {
            button.classList.toggle('is-active', button.dataset.websiteSectionTarget === nextKey);
        });
        panels.forEach((panel) => {
            panel.hidden = panel.dataset.websiteSection !== nextKey;
        });
    };

    buttons.forEach((button) => {
        button.addEventListener('click', () => {
            showSection(button.dataset.websiteSectionTarget);
        });
    });

    root.querySelectorAll('[data-website-back]').forEach((button) => {
        button.addEventListener('click', () => {
            showMenu();
        });
    });

    if (root.dataset.activeSection) {
        showSection(root.dataset.activeSection);
    } else {
        showMenu();
    }
}

function initWebsiteAssetUploads(root) {
    root.querySelectorAll('[data-storefront-asset]').forEach((field) => {
        const fileInput = field.querySelector('[data-storefront-asset-input]');
        const valueInput = field.querySelector('[data-storefront-asset-value]');
        const preview = field.querySelector('[data-storefront-asset-preview]');

        fileInput?.addEventListener('change', async () => {
            const file = fileInput.files?.[0];
            if (!file) return;

            const formData = new FormData();
            formData.append('asset', file);

            try {
                field.classList.add('is-uploading');
                const response = await fetch('/admin/storefront/assets', {
                    method: 'POST',
                    credentials: 'same-origin',
                    body: formData
                });
                const result = await response.json();

                if (!response.ok || !result.success || !result.url) {
                    throw new Error(result.message || 'Không thể upload ảnh.');
                }

                valueInput.value = result.url;
                if (preview?.tagName === 'IMG') {
                    preview.src = result.url;
                } else if (preview) {
                    const image = document.createElement('img');
                    image.src = result.url;
                    image.alt = valueInput.name || 'Asset';
                    image.dataset.storefrontAssetPreview = '';
                    preview.replaceWith(image);
                }

                notifyStorefront('Đã upload ảnh. Bấm Lưu nháp để lưu URL này.', 'success');
            } catch (error) {
                notifyStorefront(error.message || 'Không thể upload ảnh.', 'error');
            } finally {
                field.classList.remove('is-uploading');
                fileInput.value = '';
            }
        });
    });
}

function initWebsiteFormHelpers(root) {
    root.querySelectorAll('.website-color-input input[type="color"]').forEach((input) => {
        const code = input.closest('.website-color-input')?.querySelector('code');
        input.addEventListener('input', () => {
            if (code) code.textContent = input.value;
        });
    });

    root.querySelectorAll('.website-toggle input[type="checkbox"]').forEach((input) => {
        const label = input.closest('.website-toggle')?.querySelector('strong');
        input.addEventListener('change', () => {
            if (label) label.textContent = input.checked ? 'Đang bật' : 'Đang tắt';
        });
    });
}

function initWebsiteManagement() {
    const root = document.querySelector('[data-website-management]');
    if (!root) return;

    initWebsiteManagementNavigation(root);
    initWebsiteAssetUploads(root);
    initWebsiteFormHelpers(root);
}

document.addEventListener('DOMContentLoaded', initWebsiteManagement);
