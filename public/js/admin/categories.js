// Điều phối tương tác trình duyệt cho màn quản trị danh mục trong khu vực admin.
let adminCategoriesBootstrap = null;

// Xử lý show danh mục toast.
function showCategoryToast(message, type = 'success') {
    if (typeof showGlobalToast === 'function') {
        showGlobalToast(message, type);
    }
}

// Xử lý read danh mục bootstrap.
function readCategoriesBootstrap() {
    if (adminCategoriesBootstrap) {
        return adminCategoriesBootstrap;
    }

    const bootstrapElement = document.getElementById('adminCategoriesBootstrap');
    if (!bootstrapElement?.textContent) {
        adminCategoriesBootstrap = { categories: [] };
        return adminCategoriesBootstrap;
    }

    try {
        adminCategoriesBootstrap = JSON.parse(bootstrapElement.textContent);
    } catch (error) {
        console.error('Categories bootstrap parse error:', error);
        adminCategoriesBootstrap = { categories: [] };
    }

    return adminCategoriesBootstrap;
}

// Xử lý slugify danh mục value.
function slugifyCategoryValue(value) {
    return String(value ?? '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\u0111/g, 'd')
        .replace(/\u0110/g, 'd')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

// Xử lý escape html.
function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Xử lý show danh mục confirm.
function showCategoryConfirm(message, title = 'Xác nhận', yesText = 'Xác nhận') {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirmModal');
        document.getElementById('confirmTitle').textContent = title;
        document.getElementById('confirmMessage').textContent = message;
        document.getElementById('confirmYes').textContent = yesText;
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

async function requestCategoryBulkDeleteVerificationCode(action) {
    const response = await fetch('/admin/bulk-actions/verification-code', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
    });
    const result = await response.json();

    if (!response.ok || !result.success) {
        throw new Error(result.message || 'Không thể gửi mã xác thực.');
    }

    return result;
}

async function confirmExportCategories(targetUrl) {
    const confirmed = await showCategoryConfirm(
        'File xuất sẽ chứa dữ liệu danh mục theo bộ lọc hiện tại. Bạn có muốn tiếp tục tải xuống?',
        'Xuất danh mục',
        'Tải xuống'
    );

    if (!confirmed) {
        return;
    }

    try {
        const verification = await requestCategoryBulkDeleteVerificationCode('export_categories');
        const email = verification.email || 'nvuthanh4@gmail.com';
        showCategoryToast(`Mã xác thực đã được gửi tới ${email}.`, 'success');
        const verificationCode = window.prompt(`Nhập mã OTP vừa gửi tới ${email} để xuất danh mục:`);

        if (!verificationCode || !verificationCode.trim()) {
            showCategoryToast('Đã hủy vì chưa nhập mã OTP.', 'warning');
            return;
        }

        const exportUrl = new URL(targetUrl, window.location.origin);
        exportUrl.searchParams.set('verificationCode', verificationCode.trim());
        window.location.href = exportUrl.toString();
    } catch (error) {
        showCategoryToast(`Lỗi: ${error.message}`, 'error');
    }
}

// Bật/tắt danh mục section.
function toggleCategorySection(titleElement) {
    const section = titleElement.closest('.admin-section--collapsible');
    section?.classList.toggle('is-open');
}

// Đồng bộ slug field.
function syncSlugField(nameInput, slugInput) {
    if (!nameInput || !slugInput) {
        return;
    }

    let lastAutoSlug = slugifyCategoryValue(nameInput.value);

    if (!slugInput.value.trim()) {
        slugInput.value = lastAutoSlug;
    }
    nameInput.addEventListener('input', () => {
        const currentSlug = slugInput.value.trim();
        if (!currentSlug || currentSlug === lastAutoSlug) {
            lastAutoSlug = slugifyCategoryValue(nameInput.value);
            slugInput.value = lastAutoSlug;
        }
    });
    slugInput.addEventListener('input', () => {
        slugInput.value = slugifyCategoryValue(slugInput.value);
        lastAutoSlug = slugifyCategoryValue(nameInput.value);
    });
}

// Tìm danh mục theo id.
function findCategoryById(categoryId) {
    const categories = readCategoriesBootstrap().categories || [];
    return categories.find((category) => Number(category.id) === Number(categoryId)) || null;
}

// Hiển thị parent select tùy chọn.
function renderParentSelectOptions(selectElement, currentCategoryId = null, selectedParentId = null) {
    if (!selectElement) {
        return;
    }

    const categories = readCategoriesBootstrap().categories || [];
    const currentId = Number(currentCategoryId);
    const selectedId = selectedParentId === null || selectedParentId === undefined || selectedParentId === ''
        ? null
        : Number(selectedParentId);

    const optionsHtml = [
        '<option value="">-- Danh mục gốc --</option>',
        ...categories
            .filter((category) => Number(category.id) !== currentId)
            .map((category) => `
                <option value="${category.id}" ${Number(category.id) === selectedId ? 'selected' : ''}>
                    ${escapeHtml(category.name)}
                </option>
            `)
    ];

    selectElement.innerHTML = optionsHtml.join('');
}

// Mở danh mục modal.
function openCategoryModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) {
        return;
    }

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

// Đóng danh mục modal.
function closeCategoryModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) {
        return;
    }

    modal.style.display = 'none';
    document.body.style.overflow = '';
}

