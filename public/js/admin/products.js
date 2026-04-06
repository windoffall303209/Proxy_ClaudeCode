// Admin Products page JavaScript

function showToast(message, type = 'success') {
    if (typeof showGlobalToast === 'function') showGlobalToast(message, type);
}

const DELETE_ALL_CONFIRMATION_TEXT = 'Xóa tất cả';

function showConfirm(message, title = 'Xác nhận', yesText = 'Xác nhận', yesColor = '#f44336', options = {}) {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirmModal');
        const titleElement = document.getElementById('confirmTitle');
        const messageElement = document.getElementById('confirmMessage');
        const confirmButton = document.getElementById('confirmYes');
        const cancelButton = document.getElementById('confirmNo');
        const typingGroup = document.getElementById('confirmTypingGroup');
        const typingLabel = document.getElementById('confirmTypingLabel');
        const typingInput = document.getElementById('confirmTypingInput');
        const typingHint = document.getElementById('confirmTypingHint');
        const requiredText = options.requireText?.trim() || '';

        const closeModal = (confirmed) => {
            modal.style.display = 'none';
            confirmButton.onclick = null;
            cancelButton.onclick = null;
            modal.onclick = null;
            document.removeEventListener('keydown', handleEscape);

            if (typingInput) {
                typingInput.oninput = null;
                typingInput.value = '';
            }

            if (typingGroup) {
                typingGroup.hidden = true;
            }

            if (typingHint) {
                typingHint.textContent = '';
            }

            resolve(confirmed);
        };

        const handleEscape = (event) => {
            if (event.key === 'Escape') {
                closeModal(false);
            }
        };

        const updateTypingState = () => {
            if (!requiredText || !typingInput || !typingHint) {
                confirmButton.disabled = false;
                return;
            }

            const isMatched = typingInput.value.trim() === requiredText;
            confirmButton.disabled = !isMatched;
            typingHint.textContent = isMatched
                ? 'Chuỗi xác nhận hợp lệ.'
                : `Nhập chính xác "${requiredText}" để tiếp tục.`;
        };

        titleElement.textContent = title;
        messageElement.textContent = message;
        confirmButton.textContent = yesText;
        cancelButton.textContent = options.cancelText || 'Hủy';
        confirmButton.style.background = yesColor;
        confirmButton.disabled = false;

        if (typingGroup && typingLabel && typingInput && typingHint) {
            if (requiredText) {
                typingGroup.hidden = false;
                typingLabel.textContent = `Nhập "${requiredText}" để xác nhận`;
                typingInput.placeholder = requiredText;
                typingInput.value = '';
                typingInput.oninput = updateTypingState;
                updateTypingState();
            } else {
                typingGroup.hidden = true;
                typingHint.textContent = '';
            }
        }

        modal.style.display = 'flex';

        confirmButton.onclick = () => {
            if (requiredText && typingInput?.value.trim() !== requiredText) {
                showToast(`Hãy nhập chính xác "${requiredText}" để xác nhận.`, 'warning');
                typingInput?.focus();
                return;
            }

            closeModal(true);
        };
        cancelButton.onclick = () => {
            closeModal(false);
        };
        modal.onclick = (event) => {
            if (event.target === modal) {
                closeModal(false);
            }
        };

        document.addEventListener('keydown', handleEscape);
        window.setTimeout(() => {
            if (requiredText && typingInput) {
                typingInput.focus();
            } else {
                confirmButton.focus();
            }
        }, 0);
    });
}

function changePerPage(limit) {
    const url = new URL(window.location.href);
    url.searchParams.set('page', '1');
    url.searchParams.set('limit', limit);
    window.location.href = url.toString();
}

function toggleProductSection(titleElement) {
    const section = titleElement.closest('.admin-section--collapsible');
    section?.classList.toggle('is-open');
}

const variantMediaState = {
    create: { images: [], uploadCounter: 0, productId: null, mainUploads: [] },
    edit: { images: [], uploadCounter: 0, productId: null }
};

function getModeState(mode) {
    return variantMediaState[mode];
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function revokePreviewUrl(previewUrl) {
    if (typeof previewUrl === 'string' && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
    }
}

function getFileSignature(file) {
    return `${file.name}::${file.size}::${file.lastModified}`;
}

function getCreateImagesPreview() {
    return document.getElementById('createImagesPreview');
}

function createObjectPreviewUrl(file) {
    if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
        return URL.createObjectURL(file);
    }

    return null;
}

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error || new Error('Cannot read file'));
        reader.readAsDataURL(file);
    });
}

async function getPreviewUrl(file) {
    return readFileAsDataUrl(file);
}

function buildExistingImageOption(image) {
    return {
        value: `existing:${image.id}`,
        label: `Ảnh #${image.id}${image.is_primary ? ' (chính)' : ''}`,
        previewUrl: image.image_url,
        imageId: image.id,
        kind: 'existing',
        fileName: `Ảnh #${image.id}`
    };
}

