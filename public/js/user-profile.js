// Điều phối tương tác trình duyệt cho người dùng hồ sơ người dùng, tách khỏi template EJS.
function togglePassword(button) {
    const wrapper = button.parentElement;
    const input = wrapper.querySelector('input');
    const eyeOpen = button.querySelector('.eye-open');
    const eyeClosed = button.querySelector('.eye-closed');
    const isHidden = input.type === 'password';

    input.type = isHidden ? 'text' : 'password';
    button.classList.toggle('active', isHidden);
    button.setAttribute('aria-pressed', String(isHidden));
    if (eyeOpen) eyeOpen.hidden = isHidden;
    if (eyeClosed) eyeClosed.hidden = !isHidden;
}

// Đưa người dùng về ô số điện thoại khi cần cập nhật liên hệ.
function focusPhoneInput() {
    const phoneInput = document.querySelector('#profileForm input[name="phone"]');
    if (!phoneInput) {
        return;
    }

    phoneInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => phoneInput.focus(), 250);
}

// Xử lý show profile alert.
function showProfileAlert(message, type = 'success') {
    if (typeof showGlobalToast === 'function') {
        showGlobalToast(message, type);
    }
}

// Che số điện thoại.
function maskPhone(value) {
    const phone = String(value || '').trim();
    if (!phone) return '';
    return `${'*'.repeat(Math.max(phone.length - 2, 0))}${phone.slice(-2)}`;
}

function normalizePhoneInput(value) {
    return String(value || '').replace(/\D/g, '');
}

function isValidVietnamPhone(value) {
    return /^0[2-9]\d{8}$/.test(normalizePhoneInput(value));
}

// Che ngày sinh.
function maskBirthday(value) {
    const dateValue = String(value || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
        return 'Chưa cập nhật';
    }
    const [year, month, day] = dateValue.split('-');
    return `${day}/${month}/${year}`;
}

// Cập nhật private value.
function updatePrivateValue(type, maskedValue) {
    const valueEl = document.querySelector(`.private-value[data-private-type="${type}"]`);
    if (!valueEl) return;
    if (type === 'phone' && valueEl.classList.contains('profile-form__hint')) {
        valueEl.textContent = maskedValue ? `Đang hiển thị công khai: ${maskedValue}` : '';
        return;
    }
    valueEl.textContent = maskedValue;
}

function initProfileEditorActions() {
    document.querySelectorAll('[data-profile-action="choose-avatar"]').forEach((button) => {
        button.addEventListener('click', () => {
            document.getElementById('avatarInput')?.click();
        });
    });

    document.querySelectorAll('[data-profile-action="toggle-private-edit"]').forEach((button) => {
        button.addEventListener('click', () => {
            const target = button.dataset.privateEditTarget;
            if (!target) return;
            const value = document.querySelector(`.private-value[data-private-type="${target}"]`);
            const field = document.querySelector(`[data-private-edit-field="${target}"]`);
            if (!field) return;
            field.hidden = false;
            field.disabled = false;
            if (target === 'phone') {
                field.value = '';
            }
            value?.setAttribute('hidden', '');
            button.hidden = true;
            field.focus();
        });
    });

    document.querySelectorAll('[data-private-edit-field="phone"]').forEach((field) => {
        field.addEventListener('input', () => {
            field.value = normalizePhoneInput(field.value).slice(0, 10);
        });
    });
}