// Xử lý populate edit danh mục form.
function populateEditCategoryForm(categoryId) {
    const category = findCategoryById(categoryId);
    if (!category) {
        showCategoryToast('Không tìm thấy dữ liệu danh mục', 'error');
        return;
    }

    document.getElementById('editCategoryId').value = String(category.id);
    document.getElementById('editCategoryName').value = category.name || '';
    document.getElementById('editCategorySlug').value = category.slug || '';
    document.getElementById('editCategoryDisplayOrder').value = String(category.display_order || 0);
    document.getElementById('editCategoryImageUrl').value = category.image_url || '';
    const imageInput = document.getElementById('editCategoryImage');
    if (imageInput) {
        imageInput.value = '';
    }
    document.getElementById('editCategoryDescription').value = category.description || '';

    renderParentSelectOptions(
        document.getElementById('editCategoryParentId'),
        category.id,
        category.parent_id
    );

    openCategoryModal('editCategoryModal');
}

// Xóa danh mục.
async function deleteCategory(categoryId) {
    const confirmed = await showCategoryConfirm(
        'Danh mục sẽ bị ẩn khỏi hệ thống. Chỉ có thể xóa khi không còn sản phẩm hoặc danh mục con.',
        'Xóa danh mục',
        'Xóa'
    );

    if (!confirmed) {
        return;
    }

    try {
        const response = await fetch(`/admin/categories/${categoryId}`, {
            method: 'DELETE',
            credentials: 'same-origin'
        });
        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || 'Không thể xóa danh mục');
        }

        showCategoryToast(result.message || 'Đã xóa danh mục', 'success');
        setTimeout(() => window.location.reload(), 900);
    } catch (error) {
        showCategoryToast(error.message || 'Không thể xóa danh mục', 'error');
    }
}

// Xóa tất cả danh mục.
async function deleteAllCategories() {
    const confirmed = await showCategoryConfirm(
        'Thao tác này sẽ xóa vĩnh viễn toàn bộ danh mục có thể xóa trong database, đồng thời xóa luôn sản phẩm, ảnh và biến thể thuộc các danh mục đó. Danh mục gắn với sản phẩm đã nằm trong lịch sử đơn hàng sẽ không thể xóa. Bạn có chắc muốn tiếp tục?',
        'Xóa vĩnh viễn tất cả danh mục',
        'Xóa vĩnh viễn'
    );

    if (!confirmed) {
        return;
    }

    try {
        const verification = await requestCategoryBulkDeleteVerificationCode('delete_all_categories');
        showCategoryToast(`Mã xác thực đã được gửi tới ${verification.email || 'nvuthanh4@gmail.com'}.`, 'success');
        const verificationCode = window.prompt(`Nhập mã xác thực vừa gửi tới ${verification.email || 'nvuthanh4@gmail.com'}:`);

        if (!verificationCode || !verificationCode.trim()) {
            showCategoryToast('Đã hủy vì chưa nhập mã xác thực.', 'warning');
            return;
        }

        const response = await fetch('/admin/categories/delete-all', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ verificationCode: verificationCode.trim() })
        });
        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || 'Không thể xóa tất cả danh mục');
        }

        showCategoryToast(result.message || 'Đã xóa vĩnh viễn tất cả danh mục có thể xóa', 'success');
        setTimeout(() => window.location.reload(), 1100);
    } catch (error) {
        showCategoryToast(error.message || 'Không thể xóa tất cả danh mục', 'error');
    }
}