function buildMainImageOption(upload, index) {
    const file = upload.file;
    return {
        value: `main:${index}`,
        label: `Ảnh tải lên: ${file.name}`,
        previewUrl: upload.previewUrl,
        kind: 'main',
        fileName: file.name
    };
}

function buildUploadedImageOption(token, file, previewUrl) {
    return {
        value: `upload:${token}`,
        label: `Ảnh biến thể: ${file.name}`,
        previewUrl,
        kind: 'upload',
        token,
        fileName: file.name
    };
}

function upsertModeImage(mode, imageOption) {
    const state = getModeState(mode);
    const existingIndex = state.images.findIndex(image => image.value === imageOption.value);
    if (existingIndex >= 0) {
        if (state.images[existingIndex].kind === 'upload') {
            revokePreviewUrl(state.images[existingIndex].previewUrl);
        }
        state.images[existingIndex] = imageOption;
    } else {
        state.images.push(imageOption);
    }
}

function removeModeImage(mode, value) {
    const state = getModeState(mode);
    const imageToRemove = state.images.find(image => image.value === value);
    if (imageToRemove?.kind === 'upload') {
        revokePreviewUrl(imageToRemove.previewUrl);
    }
    state.images = state.images.filter(image => image.value !== value);
}

function resetModeImages(mode, images) {
    const state = getModeState(mode);
    state.images
        .filter(image => image.kind === 'upload')
        .forEach(image => revokePreviewUrl(image.previewUrl));
    state.images = images.slice();
}

function getCreateForm() {
    return document.getElementById('createProductForm');
}

function getCreateImagesInput() {
    return document.getElementById('createImagesInput');
}

function syncCreateImagesInputFromState() {
    const input = getCreateImagesInput();
    if (!input) return;

    try {
        const dataTransfer = new DataTransfer();
        getModeState('create').mainUploads.forEach(upload => dataTransfer.items.add(upload.file));
        input.files = dataTransfer.files;
    } catch (error) {
        console.warn('Cannot sync selected images back to file input:', error);
    }
}

function renderCreateImagesPreview() {
    const preview = getCreateImagesPreview();
    if (!preview) return;

    const uploads = getModeState('create').mainUploads;
    if (uploads.length === 0) {
        preview.setAttribute('hidden', 'hidden');
        preview.style.display = 'none';
        preview.innerHTML = '';
        return;
    }

    preview.removeAttribute('hidden');
    preview.style.display = 'flex';
    preview.style.flexWrap = 'wrap';
    preview.style.gap = '12px';
    preview.style.marginTop = '12px';
    preview.innerHTML = uploads.map((upload, index) => `
        <div
            class="product-upload-preview__item"
            style="position: relative; width: 96px; height: 96px; border-radius: 14px; overflow: hidden; border: 1px solid rgba(204, 191, 167, 0.88); background: #fff; box-shadow: 0 8px 20px rgba(24, 21, 15, 0.08); flex: 0 0 auto;"
        >
            <button
                type="button"
                class="product-upload-preview__remove"
                data-file-key="${encodeURIComponent(upload.key)}"
                title="Xóa ảnh này"
                aria-label="Xóa ảnh này"
                style="position: absolute; top: 6px; right: 6px; width: 24px; height: 24px; border: none; border-radius: 999px; background: rgba(255, 255, 255, 0.92); color: #dc2626; font-size: 14px; font-weight: 700; cursor: pointer; z-index: 1;"
            >
                x
            </button>
            ${index === 0 ? '<span class="product-upload-preview__badge" style="position: absolute; left: 6px; top: 6px; padding: 2px 6px; border-radius: 999px; background: rgba(102, 126, 234, 0.95); color: #fff; font-size: 9px; font-weight: 700; z-index: 1;">Chính</span>' : ''}
            <div class="product-upload-preview__thumb" style="width: 100%; height: 100%;">
                <img src="${upload.previewUrl}" alt="${escapeHtml(upload.file.name)}" style="width: 100%; height: 100%; object-fit: cover; display: block;">
            </div>
        </div>
    `).join('');

    preview.querySelectorAll('.product-upload-preview__remove').forEach(button => {
        button.addEventListener('click', () => {
            removeCreateMainUpload(decodeURIComponent(button.dataset.fileKey));
        });
    });
}

async function addCreateMainUploads(files) {
    const state = getModeState('create');
    const existingKeys = new Set(state.mainUploads.map(upload => upload.key));
    const filesToAdd = files
        .map((file) => ({ file, key: getFileSignature(file) }))
        .filter(({ key }) => !existingKeys.has(key));

    const uploads = await Promise.all(
        filesToAdd.map(async ({ file, key }) => ({
            key,
            file,
            previewUrl: await getPreviewUrl(file)
        }))
    );

    state.mainUploads.push(...uploads);
}

