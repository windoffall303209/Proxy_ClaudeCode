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

function setApiKeyResult(target, valid, text) {
    if (!target) return;
    target.textContent = text || (valid ? 'Valid' : 'Invalid');
    target.dataset.state = valid ? 'valid' : 'invalid';
}

async function postApiKeyForm(url, body) {
    const response = await fetch(url, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json'
        },
        body: new URLSearchParams(body)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.success === false) {
        throw new Error(result.message || 'Request failed');
    }
    return result;
}

function getProviderLabel(select, value) {
    const option = Array.from(select?.options || []).find((item) => item.value === value);
    return option ? option.textContent.trim() : value;
}

function prepareApiKeyCreateForm(page) {
    const form = page.querySelector('.api-key-form--create');
    if (!form || form.dataset.apiKeyPrepared === 'true') return;
    form.dataset.apiKeyPrepared = 'true';
    form.dataset.apiKeyForm = '';

    ['#key_name', '#notes'].forEach((selector) => {
        const input = form.querySelector(selector);
        const field = input?.closest('.admin-form__field');
        if (input) input.disabled = true;
        if (field) field.hidden = true;
    });

    page.querySelectorAll('.api-key-toolbar p, .api-key-empty span, .api-key-page .storefront-settings__description').forEach((element) => {
        element.remove();
    });

    const listToolbar = page.querySelector('.api-key-toolbar--list');
    if (listToolbar) {
        const title = listToolbar.querySelector('.admin-section__title');
        listToolbar.replaceWith(title || document.createElement('span'));
        if (title) title.classList.add('api-key-list-title');
    }

    const toolbar = page.querySelector('.api-key-toolbar:not(.api-key-toolbar--list)');
    const details = document.createElement('details');
    details.className = 'api-key-create';
    const summary = document.createElement('summary');
    summary.textContent = 'Thêm API key';
    details.appendChild(summary);
    toolbar?.replaceWith(details);
    details.appendChild(form);

    const actions = form.querySelector('.api-key-form__actions');
    const result = document.createElement('span');
    result.className = 'api-key-test-result';
    result.dataset.apiKeyTestResult = '';
    result.setAttribute('aria-live', 'polite');
    const testButton = document.createElement('button');
    testButton.type = 'button';
    testButton.className = 'admin-btn admin-btn--ghost';
    testButton.textContent = 'Test connect';
    testButton.dataset.apiKeyTest = '';
    actions?.prepend(testButton);
    actions?.prepend(result);
}