// Khởi tạo avatar upload.
function initAvatarUpload() {
    const avatarInput = document.getElementById('avatarInput');
    const avatarImages = [
        document.getElementById('avatarImage'),
        document.getElementById('profileAvatarImage')
    ].filter(Boolean);
    const avatarPlaceholders = [
        document.getElementById('avatarPlaceholder'),
        document.getElementById('profileAvatarPlaceholder')
    ].filter(Boolean);
    const headerAvatar = document.querySelector('.account-menu__avatar');
    const setAvatarPreview = (src) => {
        avatarImages.forEach((image) => {
            image.src = src;
            image.hidden = false;
        });
        avatarPlaceholders.forEach((placeholder) => {
            placeholder.hidden = true;
        });
        if (headerAvatar) {
            let image = headerAvatar.querySelector('img');
            if (!image) {
                headerAvatar.textContent = '';
                image = document.createElement('img');
                image.alt = 'Avatar';
                headerAvatar.appendChild(image);
            }
            image.src = src;
        }
    };

    if (!avatarInput) return;
    avatarInput.addEventListener('change', async function(event) {
        const file = event.target.files[0];
        if (!file) return;

        if (file.size > 1024 * 1024) {
            showProfileAlert('File ảnh phải nhỏ hơn 1MB', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = function(loadEvent) {
            setAvatarPreview(loadEvent.target.result);
        };
        reader.readAsDataURL(file);

        const formData = new FormData();
        formData.append('avatar', file);

        try {
            const response = await fetch('/auth/profile/avatar', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            if (result.success) {
                if (result.avatar_url) {
                    setAvatarPreview(result.avatar_url);
                }
                showProfileAlert('Cập nhật ảnh đại diện thành công');
            } else {
                showProfileAlert(result.message || 'Lỗi upload ảnh', 'error');
            }
        } catch (error) {
            console.error('Avatar lỗi upload:', error);
            showProfileAlert('Lỗi kết nối server', 'error');
        }
    });
}

// Khởi tạo profile form.
function initProfileForm() {
    const profileForm = document.getElementById('profileForm');
    if (!profileForm) return;
    profileForm.addEventListener('submit', async function(event) {
        event.preventDefault();

        const submitBtn = this.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Đang lưu...';

        const data = Object.fromEntries(new FormData(this).entries());
        if (Object.prototype.hasOwnProperty.call(data, 'phone')) {
            data.phone = normalizePhoneInput(data.phone);
            if (!isValidVietnamPhone(data.phone)) {
                showProfileAlert('Số điện thoại phải gồm 10 số và bắt đầu bằng 0', 'error');
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
                return;
            }
        }

        try {
            const response = await fetch('/auth/profile/update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();
            if (result.success) {
                showProfileAlert('Cập nhật thông tin thành công');
                const sidebarName = document.querySelector('.account-sidebar__identity strong');
                if (sidebarName && data.full_name) {
                    sidebarName.textContent = data.full_name;
                }
                if (Object.prototype.hasOwnProperty.call(data, 'phone')) {
                    updatePrivateValue('phone', maskPhone(data.phone || ''));
                }
                updatePrivateValue('birthday', maskBirthday(data.birthday));
                const phoneField = this.querySelector('[data-private-edit-field="phone"]');
                const phoneValue = this.querySelector('.private-value[data-private-type="phone"]');
                const phoneButton = this.querySelector('[data-private-edit-target="phone"]');
                if (phoneField && Object.prototype.hasOwnProperty.call(data, 'phone')) {
                    phoneField.value = '';
                    phoneField.hidden = true;
                    phoneField.disabled = true;
                    phoneValue?.removeAttribute('hidden');
                    if (phoneButton) phoneButton.hidden = false;
                }
            } else {
                showProfileAlert(result.message || 'Lỗi cập nhật', 'error');
            }
        } catch (error) {
            console.error('Profile update error:', error);
            showProfileAlert('Lỗi kết nối server', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    });
}

// Khởi tạo mật khẩu form.
function initPasswordForm() {
    const passwordForm = document.getElementById('passwordForm');
    if (!passwordForm) return;
    passwordForm.addEventListener('submit', async function(event) {
        event.preventDefault();

        const submitBtn = this.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Đang đổi...';

        const data = Object.fromEntries(new FormData(this).entries());

        if (data.new_password !== data.confirm_password) {
            showProfileAlert('Xác nhận mật khẩu không khớp', 'error');
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
            return;
        }

        if (data.new_password.length < 6) {
            showProfileAlert('Mật khẩu mới phải có ít nhất 6 ký tự', 'error');
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
            return;
        }

        try {
            const response = await fetch('/auth/change-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();
            if (result.success) {
                showProfileAlert('Đổi mật khẩu thành công');
                this.reset();
            } else {
                showProfileAlert(result.message || 'Lỗi đổi mật khẩu', 'error');
            }
        } catch (error) {
            console.error('Password change error:', error);
            showProfileAlert('Lỗi kết nối server', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    });
}

// Khởi tạo tab tài khoản.
function initAccountTabs() {
    const tabs = Array.from(document.querySelectorAll('[data-account-tab]'));
    const panels = Array.from(document.querySelectorAll('[data-account-panel]'));
    const sidebar = document.querySelector('.account-sidebar');
    const accountGroup = document.querySelector('.account-sidebar__group');
    const accountKeys = new Set(['profile', 'address', 'bank', 'password', 'notification-settings', 'delete-account']);
    if (!tabs.length || !panels.length) return;

    const activateTab = (key, updateHash = true) => {
        const isAccountKey = accountKeys.has(key);
        tabs.forEach((tab) => {
            const isGroupTitle = tab.dataset.accountToggle === 'account';
            tab.classList.toggle('is-active', isGroupTitle ? isAccountKey : tab.dataset.accountTab === key);
        });
        accountGroup?.classList.toggle('is-open', isAccountKey);
        sidebar?.classList.toggle('account-sidebar--account-open', isAccountKey);
        panels.forEach((panel) => {
            const isActive = panel.dataset.accountPanel === key;
            panel.hidden = !isActive;
            panel.classList.toggle('is-active', isActive);
        });
        if (updateHash) {
            window.history.replaceState(null, '', `#${key}`);
        }
    };

    tabs.forEach((tab) => {
        tab.addEventListener('click', () => activateTab(tab.dataset.accountTab));
    });

    const initialKey = window.location.hash.replace('#', '');
    if (initialKey && tabs.some((tab) => tab.dataset.accountTab === initialKey)) {
        activateTab(initialKey, false);
    }

    window.addEventListener('hashchange', () => {
        const hashKey = window.location.hash.replace('#', '');
        if (hashKey && tabs.some((tab) => tab.dataset.accountTab === hashKey)) {
            activateTab(hashKey, false);
        }
    });
}

// Khởi tạo form địa chỉ trong tài khoản.
function initAccountAddressForm() {
    const form = document.getElementById('accountAddressForm');
    if (!form) return;
    const title = document.getElementById('accountAddressFormTitle');
    const idInput = form.querySelector('input[name="id"]');
    const setFormVisible = (visible) => {
        form.hidden = !visible;
    };
    const fillFormFromCard = (card) => {
        const elements = form.elements;
        idInput.value = card.dataset.addressId || '';
        elements.full_name.value = card.dataset.fullName || '';
        elements.phone.value = card.dataset.phone || '';
        elements.address_line.value = card.dataset.addressLine || '';
        elements.ward.value = card.dataset.ward || '';
        elements.district.value = card.dataset.district || '';
        elements.city.value = card.dataset.city || '';
        elements.is_default.checked = card.dataset.isDefault === 'true';
        if (title) title.textContent = 'Cập nhật địa chỉ';
        setFormVisible(true);
        form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };
    const resetForm = () => {
        form.reset();
        idInput.value = '';
        if (title) title.textContent = 'Thêm địa chỉ mới';
    };

    document.querySelectorAll('[data-profile-action="open-address-form"]').forEach((button) => {
        button.addEventListener('click', () => {
            resetForm();
            setFormVisible(true);
            form.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
    });

    document.querySelectorAll('[data-profile-action="close-address-form"]').forEach((button) => {
        button.addEventListener('click', () => {
            setFormVisible(false);
            resetForm();
        });
    });

    document.querySelectorAll('[data-profile-action="edit-address"]').forEach((button) => {
        button.addEventListener('click', () => {
            const card = button.closest('.account-address-card');
            if (card) fillFormFromCard(card);
        });
    });

    document.querySelectorAll('[data-profile-action="delete-address"]').forEach((button) => {
        button.addEventListener('click', async () => {
            const card = button.closest('.account-address-card');
            const addressId = card?.dataset.addressId;
            if (!addressId) return;
            if (!window.confirm('Bạn muốn xóa địa chỉ này chứ?')) return;

            try {
                const response = await fetch(`/auth/address/${addressId}`, { method: 'DELETE' });
                const result = await response.json();
                if (!result.success) {
                    showProfileAlert(result.message || 'Không thể xóa địa chỉ', 'error');
                    return;
                }
                showProfileAlert('Đã xóa địa chỉ');
                window.location.hash = '#address';
                window.location.reload();
            } catch (error) {
                console.error('Address delete error:', error);
                showProfileAlert('Lỗi kết nối server', 'error');
            }
        });
    });

    document.querySelectorAll('[data-profile-action="default-address"]').forEach((button) => {
        button.addEventListener('click', async () => {
            const card = button.closest('.account-address-card');
            if (!card) return;
            const data = {
                full_name: card.dataset.fullName,
                phone: card.dataset.phone,
                address_line: card.dataset.addressLine,
                ward: card.dataset.ward,
                district: card.dataset.district,
                city: card.dataset.city,
                is_default: true
            };

            try {
                const response = await fetch(`/auth/address/${card.dataset.addressId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                const result = await response.json();
                if (!result.success) {
                    showProfileAlert(result.message || 'Không thể đặt mặc định', 'error');
                    return;
                }
                showProfileAlert('Đã đặt địa chỉ mặc định');
                window.location.hash = '#address';
                window.location.reload();
            } catch (error) {
                console.error('Address default error:', error);
                showProfileAlert('Lỗi kết nối server', 'error');
            }
        });
    });

    form.addEventListener('submit', async function(event) {
        event.preventDefault();
        const submitBtn = this.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Đang lưu...';

        const data = Object.fromEntries(new FormData(this).entries());
        data.is_default = this.querySelector('input[name="is_default"]')?.checked || false;
        const addressId = data.id;
        delete data.id;

        try {
            const response = await fetch(addressId ? `/auth/address/${addressId}` : '/auth/address', {
                method: addressId ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await response.json();
            if (!result.success) {
                showProfileAlert(result.message || 'Không thể lưu địa chỉ', 'error');
                return;
            }

            showProfileAlert('Đã lưu địa chỉ thành công');
            window.location.hash = '#address';
            window.location.reload();
        } catch (error) {
            console.error('Address save error:', error);
            showProfileAlert('Lỗi kết nối server', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    });
}

function initAccountAddressListActions() {
    document.querySelectorAll('[data-profile-action="delete-address"]').forEach((button) => {
        if (button.dataset.profileAddressBound === 'true') return;
        button.dataset.profileAddressBound = 'true';
        button.addEventListener('click', async () => {
            const card = button.closest('.account-address-card');
            const addressId = card?.dataset.addressId;
            if (!addressId) return;
            if (!window.confirm('Bạn muốn xóa địa chỉ này chứ?')) return;

            try {
                const response = await fetch(`/auth/address/${addressId}`, { method: 'DELETE' });
                const result = await response.json();
                if (!result.success) {
                    showProfileAlert(result.message || 'Không thể xóa địa chỉ', 'error');
                    return;
                }
                showProfileAlert('Đã xóa địa chỉ');
                window.location.hash = '#address';
                window.location.reload();
            } catch (error) {
                console.error('Address delete error:', error);
                showProfileAlert('Lỗi kết nối server', 'error');
            }
        });
    });

    document.querySelectorAll('[data-profile-action="default-address"]').forEach((button) => {
        if (button.dataset.profileAddressBound === 'true') return;
        button.dataset.profileAddressBound = 'true';
        button.addEventListener('click', async () => {
            const card = button.closest('.account-address-card');
            if (!card) return;
            const data = {
                full_name: card.dataset.fullName,
                phone: card.dataset.phone,
                address_line: card.dataset.addressLine,
                ward: card.dataset.ward,
                district: card.dataset.district,
                city: card.dataset.city,
                is_default: true
            };

            try {
                const response = await fetch(`/auth/address/${card.dataset.addressId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                const result = await response.json();
                if (!result.success) {
                    showProfileAlert(result.message || 'Không thể đặt mặc định', 'error');
                    return;
                }
                showProfileAlert('Đã đặt địa chỉ mặc định');
                window.location.hash = '#address';
                window.location.reload();
            } catch (error) {
                console.error('Address default error:', error);
                showProfileAlert('Lỗi kết nối server', 'error');
            }
        });
    });
}

// Khởi tạo cài đặt thông báo.
function initNotificationSettings() {
    const serverBackedSettings = new Set(['email_promotions']);

    document.querySelectorAll('[data-notification-setting]').forEach((input) => {
        const settingName = input.dataset.notificationSetting;
        if (!settingName) {
            return;
        }

        if (input.disabled) {
            if (settingName.startsWith('sms_')) {
                input.checked = false;
            }
            return;
        }

        const isServerBacked = serverBackedSettings.has(settingName);
        const key = `account_notification_${input.dataset.notificationSetting}`;
        const saved = isServerBacked ? null : localStorage.getItem(key);
        if (!isServerBacked && saved !== null) {
            input.checked = saved === 'true';
        }

        input.addEventListener('change', async () => {
            const nextChecked = input.checked;

            if (!isServerBacked) {
                localStorage.setItem(key, String(nextChecked));
                showProfileAlert('Đã cập nhật cài đặt thông báo');
                return;
            }

            input.disabled = true;

            try {
                const response = await fetch('/auth/notifications', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({
                        setting: settingName,
                        enabled: nextChecked
                    })
                });
                const result = await response.json().catch(() => ({}));

                if (!response.ok || !result.success) {
                    throw new Error(result.message || 'Không thể cập nhật cài đặt thông báo');
                }

                showProfileAlert(result.message || 'Đã cập nhật cài đặt thông báo');
            } catch (error) {
                input.checked = !nextChecked;
                showProfileAlert(error.message || 'Không thể cập nhật cài đặt thông báo', 'error');
            } finally {
                input.disabled = false;
            }
        });
    });

    document.querySelectorAll('[data-profile-action="mark-notifications-read"]').forEach((button) => {
        button.addEventListener('click', () => {
            document.querySelectorAll('.account-notification-item').forEach((item) => {
                item.classList.add('is-read');
            });
            showProfileAlert('Đã đánh dấu tất cả thông báo là đã đọc');
        });
    });
}

function initDeleteAccount() {
    const modal = document.getElementById('deleteAccountModal');
    const confirmButton = document.getElementById('confirmDeleteAccountBtn');
    if (!modal || !confirmButton) return;

    const openModal = () => {
        modal.hidden = false;
        document.body.classList.add('account-modal-open');
    };

    const closeModal = () => {
        modal.hidden = true;
        document.body.classList.remove('account-modal-open');
    };

    document.querySelectorAll('[data-profile-action="open-delete-account"]').forEach((button) => {
        button.addEventListener('click', openModal);
    });

    document.querySelectorAll('[data-profile-action="close-delete-account"]').forEach((button) => {
        button.addEventListener('click', closeModal);
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !modal.hidden) {
            closeModal();
        }
    });

    confirmButton.addEventListener('click', async () => {
        const originalText = confirmButton.textContent;
        confirmButton.disabled = true;
        confirmButton.textContent = 'Đang xử lý...';

        try {
            const response = await fetch('/auth/account/delete', {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });
            const result = await response.json();
            if (!result.success) {
                showProfileAlert(result.message || 'Không thể xóa tài khoản', 'error');
                return;
            }

            showProfileAlert(result.message, 'success');
            window.setTimeout(() => {
                window.location.href = result.redirect || '/auth/login';
            }, 700);
        } catch (error) {
            console.error('Delete account error:', error);
            showProfileAlert('Lỗi kết nối server', 'error');
        } finally {
            confirmButton.disabled = false;
            confirmButton.textContent = originalText;
        }
    });
}

document.addEventListener('DOMContentLoaded', function() {
    initAccountTabs();
    initAvatarUpload();
    initProfileEditorActions();
    initProfileForm();
    initPasswordForm();
    initAccountAddressForm();
    initAccountAddressListActions();
    initNotificationSettings();
    initDeleteAccount();

    document.querySelectorAll('.password-toggle').forEach((button) => {
        button.addEventListener('click', () => togglePassword(button));
    });

    document.querySelectorAll('[data-profile-action="focus-phone"]').forEach((button) => {
        button.addEventListener('click', focusPhoneInput);
    });
});
