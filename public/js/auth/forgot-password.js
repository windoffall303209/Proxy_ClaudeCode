// Điều phối tương tác trình duyệt cho xác thực quên mật khẩu mật khẩu, tách khỏi template EJS.
document.addEventListener('DOMContentLoaded', function() {
    const alertContainer = document.getElementById('alert-container');
    const stepEmail = document.getElementById('step-email');
    const stepCode = document.getElementById('step-code');
    const stepPassword = document.getElementById('step-password');
    const stepSuccess = document.getElementById('step-success');

    const emailForm = document.getElementById('email-form');
    const codeForm = document.getElementById('code-form');
    const passwordForm = document.getElementById('password-form');

    const codeInputs = document.querySelectorAll('.code-input');
    const fullCodeInput = document.getElementById('full-code');
    const displayEmail = document.getElementById('display-email');
    const btnResend = document.getElementById('btn-resend');
    const timerText = document.getElementById('timer-text');

    let userEmail = '';
    let resendTimer = 0;

    // Show alert
    function showAlert(message, type) {
        alertContainer.innerHTML = `
            <div class="alert alert-${type}">
                ${type === 'success' ? '✅' : '❌'} ${message}
            </div>
        `;
    }

    // Xử lý clear alert.
    function clearAlert() {
        alertContainer.innerHTML = '';
    }

    function initPasswordToggles() {
        document.querySelectorAll('[data-password-toggle]').forEach((button) => {
            const input = document.getElementById(button.dataset.passwordToggle);
            if (!input) {
                return;
            }

            button.addEventListener('click', () => {
                const shouldShow = input.type === 'password';
                input.type = shouldShow ? 'text' : 'password';
                button.textContent = shouldShow ? 'Ẩn' : 'Hiện';
                button.setAttribute('aria-pressed', shouldShow ? 'true' : 'false');
                button.setAttribute('aria-label', shouldShow ? 'Ẩn mật khẩu' : 'Hiện mật khẩu');
            });
        });
    }

    // Start resend timer
    function startResendTimer() {
        resendTimer = 60;
        btnResend.disabled = true;

        const interval = setInterval(() => {
            resendTimer--;
            timerText.textContent = `Có thể gửi lại sau ${resendTimer}s`;

            if (resendTimer <= 0) {
                clearInterval(interval);
                btnResend.disabled = false;
                timerText.textContent = '';
            }
        }, 1000);
    }

    // Step 1: Send reset code
    emailForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearAlert();

        const emailInput = document.getElementById('email');
        const submitBtn = document.getElementById('btn-send-code');
        userEmail = emailInput.value.trim();

        if (!userEmail) return;

        submitBtn.disabled = true;
        submitBtn.textContent = 'Đang gửi...';

        try {
            const response = await fetch('/auth/forgot-password/send-code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: userEmail })
            });

            const data = await response.json();

            if (data.success) {
                showAlert(data.message, 'success');
                displayEmail.textContent = userEmail;
                stepEmail.hidden = true;
                stepCode.hidden = false;
                codeInputs[0].focus();
                startResendTimer();
            } else {
                showAlert(data.message, 'error');
                submitBtn.disabled = false;
                submitBtn.textContent = 'Gửi mã xác nhận';
            }
        } catch (error) {
            showAlert('Đã xảy ra lỗi. Vui lòng thử lại.', 'error');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Gửi mã xác nhận';
        }
    });

    // Handle code input
    codeInputs.forEach((input, index) => {
        input.addEventListener('input', (e) => {
            const value = e.target.value;
            e.target.value = value.replace(/[^0-9]/g, '');

            if (e.target.value) {
                e.target.classList.add('filled');
                e.target.classList.remove('error');
                if (index < 5) {
                    codeInputs[index + 1].focus();
                }
            } else {
                e.target.classList.remove('filled');
            }
            updateFullCode();
        });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !e.target.value && index > 0) {
                codeInputs[index - 1].focus();
            }
        });
        input.addEventListener('paste', (e) => {
            e.preventDefault();
            const pastedData = e.clipboardData.getData('text').replace(/[^0-9]/g, '').slice(0, 6);
            pastedData.split('').forEach((char, i) => {
                if (codeInputs[i]) {
                    codeInputs[i].value = char;
                    codeInputs[i].classList.add('filled');
                }
            });
            updateFullCode();
            if (pastedData.length === 6) {
                codeInputs[5].focus();
            }
        });
    });

    // Cập nhật full code.
    function updateFullCode() {
        const code = Array.from(codeInputs).map(input => input.value).join('');
        fullCodeInput.value = code;
    }

    // Step 2: Verify code
    codeForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearAlert();

        const code = fullCodeInput.value;
        const submitBtn = document.getElementById('btn-verify-code');

        if (code.length !== 6) {
            showAlert('Vui lòng nhập đầy đủ mã 6 số', 'error');
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Đang xác nhận...';

        try {
            const response = await fetch('/auth/forgot-password/verify-code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: userEmail, code })
            });

            const data = await response.json();

            if (data.success) {
                clearAlert();
                stepCode.hidden = true;
                stepPassword.hidden = false;
            } else {
                showAlert(data.message, 'error');
                codeInputs.forEach(input => input.classList.add('error'));
                submitBtn.disabled = false;
                submitBtn.textContent = 'Xác nhận mã';
            }
        } catch (error) {
            showAlert('Đã xảy ra lỗi. Vui lòng thử lại.', 'error');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Xác nhận mã';
        }
    });

    // Step 3: Reset password
    passwordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearAlert();

        const newPassword = document.getElementById('new_password').value;
        const confirmPassword = document.getElementById('confirm_password').value;
        const code = fullCodeInput.value;
        const submitBtn = document.getElementById('btn-reset');

        if (newPassword.length < 6) {
            showAlert('Mật khẩu phải có ít nhất 6 ký tự', 'error');
            return;
        }

        if (newPassword !== confirmPassword) {
            showAlert('Xác nhận mật khẩu không khớp', 'error');
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Đang xử lý...';

        try {
            const response = await fetch('/auth/forgot-password/reset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: userEmail,
                    code,
                    new_password: newPassword,
                    confirm_password: confirmPassword
                })
            });

            const data = await response.json();

            if (data.success) {
                clearAlert();
                stepPassword.hidden = true;
                stepSuccess.hidden = false;
            } else {
                showAlert(data.message, 'error');
                submitBtn.disabled = false;
                submitBtn.textContent = 'Đặt lại mật khẩu';
            }
        } catch (error) {
            showAlert('Đã xảy ra lỗi. Vui lòng thử lại.', 'error');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Đặt lại mật khẩu';
        }
    });

    // Resend code
    btnResend.addEventListener('click', async () => {
        clearAlert();
        btnResend.disabled = true;

        try {
            const response = await fetch('/auth/forgot-password/send-code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: userEmail })
            });

            const data = await response.json();

            if (data.success) {
                showAlert(data.message, 'success');
                codeInputs.forEach(input => {
                    input.value = '';
                    input.classList.remove('filled', 'error');
                });
                codeInputs[0].focus();
                startResendTimer();
            } else {
                showAlert(data.message, 'error');
                btnResend.disabled = false;
            }
        } catch (error) {
            showAlert('Đã xảy ra lỗi. Vui lòng thử lại.', 'error');
            btnResend.disabled = false;
        }
    });

    initPasswordToggles();
});
