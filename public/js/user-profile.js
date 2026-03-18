function togglePassword(button) {
    const wrapper = button.parentElement;
    const input = wrapper.querySelector('input');
    const icon = button.querySelector('.eye-icon');

    if (input.type === 'password') {
        input.type = 'text';
        icon.textContent = 'hide';
        button.classList.add('active');
    } else {
        input.type = 'password';
        icon.textContent = 'show';
        button.classList.remove('active');
    }
}

function showDevelopingAlert() {
    showGlobalToast('Tính năng này đang được phát triển. Vui lòng quay lại sau.', 'info');
}

function showProfileAlert(message, type = 'success') {
    if (typeof showGlobalToast === 'function') {
        showGlobalToast(message, type);
    }
}

function initAvatarUpload() {
    const avatarInput = document.getElementById('avatarInput');
    const avatarImage = document.getElementById('avatarImage');
    const avatarPlaceholder = document.getElementById('avatarPlaceholder');

    if (!avatarInput) return;

    avatarInput.addEventListener('change', async function(event) {
        const file = event.target.files[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            showProfileAlert('File ảnh phải nhỏ hơn 5MB', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = function(loadEvent) {
            if (avatarImage) {
                avatarImage.src = loadEvent.target.result;
                avatarImage.style.display = 'block';
            }
            if (avatarPlaceholder) {
                avatarPlaceholder.style.display = 'none';
            }
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
                showProfileAlert('Cập nhật ảnh đại diện thành công');
            } else {
                showProfileAlert(result.message || 'Lỗi upload ảnh', 'error');
            }
        } catch (error) {
            console.error('Avatar upload error:', error);
            showProfileAlert('Lỗi kết nối server', 'error');
        }
    });
}

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
                const sidebarName = document.querySelector('.profile-sidebar__name');
                if (sidebarName && data.full_name) {
                    sidebarName.textContent = data.full_name;
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

document.addEventListener('DOMContentLoaded', function() {
    initAvatarUpload();
    initProfileForm();
    initPasswordForm();
});