function prepareApiKeyTable(page) {
    const table = page.querySelector('.api-key-table');
    if (!table || table.dataset.apiKeyPrepared === 'true') return;
    table.dataset.apiKeyPrepared = 'true';

    table.querySelectorAll('thead th:nth-child(2), thead th:nth-child(5)').forEach((cell) => {
        cell.hidden = true;
    });
    const keyHeader = table.querySelector('thead th:nth-child(3)');
    if (keyHeader) keyHeader.textContent = 'API key';
    const newKeyHeader = table.querySelector('thead th:nth-child(6)');
    if (newKeyHeader) newKeyHeader.textContent = 'Key mới';

    if (newKeyHeader) newKeyHeader.textContent = 'Test connect';

    table.querySelectorAll('tbody tr').forEach((row) => {
        const providerSelect = row.querySelector('select[name="provider"]');
        const keyNameInput = row.querySelector('input[name="key_name"]');
        const notesInput = row.querySelector('input[name="notes"]');
        const keyValueInput = row.querySelector('input[name="key_value"]');
        const statusInput = row.querySelector('.api-key-switch input[type="checkbox"]');
        const updateButton = row.querySelector('.api-key-table__actions .admin-btn--primary');
        const actions = row.querySelector('.api-key-table__actions');
        const updateFormId = updateButton?.getAttribute('form') || providerSelect?.getAttribute('form') || '';
        const keyId = updateFormId.replace('api-key-update-', '');

        if (!providerSelect || !actions || !keyId) return;

        const providerCell = providerSelect.closest('td');
        const keyNameCell = keyNameInput?.closest('td');
        const notesCell = notesInput?.closest('td');
        const keyValueCell = keyValueInput?.closest('td');

        const providerLabel = document.createElement('strong');
        providerLabel.className = 'api-key-provider-label';
        providerLabel.textContent = getProviderLabel(providerSelect, providerSelect.value);
        providerCell?.prepend(providerLabel);

        providerSelect.hidden = true;
        if (keyNameInput) keyNameInput.disabled = true;
        if (notesInput) notesInput.disabled = true;
        if (keyNameCell) keyNameCell.hidden = true;
        if (notesCell) notesCell.hidden = true;
        if (keyValueCell) keyValueCell.hidden = true;

        const result = document.createElement('span');
        result.className = 'api-key-test-result';
        result.dataset.apiKeyTestResult = '';
        result.setAttribute('aria-live', 'polite');
        const testButton = document.createElement('button');
        testButton.type = 'button';
        testButton.className = 'admin-btn admin-btn--ghost api-key-action-btn';
        testButton.textContent = 'Test connect';
        testButton.dataset.apiKeyTestExisting = '';
        testButton.dataset.apiKeyId = keyId;
        actions.prepend(testButton);
        actions.prepend(result);
        if (keyValueCell) {
            keyValueCell.hidden = false;
            keyValueCell.dataset.label = 'Test connect';
            if (keyValueInput) keyValueInput.hidden = true;
            const testCell = document.createElement('div');
            testCell.className = 'api-key-test-cell';
            testCell.append(result, testButton);
            keyValueCell.append(testCell);
        }

        if (updateButton) {
            updateButton.type = 'button';
            updateButton.removeAttribute('form');
            updateButton.textContent = 'Sửa';
            updateButton.addEventListener('click', () => {
                if (row.classList.contains('is-editing')) {
                    document.getElementById(updateFormId)?.submit();
                    return;
                }

                row.classList.add('is-editing');
                providerSelect.hidden = false;
                if (keyValueCell) keyValueCell.hidden = false;
                if (keyValueCell) keyValueCell.dataset.label = 'Key moi';
                if (keyValueInput) keyValueInput.hidden = false;
                updateButton.textContent = 'Lưu';
                keyValueInput?.focus();
            });
        }

        providerSelect.addEventListener('change', () => {
            providerLabel.textContent = getProviderLabel(providerSelect, providerSelect.value);
        });

        statusInput?.addEventListener('change', async () => {
            const label = statusInput.closest('.api-key-switch')?.querySelector('strong');
            const nextChecked = statusInput.checked;
            statusInput.disabled = true;
            try {
                await postApiKeyForm(`/admin/api-keys/${keyId}/status`, {
                    is_active: nextChecked ? 'true' : 'false'
                });
                if (label) label.textContent = nextChecked ? 'Đang bật' : 'Đang tắt';
            } catch (error) {
                statusInput.checked = !nextChecked;
                notifyStorefront(error.message || 'Không thể cập nhật trạng thái.', 'error');
            } finally {
                statusInput.disabled = false;
            }
        });
    });
}

function initApiKeyTests(page) {
    page.addEventListener('click', async (event) => {
        const button = event.target.closest('[data-api-key-test], [data-api-key-test-existing]');
        if (!button) return;

        const form = button.closest('form') || document.getElementById(`api-key-update-${button.dataset.apiKeyId || ''}`);
        const resultTarget = button.parentElement?.querySelector('[data-api-key-test-result]');
        const provider = form?.querySelector('select[name="provider"]')?.value || '';
        const keyValue = form?.querySelector('input[name="key_value"]')?.value || '';
        const id = button.dataset.apiKeyId || '';

        button.disabled = true;
        if (resultTarget) {
            resultTarget.textContent = 'Testing...';
            resultTarget.dataset.state = 'pending';
        }

        try {
            const result = await postApiKeyForm('/admin/api-keys/test', {
                provider,
                key_value: keyValue,
                id
            });
            setApiKeyResult(resultTarget, Boolean(result.valid), result.message);
        } catch (error) {
            setApiKeyResult(resultTarget, false, 'InValid');
        } finally {
            button.disabled = false;
        }
    });
}

function initApiKeyManagement(root) {
    const page = root.querySelector('.api-key-page');
    if (!page) return;

    prepareApiKeyCreateForm(page);
    prepareApiKeyTable(page);
    initApiKeyTests(page);
}

function initWebsiteManagement() {
    const root = document.querySelector('[data-website-management]');
    if (!root) return;

    initWebsiteManagementNavigation(root);
    initWebsiteAssetUploads(root);
    initWebsiteFormHelpers(root);
    initApiKeyManagement(root);
}

document.addEventListener('DOMContentLoaded', initWebsiteManagement);
