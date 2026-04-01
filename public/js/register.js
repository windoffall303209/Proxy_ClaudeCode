function togglePassword(inputId, button) {
    const input = document.getElementById(inputId);
    if (!input || !button) {
        return;
    }
    const eyeOpen = button.querySelector('.eye-open');
    const eyeClosed = button.querySelector('.eye-closed');

    if (input.type === 'password') {
        input.type = 'text';
        if (eyeOpen) eyeOpen.hidden = true;
        if (eyeClosed) eyeClosed.hidden = false;
    } else {
        input.type = 'password';
        if (eyeOpen) eyeOpen.hidden = false;
        if (eyeClosed) eyeClosed.hidden = true;
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('registerForm');
    const fullName = document.getElementById('full_name');
    const email = document.getElementById('email');
    const phone = document.getElementById('phone');
    const password = document.getElementById('password');
    const confirmPassword = document.getElementById('confirm_password');
    const passwordMatch = document.getElementById('passwordMatch');
    const submitBtn = form.querySelector('button[type="submit"]');

    // =========================================================================
    // INPUT FILTERS — chặn ký tự không hợp lệ ngay khi gõ
    // =========================================================================

    // Họ tên: chỉ cho phép chữ cái (Unicode) và khoảng trắng
    fullName.addEventListener('input', function() {
        this.value = this.value.replace(/[^\p{L}\s]/gu, '');
    });

    // Số điện thoại: chỉ cho phép nhập số
    phone.addEventListener('input', function() {
        this.value = this.value.replace(/[^0-9]/g, '');
    });

    // =========================================================================
    // VALIDATION HELPERS
    // =========================================================================

    function showError(fieldId, message) {
        const el = document.getElementById(fieldId + '_error');
        if (el) {
            el.textContent = message;
            el.style.display = message ? 'block' : 'none';
        }
    }

    function clearError(fieldId) {
        showError(fieldId, '');
    }

    // =========================================================================
    // FIELD VALIDATORS
    // =========================================================================

    function validateFullName() {
        const val = fullName.value.trim();
        if (!val) {
            showError('full_name', 'Họ và tên là bắt buộc');
            return false;
        }
        if (val.length < 2) {
            showError('full_name', 'Họ và tên phải có ít nhất 2 ký tự');
            return false;
        }
        if (val.length > 100) {
            showError('full_name', 'Họ và tên không được vượt quá 100 ký tự');
            return false;
        }
        if (!/^[\p{L}\s]+$/u.test(val)) {
            showError('full_name', 'Họ và tên chỉ được chứa chữ cái và khoảng trắng');
            return false;
        }
        clearError('full_name');
        return true;
    }

    function validateEmail() {
        const val = email.value.trim();
        if (!val) {
            showError('email', 'Email là bắt buộc');
            return false;
        }
        if (val.length > 255) {
            showError('email', 'Email không được vượt quá 255 ký tự');
            return false;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
            showError('email', 'Email không đúng định dạng');
            return false;
        }
        clearError('email');
        return true;
    }

    function validatePhone() {
        const val = phone.value.trim();
        if (!val) {
            clearError('phone');
            return true; // Không bắt buộc
        }
        if (!/^(0[2-9])\d{8}$/.test(val)) {
            showError('phone', 'Số điện thoại không hợp lệ (VD: 0912345678)');
            return false;
        }
        clearError('phone');
        return true;
    }

    function validatePassword() {
        const val = password.value;
        if (!val) {
            showError('password', 'Mật khẩu là bắt buộc');
            return false;
        }
        if (val.length < 6) {
            showError('password', 'Mật khẩu phải có ít nhất 6 ký tự');
            return false;
        }
        if (val.length > 50) {
            showError('password', 'Mật khẩu không được vượt quá 50 ký tự');
            return false;
        }
        const missing = [];
        if (!/[A-Z]/.test(val)) missing.push('1 chữ hoa');
        if (!/[a-z]/.test(val)) missing.push('1 chữ thường');
        if (!/[0-9]/.test(val)) missing.push('1 chữ số');
        if (missing.length > 0) {
            showError('password', 'Mật khẩu cần có ít nhất: ' + missing.join(', '));
            return false;
        }
        clearError('password');
        return true;
    }

    function validateConfirmPassword() {
        if (!confirmPassword.value) {
            showError('confirm_password', 'Xác nhận mật khẩu là bắt buộc');
            passwordMatch.textContent = '';
            passwordMatch.className = 'password-match';
            return false;
        }
        if (password.value !== confirmPassword.value) {
            showError('confirm_password', '');
            passwordMatch.textContent = 'Mật khẩu không khớp';
            passwordMatch.className = 'password-match error';
            return false;
        }
        clearError('confirm_password');
        passwordMatch.textContent = 'Mật khẩu khớp';
        passwordMatch.className = 'password-match success';
        return true;
    }

    // =========================================================================
    // EVENT LISTENERS — validate on blur (khi rời khỏi trường)
    // =========================================================================

    fullName.addEventListener('blur', validateFullName);
    email.addEventListener('blur', validateEmail);
    phone.addEventListener('blur', validatePhone);
    password.addEventListener('blur', validatePassword);
    confirmPassword.addEventListener('blur', validateConfirmPassword);

    // Live feedback cho password match khi đang gõ
    password.addEventListener('input', function() {
        if (confirmPassword.value) validateConfirmPassword();
    });
    confirmPassword.addEventListener('input', validateConfirmPassword);

    // =========================================================================
    // PASSWORD TOGGLE
    // =========================================================================

    document.querySelectorAll('[data-password-target]').forEach(function(button) {
        button.addEventListener('click', function() {
            togglePassword(button.dataset.passwordTarget, button);
        });
    });

    // =========================================================================
    // FORM SUBMIT — validate tất cả trước khi gửi
    // =========================================================================

    form.addEventListener('submit', function(e) {
        const isNameValid = validateFullName();
        const isEmailValid = validateEmail();
        const isPhoneValid = validatePhone();
        const isPasswordValid = validatePassword();
        const isConfirmValid = validateConfirmPassword();

        if (!isNameValid || !isEmailValid || !isPhoneValid || !isPasswordValid || !isConfirmValid) {
            e.preventDefault();

            // Scroll tới lỗi đầu tiên
            const firstError = form.querySelector('.field-error[style*="block"]');
            if (firstError) {
                firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    });
});
