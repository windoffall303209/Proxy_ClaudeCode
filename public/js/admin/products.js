// Admin Products page JavaScript

function showToast(message, type = 'success') {
    if (typeof showGlobalToast === 'function') showGlobalToast(message, type);
}

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

const variantMediaState = {
    create: { images: [], uploadCounter: 0, productId: null },
    edit: { images: [], uploadCounter: 0, productId: null }
};

function getModeState(mode) {
    return variantMediaState[mode];
}

function buildExistingImageOption(image) {
    return {
        value: `existing:${image.id}`,
        label: `Ảnh #${image.id}${image.is_primary ? ' (chính)' : ''}`,
        previewUrl: image.image_url,
        imageId: image.id,
        kind: 'existing'
    };
}

function buildMainImageOption(file, index) {
    return {
        value: `main:${index}`,
        label: `Ảnh tải lên: ${file.name}`,
        previewUrl: URL.createObjectURL(file),
        kind: 'main'
    };
}

function buildUploadedImageOption(token, file) {
    return {
        value: `upload:${token}`,
        label: `Ảnh variant: ${file.name}`,
        previewUrl: URL.createObjectURL(file),
        kind: 'upload',
        token
    };
}

function upsertModeImage(mode, imageOption) {
    const state = getModeState(mode);
    const existingIndex = state.images.findIndex(image => image.value === imageOption.value);
    if (existingIndex >= 0) {
        state.images[existingIndex] = imageOption;
    } else {
        state.images.push(imageOption);
    }
}

function removeModeImage(mode, value) {
    const state = getModeState(mode);
    state.images = state.images.filter(image => image.value !== value);
}

function resetModeImages(mode, images) {
    const state = getModeState(mode);
    state.images = images.slice();
}

function getCreateForm() {
    return document.querySelector('form[action="/admin/products"]');
}

function getCreateImagesInput() {
    return getCreateForm()?.querySelector('input[name="images"]');
}

function syncCreateMainImageOptions() {
    const input = getCreateImagesInput();
    const state = getModeState('create');
    state.images = state.images.filter(image => image.kind !== 'main');

    const files = Array.from(input?.files || []);
    files.forEach((file, index) => {
        state.images.push(buildMainImageOption(file, index));
    });

    refreshVariantImageSelects('create');
}

function getImageOptionsHtml(mode, selectedValue = '') {
    const state = getModeState(mode);
    const baseOption = '<option value="">-- Ảnh variant --</option>';
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
        preview.style.display = 'none';
        return;
    }

    preview.style.display = 'flex';
    preview.innerHTML = `<img src="${selectedImage.previewUrl}" alt="Ảnh biến thể">`;
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

function handleVariantFileSelection(fileInput, mode) {
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

    fileInput.name = `variant_image__${token}`;
    upsertModeImage(mode, buildUploadedImageOption(token, file));
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
    const confirmed = await showConfirm('Bạn có chắc muốn xóa sản phẩm này?', 'Xóa Sản Phẩm', 'Xóa', '#f44336');
    if (!confirmed) return;

    try {
        const response = await fetch(`/admin/products/${productId}`, {
            method: 'DELETE',
            credentials: 'same-origin'
        });
        if (response.ok) {
            showToast('Xóa sản phẩm thành công!', 'success');
            setTimeout(() => location.reload(), 1500);
        } else {
            const result = await response.json();
            showToast('Lỗi xóa sản phẩm: ' + (result.message || 'Unknown error'), 'error');
        }
    } catch (error) {
        showToast('Lỗi: ' + error.message, 'error');
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
                        ${!img.is_primary ? `<button onclick="setPrimaryImage(${img.id})" style="padding: 3px 8px; font-size: 10px; background: #4caf50; color: white; border: none; border-radius: 4px; cursor: pointer;">★</button>` : ''}
                        <button onclick="deleteImage(${img.id})" style="padding: 3px 8px; font-size: 10px; background: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer;">×</button>
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
    if (!confirm('Bạn có chắc muốn xóa ảnh này?')) return;

    const productId = document.getElementById('imageModalProductId').value;

    try {
        const response = await fetch(`/admin/products/images/${imageId}`, {
            method: 'DELETE',
            credentials: 'same-origin'
        });

        if (response.ok) {
            showGlobalToast('Đã xóa ảnh!', 'success');
            await loadProductImages(productId);
        } else {
            showGlobalToast('Lỗi xóa ảnh', 'error');
        }
    } catch (error) {
        showGlobalToast('Lỗi: ' + error.message, 'error');
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
            showGlobalToast('Đã đặt làm ảnh chính!', 'success');
            await loadProductImages(productId);
        } else {
            showGlobalToast('Lỗi đặt ảnh chính', 'error');
        }
    } catch (error) {
        showGlobalToast('Lỗi: ' + error.message, 'error');
    }
}