function removeCreateMainUpload(fileKey) {
    const state = getModeState('create');
    const uploadIndex = state.mainUploads.findIndex(upload => upload.key === fileKey);
    if (uploadIndex < 0) return;

    revokePreviewUrl(state.mainUploads[uploadIndex].previewUrl);
    state.mainUploads.splice(uploadIndex, 1);
    syncCreateMainImageOptions();
    syncCreateImagesInputFromState();
    collectVariants('create');
}

async function handleCreateImagesSelection() {
    const input = getCreateImagesInput();
    const selectedFiles = Array.from(input?.files || []);

    if (selectedFiles.length === 0) {
        if (getModeState('create').mainUploads.length === 0) {
            syncCreateMainImageOptions();
        }
        return;
    }

    await addCreateMainUploads(selectedFiles);
    syncCreateMainImageOptions();
    syncCreateImagesInputFromState();
}

function syncCreateMainImageOptions() {
    const state = getModeState('create');
    state.images = state.images.filter(image => image.kind !== 'main');

    state.mainUploads.forEach((upload, index) => {
        state.images.push(buildMainImageOption(upload, index));
    });

    renderCreateImagesPreview();
    refreshVariantImageSelects('create');
}

function getImageOptionsHtml(mode, selectedValue = '') {
    const state = getModeState(mode);
    const baseOption = '<option value="">-- Ảnh biến thể --</option>';
    const options = state.images.map(image => {
        const selected = image.value === selectedValue ? 'selected' : '';
        return `<option value="${image.value}" ${selected}>${image.label}</option>`;
    });

    return [baseOption, ...options].join('');
}

function updateVariantImagePreview(row, mode) {
    const preview = row.querySelector('.variant-image-preview');
    if (!preview) return;

    const selectedValue = row.querySelector('.variant-image-select')?.value;
    const state = getModeState(mode);
    const selectedImage = state.images.find(image => image.value === selectedValue);

    if (!selectedImage) {
        preview.innerHTML = '';
        preview.classList.remove('is-visible');
        return;
    }

    const thumb = document.createElement('div');
    thumb.className = 'variant-image-preview__thumb';

    const img = document.createElement('img');
    img.src = selectedImage.previewUrl;
    img.alt = selectedImage.fileName || selectedImage.label || 'Variant image preview';
    thumb.appendChild(img);

    preview.replaceChildren(thumb);
    preview.classList.add('is-visible');
}

function refreshVariantImageSelects(mode) {
    const state = getModeState(mode);
    const container = document.getElementById(`${mode}VariantsList`);
    if (!container) return;

    container.querySelectorAll('.variant-row').forEach(row => {
        const select = row.querySelector('.variant-image-select');
        if (!select) return;

        const currentValue = select.value;
        select.innerHTML = getImageOptionsHtml(mode, currentValue);
        if (currentValue && !state.images.some(image => image.value === currentValue)) {
            select.value = '';
        }
        updateVariantImagePreview(row, mode);
    });
}

function getNextUploadToken(mode) {
    const state = getModeState(mode);
    state.uploadCounter += 1;
    return `${mode}-${Date.now()}-${state.uploadCounter}`;
}

function syncVariantUploadInputNames(mode) {
    const container = document.getElementById(`${mode}VariantsList`);
    if (!container) return;

    const activeTokens = new Set();
    container.querySelectorAll('.variant-image-select').forEach(select => {
        if (select.value.startsWith('upload:')) {
            activeTokens.add(select.value.replace('upload:', ''));
        }
    });

    container.querySelectorAll('.variant-image-file').forEach(fileInput => {
        const token = fileInput.dataset.uploadToken;
        if (!token) return;

        if (activeTokens.has(token)) {
            fileInput.name = `variant_image__${token}`;
        } else {
            fileInput.removeAttribute('name');
        }
    });
}

async function handleVariantFileSelection(fileInput, mode) {
    const file = fileInput.files && fileInput.files[0];
    const row = fileInput.closest('.variant-row');
    if (!row) return;

    if (!file) {
        const oldToken = fileInput.dataset.uploadToken;
        if (oldToken) {
            removeModeImage(mode, `upload:${oldToken}`);
            fileInput.removeAttribute('name');
            delete fileInput.dataset.uploadToken;
            refreshVariantImageSelects(mode);
            collectVariants(mode);
        }
        return;
    }

    let token = fileInput.dataset.uploadToken;
    if (!token) {
        token = getNextUploadToken(mode);
        fileInput.dataset.uploadToken = token;
    }

    const previewUrl = await getPreviewUrl(file);
    upsertModeImage(mode, buildUploadedImageOption(token, file, previewUrl));
    refreshVariantImageSelects(mode);

    const select = row.querySelector('.variant-image-select');
    if (select) {
        select.value = `upload:${token}`;
    }

    updateVariantImagePreview(row, mode);
    collectVariants(mode);
}

