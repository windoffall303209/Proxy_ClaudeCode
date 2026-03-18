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
    const password = document.getElementById('password');
    const confirmPassword = document.getElementById('confirm_password');
    const passwordMatch = document.getElementById('passwordMatch');

    function checkPasswordMatch() {
        if (confirmPassword.value === '') {
            passwordMatch.textContent = '';
            passwordMatch.className = 'password-match';
            return;
        }

        if (password.value === confirmPassword.value) {
            passwordMatch.textContent = 'Mật khẩu khớp';
            passwordMatch.className = 'password-match success';
        } else {
            passwordMatch.textContent = 'Mật khẩu không khớp';
            passwordMatch.className = 'password-match error';
        }
    }

    password.addEventListener('input', checkPasswordMatch);
    confirmPassword.addEventListener('input', checkPasswordMatch);

    document.querySelectorAll('[data-password-target]').forEach((button) => {
        button.addEventListener('click', () => {
            togglePassword(button.dataset.passwordTarget, button);
        });
    });

    document.getElementById('registerForm').addEventListener('submit', function(e) {
        if (password.value !== confirmPassword.value) {
            e.preventDefault();
            showGlobalToast('Mật khẩu xác nhận không khớp!', 'error');
            confirmPassword.focus();
        }
    });
});