async function addImageByUrl() {
    const url = document.getElementById('newImageUrl').value;
    if (!url) {
        showGlobalToast('Vui lòng nhập URL ảnh', 'warning');
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
            showGlobalToast('Đã thêm ảnh!', 'success');
            document.getElementById('newImageUrl').value = '';
            await loadProductImages(productId);
        } else {
            showGlobalToast('Lỗi thêm ảnh', 'error');
        }
    } catch (error) {
        showGlobalToast('Lỗi: ' + error.message, 'error');
    }
}

function addVariantRow(mode, data = {}) {
    const container = document.getElementById(`${mode}VariantsList`);
    const row = document.createElement('div');
    row.className = 'variant-row';
    row.innerHTML = `
        <input type="hidden" class="variant-id" value="${data.id || ''}">
        <div class="variant-row__field">
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
        <div class="variant-row__field">
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
        <div class="variant-row__field">
            <span class="variant-row__label">Giá cộng thêm</span>
            <input type="number" placeholder="0" value="${data.additional_price || 0}" class="variant-price" min="0">
        </div>
        <div class="variant-row__field">
            <span class="variant-row__label">Tồn kho</span>
            <input type="number" placeholder="0" value="${data.stock_quantity || 0}" class="variant-stock" min="0">
        </div>
        <div class="variant-row__field">
            <span class="variant-row__label">SKU</span>
            <input type="text" placeholder="Mã SKU" value="${data.sku || ''}" class="variant-sku">
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
            <button type="button" class="variant-remove-btn" title="Xóa biến thể" aria-label="Xóa biến thể">×</button>
        </div>
    `;

    container.appendChild(row);

    row.querySelector('.variant-remove-btn').addEventListener('click', function () {
        removeVariantRow(this, mode);
    });

    row.querySelectorAll('input, select').forEach(input => {
        const eventName = input.type === 'file' ? 'change' : (input.tagName === 'SELECT' ? 'change' : 'input');
        input.addEventListener(eventName, () => {
            if (input.classList.contains('variant-image-file')) {
                handleVariantFileSelection(input, mode);
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

    createImagesInput?.addEventListener('change', syncCreateMainImageOptions);

    createForm?.addEventListener('submit', function () {
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
                showToast('Cập nhật sản phẩm thành công!', 'success');
                setTimeout(() => location.reload(), 1500);
            } else {
                showToast('Lỗi: ' + (result.message || 'Không thể cập nhật sản phẩm'), 'error');
            }
        } catch (error) {
            showToast('Lỗi: ' + error.message, 'error');
        }
    });

    document.getElementById('editModal')?.addEventListener('click', function (e) {
        if (e.target === this) closeEditModal();
    });

    addImageForm?.addEventListener('submit', async function (e) {
        e.preventDefault();

        const files = Array.from(imageModalFileInput?.files || []);
        if (files.length === 0) {
            showGlobalToast('Vui lòng chọn ít nhất 1 ảnh', 'warning');
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
                showGlobalToast(result.message || 'Đã tải lên ảnh!', 'success');
                imageModalFileInput.value = '';
                await loadProductImages(productId);
            } else {
                showGlobalToast(result.message || 'Lỗi tải lên ảnh', 'error');
            }
        } catch (error) {
            showGlobalToast('Lỗi: ' + error.message, 'error');
        }
    });

    document.getElementById('imageModal')?.addEventListener('click', function (e) {
        if (e.target === this) closeImageModal();
    });
}

document.addEventListener('DOMContentLoaded', initAdminProducts);