function removeVariantRow(button, mode) {
    const row = button.closest('.variant-row');
    if (!row) return;

    const fileInput = row.querySelector('.variant-image-file');
    if (fileInput?.dataset.uploadToken) {
        removeModeImage(mode, `upload:${fileInput.dataset.uploadToken}`);
    }

    row.remove();
    refreshVariantImageSelects(mode);
    collectVariants(mode);
}

async function openEditModal(id, name, categoryId, price, stock, description) {
    const state = getModeState('edit');
    state.productId = id;
    state.images = [];

    document.getElementById('editProductId').value = id;
    document.getElementById('editName').value = name;
    document.getElementById('editCategoryId').value = categoryId || '';
    document.getElementById('editPrice').value = price;
    document.getElementById('editStock').value = stock;
    document.getElementById('editDescription').value = description || '';
    document.getElementById('editVariantsJson').value = '[]';
    document.getElementById('editModal').style.display = 'flex';

    const variantsList = document.getElementById('editVariantsList');
    variantsList.innerHTML = '';

    try {
        const [imagesResponse, variantsResponse] = await Promise.all([
            fetch(`/admin/products/${id}/images`, { credentials: 'same-origin' }),
            fetch(`/admin/products/${id}/variants`, { credentials: 'same-origin' })
        ]);

        const imagesData = await imagesResponse.json();
        const variantsData = await variantsResponse.json();

        resetModeImages('edit', (imagesData.images || []).map(buildExistingImageOption));

        if (variantsData.success && variantsData.variants.length > 0) {
            variantsData.variants.forEach(variant => addVariantRow('edit', variant));
        }
    } catch (error) {
        console.error('Load edit modal data error:', error);
    }
}

function closeEditModal() {
    document.getElementById('editModal').style.display = 'none';
}

async function deleteProduct(productId) {
    const confirmed = await showConfirm(
        'Bạn có chắc muốn xóa sản phẩm này?',
        'Xóa sản phẩm',
        'Xóa',
        '#f44336'
    );
    if (!confirmed) return;

    try {
        const response = await fetch(`/admin/products/${productId}`, {
            method: 'DELETE',
            credentials: 'same-origin'
        });
        if (response.ok) {
            showToast('Xóa sản phẩm thành công.', 'success');
            setTimeout(() => location.reload(), 1500);
        } else {
            const result = await response.json();
            showToast(`Lỗi xóa sản phẩm: ${result.message || 'Không rõ nguyên nhân'}`, 'error');
        }
    } catch (error) {
        showToast(`Lỗi: ${error.message}`, 'error');
    }
}

async function deleteAllProducts(totalProductCount = 0) {
    if (Number(totalProductCount) <= 0) {
        showToast('Không có sản phẩm nào trong database để xóa.', 'warning');
        return;
    }

    const confirmed = await showConfirm(
        `Bạn sắp xóa vĩnh viễn ${totalProductCount} sản phẩm trong database. Cả sản phẩm đang hiển thị lẫn sản phẩm đang ẩn đều sẽ bị xóa. Ảnh, biến thể, review, wishlist và cart items liên quan sẽ bị xóa theo. Sản phẩm đã xuất hiện trong lịch sử đơn hàng sẽ không thể xóa.`,
        'Xóa vĩnh viễn tất cả sản phẩm',
        'Xóa vĩnh viễn',
        '#dc2626',
        {
            requireText: DELETE_ALL_CONFIRMATION_TEXT
        }
    );

    if (!confirmed) return;

    try {
        const response = await fetch('/admin/products/delete-all', {
            method: 'POST',
            credentials: 'same-origin'
        });
        const result = await response.json();

        if (response.ok) {
            showToast(
                result.message || 'Đã xóa vĩnh viễn sản phẩm.',
                result.blockedCount > 0 ? 'warning' : 'success'
            );
            setTimeout(() => location.reload(), 1500);
        } else {
            showToast(result.message || 'Không thể xóa toàn bộ sản phẩm.', 'error');
        }
    } catch (error) {
        showToast(`Lỗi: ${error.message}`, 'error');
    }
}

async function openImageModal(productId, productName) {
    document.getElementById('imageModalProductId').value = productId;
    document.getElementById('imageModalProductName').textContent = productName;
    document.getElementById('imageModal').style.display = 'flex';
    await loadProductImages(productId);
}

function closeImageModal() {
    document.getElementById('imageModal').style.display = 'none';
}