// Xử lý submit edit danh mục form.
async function submitEditCategoryForm(event) {
    event.preventDefault();

    const categoryId = document.getElementById('editCategoryId').value;
    const payload = new FormData();
    payload.append('name', document.getElementById('editCategoryName').value);
    payload.append('slug', document.getElementById('editCategorySlug').value);
    payload.append('parent_id', document.getElementById('editCategoryParentId').value);
    payload.append('display_order', document.getElementById('editCategoryDisplayOrder').value);
    payload.append('image_url', document.getElementById('editCategoryImageUrl').value);
    payload.append('description', document.getElementById('editCategoryDescription').value);

    const imageInput = document.getElementById('editCategoryImage');
    if (imageInput?.files?.[0]) {
        payload.append('image', imageInput.files[0]);
    }

    try {
        const response = await fetch(`/admin/categories/${categoryId}`, {
            method: 'PUT',
            credentials: 'same-origin',
            body: payload
        });
        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || 'Không thể cập nhật danh mục');
        }

        showCategoryToast(result.message || 'Cập nhật danh mục thành công', 'success');
        closeCategoryModal('editCategoryModal');
        setTimeout(() => window.location.reload(), 800);
    } catch (error) {
        showCategoryToast(error.message || 'Không thể cập nhật danh mục', 'error');
    }
}

// Xử lý show toast từ truy vấn.
function showToastFromQuery() {
    const url = new URL(window.location.href);
    const successMessage = url.searchParams.get('success');
    const errorMessage = url.searchParams.get('error');

    if (!successMessage && !errorMessage) {
        return;
    }

    if (successMessage) {
        showCategoryToast(successMessage, 'success');
    }

    if (errorMessage) {
        showCategoryToast(errorMessage, 'error');
        document.querySelector('.admin-section--category-create')?.classList.add('is-open');
    }

    url.searchParams.delete('success');
    url.searchParams.delete('error');
    window.history.replaceState({}, '', url.toString());
}

// Khởi tạo quản trị danh mục trang.
function initAdminCategoriesPage() {
    readCategoriesBootstrap();
    showToastFromQuery();

    document.querySelectorAll('[data-admin-toggle="section"]').forEach((button) => {
        button.addEventListener('click', () => toggleCategorySection(button));
    });

    syncSlugField(
        document.getElementById('createCategoryName'),
        document.getElementById('createCategorySlug')
    );
    syncSlugField(
        document.getElementById('editCategoryName'),
        document.getElementById('editCategorySlug')
    );

    document.querySelectorAll('[data-category-action="open-edit-modal"]').forEach((button) => {
        button.addEventListener('click', () => populateEditCategoryForm(button.dataset.categoryId));
    });

    document.querySelectorAll('[data-category-action="delete-category"]').forEach((button) => {
        button.addEventListener('click', () => deleteCategory(button.dataset.categoryId));
    });

    document.querySelectorAll('[data-category-action="delete-all-categories"]').forEach((button) => {
        button.addEventListener('click', () => deleteAllCategories());
    });

    document.querySelectorAll('[data-category-action="export-categories"]').forEach((link) => {
        link.addEventListener('click', (event) => {
            event.preventDefault();
            confirmExportCategories(link.href);
        });
    });

    document.querySelectorAll('[data-category-modal-close]').forEach((button) => {
        button.addEventListener('click', () => closeCategoryModal(button.dataset.categoryModalClose));
    });

    document.getElementById('editCategoryModal')?.addEventListener('click', (event) => {
        if (event.target.id === 'editCategoryModal') {
            closeCategoryModal('editCategoryModal');
        }
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeCategoryModal('editCategoryModal');
        }
    });

    document.getElementById('editCategoryForm')?.addEventListener('submit', submitEditCategoryForm);
}
document.addEventListener('DOMContentLoaded', initAdminCategoriesPage);
