function togglePassword(inputId, btn) {
    const input = document.getElementById(inputId);
    const eyeOpen = btn.querySelector('.eye-open');
    const eyeClosed = btn.querySelector('.eye-closed');

    if (input.type === 'password') {
        input.type = 'text';
        eyeOpen.style.display = 'none';
        eyeClosed.style.display = 'block';
    } else {
        input.type = 'password';
        eyeOpen.style.display = 'block';
        eyeClosed.style.display = 'none';
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

    document.getElementById('registerForm').addEventListener('submit', function(e) {
        if (password.value !== confirmPassword.value) {
            e.preventDefault();
            showGlobalToast('Mật khẩu xác nhận không khớp!', 'error');
            confirmPassword.focus();
        }
    });
});