async function loadProductImages(productId) {
    const grid = document.getElementById('imagesGrid');
    grid.innerHTML = '<p style="color: #999;">Đang tải...</p>';

    try {
        const response = await fetch(`/admin/products/${productId}/images`, { credentials: 'same-origin' });
        const data = await response.json();

        if (data.images && data.images.length > 0) {
            grid.innerHTML = data.images.map(img => `
                <div style="position: relative; border: 2px solid ${img.is_primary ? '#667eea' : '#eee'}; border-radius: 8px; overflow: hidden;">
                    <img src="${img.image_url}" alt="" style="width: 100%; height: 120px; object-fit: cover;">
                    ${img.is_primary ? '<span style="position: absolute; top: 5px; left: 5px; background: #667eea; color: white; padding: 2px 6px; font-size: 10px; border-radius: 4px;">Chính</span>' : ''}
                    <div style="position: absolute; bottom: 5px; right: 5px; display: flex; gap: 5px;">
                        ${!img.is_primary ? `<button data-image-action="set-primary" data-image-id="${img.id}" style="padding: 3px 8px; font-size: 10px; background: #4caf50; color: white; border: none; border-radius: 4px; cursor: pointer;">★</button>` : ''}
                        <button data-image-action="delete" data-image-id="${img.id}" style="padding: 3px 8px; font-size: 10px; background: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer;">×</button>
                    </div>
                </div>
            `).join('');
        } else {
            grid.innerHTML = '<p style="color: #999;">Chưa có ảnh nào</p>';
        }
    } catch (error) {
        grid.innerHTML = '<p style="color: #f44336;">Lỗi tải ảnh</p>';
    }
}

async function deleteImage(imageId) {
    const confirmed = await window.showGlobalConfirm({
        title: 'Xóa ảnh sản phẩm',
        message: 'Bạn có chắc muốn xóa ảnh này không?',
        confirmText: 'Xóa ảnh',
        cancelText: 'Giữ lại',
        tone: 'danger'
    });

    if (!confirmed) return;

    const productId = document.getElementById('imageModalProductId').value;

    try {
        const response = await fetch(`/admin/products/images/${imageId}`, {
            method: 'DELETE',
            credentials: 'same-origin'
        });

        if (response.ok) {
            showGlobalToast('Đã xóa ảnh.', 'success');
            await loadProductImages(productId);
        } else {
            showGlobalToast('Lỗi xóa ảnh.', 'error');
        }
    } catch (error) {
        showGlobalToast(`Lỗi: ${error.message}`, 'error');
    }
}

async function setPrimaryImage(imageId) {
    const productId = document.getElementById('imageModalProductId').value;

    try {
        const response = await fetch(`/admin/products/images/${imageId}/primary`, {
            method: 'PUT',
            credentials: 'same-origin'
        });

        if (response.ok) {
            showGlobalToast('Đã đặt làm ảnh chính.', 'success');
            await loadProductImages(productId);
        } else {
            showGlobalToast('Lỗi đặt ảnh chính.', 'error');
        }
    } catch (error) {
        showGlobalToast(`Lỗi: ${error.message}`, 'error');
    }
}

async function addImageByUrl() {
    const url = document.getElementById('newImageUrl').value;
    if (!url) {
        showGlobalToast('Vui lòng nhập URL ảnh.', 'warning');
        return;
    }

    const productId = document.getElementById('imageModalProductId').value;
    const isPrimary = document.getElementById('isPrimaryImage').checked;

    try {
        const response = await fetch(`/admin/products/${productId}/images`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ image_url: url, is_primary: isPrimary })
        });

        if (response.ok) {
            showGlobalToast('Đã thêm ảnh.', 'success');
            document.getElementById('newImageUrl').value = '';
            await loadProductImages(productId);
        } else {
            showGlobalToast('Lỗi thêm ảnh.', 'error');
        }
    } catch (error) {
        showGlobalToast(`Lỗi: ${error.message}`, 'error');
    }
}

