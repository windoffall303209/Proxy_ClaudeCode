let adminCategoriesBootstrap = null;

function showCategoryToast(message, type = 'success') {
    if (typeof showGlobalToast === 'function') {
        showGlobalToast(message, type);
    }
}

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

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function showCategoryConfirm(message, title = 'Xác nhận') {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirmModal');
        document.getElementById('confirmTitle').textContent = title;
        document.getElementById('confirmMessage').textContent = message;
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

function toggleCategorySection(titleElement) {
    const section = titleElement.closest('.admin-section--collapsible');
    section?.classList.toggle('is-open');
}

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

function findCategoryById(categoryId) {
    const categories = readCategoriesBootstrap().categories || [];
    return categories.find((category) => Number(category.id) === Number(categoryId)) || null;
}

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

function openCategoryModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) {
        return;
    }

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeCategoryModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) {
        return;
    }

    modal.style.display = 'none';
    document.body.style.overflow = '';
}

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
    document.getElementById('editCategoryDescription').value = category.description || '';

    renderParentSelectOptions(
        document.getElementById('editCategoryParentId'),
        category.id,
        category.parent_id
    );

    openCategoryModal('editCategoryModal');
}

async function deleteCategory(categoryId) {
    const confirmed = await showCategoryConfirm(
        'Danh mục sẽ bị ẩn khỏi hệ thống. Chỉ có thể xóa khi không còn sản phẩm hoặc danh mục con.',
        'Xóa danh mục'
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

async function submitEditCategoryForm(event) {
    event.preventDefault();

    const categoryId = document.getElementById('editCategoryId').value;
    const payload = {
        name: document.getElementById('editCategoryName').value,
        slug: document.getElementById('editCategorySlug').value,
        parent_id: document.getElementById('editCategoryParentId').value,
        display_order: document.getElementById('editCategoryDisplayOrder').value,
        image_url: document.getElementById('editCategoryImageUrl').value,
        description: document.getElementById('editCategoryDescription').value
    };

    try {
        const response = await fetch(`/admin/categories/${categoryId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify(payload)
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
        document.querySelector('.admin-section--collapsible')?.classList.add('is-open');
    }

    url.searchParams.delete('success');
    url.searchParams.delete('error');
    window.history.replaceState({}, '', url.toString());
}

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