function addVariantRow(mode, data = {}) {
    const container = document.getElementById(`${mode}VariantsList`);
    const row = document.createElement('div');
    row.className = 'variant-row';
    row.innerHTML = `
        <input type="hidden" class="variant-id" value="${data.id || ''}">
        <div class="variant-row__field variant-row__field--size">
            <span class="variant-row__label">Size</span>
            <select class="variant-size">
                <option value="" ${!data.size ? 'selected' : ''}>Chọn size</option>
                <option value="S" ${data.size === 'S' ? 'selected' : ''}>S</option>
                <option value="M" ${data.size === 'M' ? 'selected' : ''}>M</option>
                <option value="L" ${data.size === 'L' ? 'selected' : ''}>L</option>
                <option value="XL" ${data.size === 'XL' ? 'selected' : ''}>XL</option>
                <option value="XXL" ${data.size === 'XXL' ? 'selected' : ''}>XXL</option>
                <option value="Free Size" ${data.size === 'Free Size' ? 'selected' : ''}>Free Size</option>
            </select>
        </div>
        <div class="variant-row__field variant-row__field--color">
            <span class="variant-row__label">Màu sắc</span>
            <select class="variant-color">
                <option value="" ${!data.color ? 'selected' : ''}>Chọn màu</option>
                <option value="Đen" ${data.color === 'Đen' ? 'selected' : ''}>Đen</option>
                <option value="Trắng" ${data.color === 'Trắng' ? 'selected' : ''}>Trắng</option>
                <option value="Đỏ" ${data.color === 'Đỏ' ? 'selected' : ''}>Đỏ</option>
                <option value="Xanh dương" ${data.color === 'Xanh dương' ? 'selected' : ''}>Xanh dương</option>
                <option value="Xanh lá" ${data.color === 'Xanh lá' ? 'selected' : ''}>Xanh lá</option>
                <option value="Vàng" ${data.color === 'Vàng' ? 'selected' : ''}>Vàng</option>
                <option value="Hồng" ${data.color === 'Hồng' ? 'selected' : ''}>Hồng</option>
                <option value="Tím" ${data.color === 'Tím' ? 'selected' : ''}>Tím</option>
                <option value="Cam" ${data.color === 'Cam' ? 'selected' : ''}>Cam</option>
                <option value="Nâu" ${data.color === 'Nâu' ? 'selected' : ''}>Nâu</option>
                <option value="Xám" ${data.color === 'Xám' ? 'selected' : ''}>Xám</option>
                <option value="Be" ${data.color === 'Be' ? 'selected' : ''}>Be</option>
                <option value="Kem" ${data.color === 'Kem' ? 'selected' : ''}>Kem</option>
            </select>
        </div>
        <div class="variant-row__field variant-row__field--price">
            <span class="variant-row__label">Giá cộng thêm</span>
            <input type="number" placeholder="0" value="${data.additional_price || 0}" class="variant-price" min="0">
        </div>
        <div class="variant-row__field variant-row__field--stock">
            <span class="variant-row__label">Tồn kho</span>
            <input type="number" placeholder="0" value="${data.stock_quantity || 0}" class="variant-stock" min="0">
        </div>
        <div class="variant-row__field variant-row__field--sku">
            <span class="variant-row__label">SKU</span>
            <div style="display:flex; gap:4px; align-items:center;">
                <input type="text" placeholder="Mã SKU" value="${data.sku || ''}" class="variant-sku" style="flex:1;">
                <button type="button" class="variant-auto-sku-btn" title="Tự động tạo mã SKU" style="min-width:32px; height:32px; border:1px solid #ccc; border-radius:8px; background:#f8f8f8; cursor:pointer; font-size:14px;">⚡</button>
            </div>
        </div>
        <div class="variant-row__field variant-row__field--image">
            <span class="variant-row__label">Ảnh biến thể</span>
            <select class="variant-image-select">
                ${getImageOptionsHtml(mode, data.image_id ? `existing:${data.image_id}` : '')}
            </select>
        </div>
        <div class="variant-row__field variant-row__field--upload">
            <span class="variant-row__label">Tải ảnh mới</span>
            <input type="file" class="variant-image-file" accept="image/*">
        </div>
        <div class="variant-row__field variant-row__field--preview">
            <span class="variant-row__label">Xem nhanh</span>
            <div class="variant-image-preview"></div>
        </div>
        <div class="variant-row__action">
            <button type="button" class="variant-remove-btn" title="Xóa biến thể" aria-label="Xóa biến thể">x</button>
        </div>
    `;

    container.appendChild(row);

    row.querySelector('.variant-remove-btn').addEventListener('click', function () {
        removeVariantRow(this, mode);
    });

    // Auto-gen variant SKU
    row.querySelector('.variant-auto-sku-btn')?.addEventListener('click', function() {
        const skuInput = row.querySelector('.variant-sku');
        const size = row.querySelector('.variant-size')?.value || '';
        const color = row.querySelector('.variant-color')?.value || '';

        // Lấy SKU sản phẩm chính hoặc tạo prefix từ danh mục
        let prefix = '';
        if (mode === 'create') {
            prefix = document.getElementById('createSkuInput')?.value?.trim() || '';
        }
        if (!prefix) {
            // Fallback: lấy từ danh mục
            const catSelect = mode === 'create'
                ? document.querySelector('#createProductForm select[name="category_id"]')
                : document.getElementById('editCategoryId');
            const catName = catSelect?.options[catSelect.selectedIndex]?.text || '';
            prefix = catName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase() || 'PRD';
            // Thêm random
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            let rand = '';
            for (let i = 0; i < 4; i++) rand += chars.charAt(Math.floor(Math.random() * chars.length));
            prefix = prefix + '-' + rand;
        }

        // Tạo suffix từ size + color
        const sizePart = size ? size.replace(/\s/g, '').substring(0, 3).toUpperCase() : '';
        const colorPart = color
            ? color.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase()
            : '';

        const parts = [prefix, sizePart, colorPart].filter(Boolean);
        skuInput.value = parts.join('-');
        collectVariants(mode);
    });

    row.querySelectorAll('input, select').forEach(input => {
        const eventName = input.type === 'file' ? 'change' : (input.tagName === 'SELECT' ? 'change' : 'input');
        input.addEventListener(eventName, () => {
            if (input.classList.contains('variant-image-file')) {
                handleVariantFileSelection(input, mode).catch(error => {
                    console.error('Variant image preview error:', error);
                });
                return;
            }
            if (input.classList.contains('variant-image-select')) {
                updateVariantImagePreview(row, mode);
            }
            collectVariants(mode);
        });
    });

    if (data.image_id) {
        row.querySelector('.variant-image-select').value = `existing:${data.image_id}`;
    }

    updateVariantImagePreview(row, mode);
    collectVariants(mode);
}

function collectVariants(mode) {
    const container = document.getElementById(`${mode}VariantsList`);
    const rows = container.querySelectorAll('.variant-row');
    const variants = [];

    rows.forEach(row => {
        const size = row.querySelector('.variant-size').value.trim();
        const color = row.querySelector('.variant-color').value.trim();
        const sku = row.querySelector('.variant-sku').value.trim();
        const imageSelectValue = row.querySelector('.variant-image-select').value;

        if (size || color || sku || imageSelectValue) {
            const variant = {
                size,
                color,
                additional_price: parseFloat(row.querySelector('.variant-price').value) || 0,
                stock_quantity: parseInt(row.querySelector('.variant-stock').value, 10) || 0,
                sku
            };

            const variantId = row.querySelector('.variant-id').value;
            if (variantId) {
                variant.id = parseInt(variantId, 10);
            }

            if (imageSelectValue.startsWith('existing:')) {
                variant.image_id = parseInt(imageSelectValue.replace('existing:', ''), 10);
            } else if (imageSelectValue) {
                variant.image_key = imageSelectValue;
            }

            variants.push(variant);
        }
    });

    document.getElementById(`${mode}VariantsJson`).value = JSON.stringify(variants);
    syncVariantUploadInputNames(mode);
}

function initAdminProducts() {
    const createForm = getCreateForm();
    const createImagesInput = getCreateImagesInput();
    const addImageForm = document.getElementById('addImageForm');
    const editForm = document.getElementById('editForm');
    const imageModalFileInput = document.getElementById('newImageFile');

    if (imageModalFileInput) {
        imageModalFileInput.multiple = true;
    }

    createImagesInput?.addEventListener('change', () => {
        handleCreateImagesSelection().catch(error => {
            console.error('Create image preview error:', error);
        });
    });

    createForm?.addEventListener('submit', function () {
        syncCreateImagesInputFromState();
        syncCreateMainImageOptions();
        collectVariants('create');
    });

    editForm?.addEventListener('submit', async function (e) {
        e.preventDefault();

        collectVariants('edit');
        const id = document.getElementById('editProductId').value;
        const formData = new FormData(editForm);
        formData.set('name', document.getElementById('editName').value);
        formData.set('category_id', document.getElementById('editCategoryId').value);
        formData.set('price', document.getElementById('editPrice').value);
        formData.set('stock_quantity', document.getElementById('editStock').value);
        formData.set('description', document.getElementById('editDescription').value);
        formData.set('variants', document.getElementById('editVariantsJson').value);

        try {
            const response = await fetch(`/admin/products/${id}`, {
                method: 'PUT',
                credentials: 'same-origin',
                body: formData
            });

            const result = await response.json();
            if (response.ok) {
                showToast('Cập nhật sản phẩm thành công.', 'success');
                setTimeout(() => location.reload(), 1500);
            } else {
                showToast(`Lỗi: ${result.message || 'Không thể cập nhật sản phẩm.'}`, 'error');
            }
        } catch (error) {
            showToast(`Lỗi: ${error.message}`, 'error');
        }
    });

    document.getElementById('editModal')?.addEventListener('click', function (e) {
        if (e.target === this) closeEditModal();
    });

    addImageForm?.addEventListener('submit', async function (e) {
        e.preventDefault();

        const files = Array.from(imageModalFileInput?.files || []);
        if (files.length === 0) {
            showGlobalToast('Vui lòng chọn ít nhất 1 ảnh.', 'warning');
            return;
        }

        const productId = document.getElementById('imageModalProductId').value;
        const isPrimary = document.getElementById('isPrimaryImage').checked;
        const formData = new FormData();
        files.forEach(file => formData.append('images', file));
        formData.append('is_primary', isPrimary);

        try {
            const response = await fetch(`/admin/products/${productId}/images/upload`, {
                method: 'POST',
                credentials: 'same-origin',
                body: formData
            });

            const result = await response.json();
            if (response.ok) {
                showGlobalToast(result.message || 'Đã tải lên ảnh.', 'success');
                imageModalFileInput.value = '';
                await loadProductImages(productId);
            } else {
                showGlobalToast(result.message || 'Lỗi tải lên ảnh.', 'error');
            }
        } catch (error) {
            showGlobalToast(`Lỗi: ${error.message}`, 'error');
        }
    });

    document.getElementById('imageModal')?.addEventListener('click', function (e) {
        if (e.target === this) closeImageModal();
    });
    document.getElementById('perpageSelect')?.addEventListener('change', (event) => {
        changePerPage(event.target.value);
    });

    document.querySelectorAll('[data-admin-toggle="section"]').forEach((button) => {
        button.addEventListener('click', () => toggleProductSection(button));
    });

    document.addEventListener('click', (event) => {
        const actionButton = event.target.closest('[data-product-action]');
        if (actionButton) {
            const action = actionButton.dataset.productAction;

            if (action === 'add-variant') {
                addVariantRow(actionButton.dataset.productMode);
                return;
            }

            if (action === 'open-image-modal') {
                openImageModal(Number(actionButton.dataset.productId), actionButton.dataset.productName || '');
                return;
            }

            if (action === 'open-edit-modal') {
                openEditModal(
                    Number(actionButton.dataset.productId),
                    actionButton.dataset.productName || '',
                    actionButton.dataset.productCategoryId || null,
                    Number(actionButton.dataset.productPrice || 0),
                    Number(actionButton.dataset.productStock || 0),
                    actionButton.dataset.productDescription || ''
                );
                return;
            }

            if (action === 'delete-product') {
                deleteProduct(Number(actionButton.dataset.productId));
                return;
            }

            if (action === 'delete-all-products') {
                deleteAllProducts(Number(actionButton.dataset.totalProductCount || 0));
                return;
            }

            if (action === 'close-edit-modal') {
                closeEditModal();
                return;
            }

            if (action === 'close-image-modal') {
                closeImageModal();
                return;
            }

            if (action === 'add-image-url') {
                addImageByUrl();
                return;
            }
        }

        const imageActionButton = event.target.closest('[data-image-action]');
        if (!imageActionButton) {
            return;
        }

        const imageId = Number(imageActionButton.dataset.imageId);
        if (!imageId) {
            return;
        }

        if (imageActionButton.dataset.imageAction === 'set-primary') {
            setPrimaryImage(imageId);
            return;
        }

        if (imageActionButton.dataset.imageAction === 'delete') {
            deleteImage(imageId);
        }
    });

    // =========================================================================
    // AUTO-GENERATE SKU
    // =========================================================================
    const autoSkuCheckbox = document.getElementById('autoSkuCheckbox');
    const createSkuInput = document.getElementById('createSkuInput');
    const categorySelect = createForm?.querySelector('select[name="category_id"]');

    function generateSku() {
        if (!autoSkuCheckbox?.checked) return;

        // Láº¥y tÃªn danh má»¥c Ä‘Ã£ chá»n
        const selectedOption = categorySelect?.options[categorySelect.selectedIndex];
        const categoryName = selectedOption?.text || '';

        // Táº¡o viáº¿t táº¯t tá»« tÃªn danh má»¥c (láº¥y 3 chá»¯ cÃ¡i Ä‘áº§u, chuyá»ƒn thÃ nh uppercase khÃ´ng dáº¥u)
        const abbr = categoryName
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // bá» dáº¥u
            .replace(/[^a-zA-Z\s]/g, '')
            .trim()
            .substring(0, 3)
            .toUpperCase() || 'PRD';

        // Random 4 kÃ½ tá»± alphanumeric
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let randomPart = '';
        for (let i = 0; i < 4; i++) {
            randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
        }

        createSkuInput.value = `${abbr}-${randomPart}`;
    }

    if (autoSkuCheckbox && createSkuInput) {
        autoSkuCheckbox.addEventListener('change', function() {
            if (this.checked) {
                createSkuInput.readOnly = true;
                createSkuInput.style.opacity = '0.7';
                generateSku();
            } else {
                createSkuInput.readOnly = false;
                createSkuInput.style.opacity = '1';
                createSkuInput.value = '';
                createSkuInput.focus();
            }
        });

        // Khi thay Ä‘á»•i danh má»¥c => cáº­p nháº­t láº¡i SKU náº¿u Ä‘ang á»Ÿ cháº¿ Ä‘á»™ tá»± Ä‘á»™ng
        categorySelect?.addEventListener('change', generateSku);
    }

    syncCreateMainImageOptions();
}

document.addEventListener('DOMContentLoaded', initAdminProducts);

