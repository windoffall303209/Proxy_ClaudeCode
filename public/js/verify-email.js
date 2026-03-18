/**
 * Verify Email Page JavaScript
 * Handles email verification code input and submission
 */

document.addEventListener('DOMContentLoaded', function() {
    const alertContainer = document.getElementById('alert-container');
    const stepSend = document.getElementById('step-send');
    const stepVerify = document.getElementById('step-verify');
    const btnSendCode = document.getElementById('btn-send-code');
    const btnResend = document.getElementById('btn-resend');
    const btnVerify = document.getElementById('btn-verify');
    const verifyForm = document.getElementById('verify-form');
    const codeInputs = document.querySelectorAll('.code-input');
    const fullCodeInput = document.getElementById('full-code');
    const timerText = document.getElementById('timer-text');

    let resendTimer = 0;

    // Show alert
    function showAlert(message, type) {
        alertContainer.innerHTML = `
            <div class="alert alert-${type}">
                ${type === 'success' ? '✅' : '❌'} ${message}
            </div>
        `;
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

    // Send verification code
    async function sendCode() {
        btnSendCode.disabled = true;
        btnSendCode.textContent = 'Đang gửi...';

        try {
            const response = await fetch('/auth/send-verification', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            const data = await response.json();

            if (data.success) {
                showAlert(data.message, 'success');
                stepSend.style.display = 'none';
                stepVerify.style.display = 'block';
                codeInputs[0].focus();
                startResendTimer();
            } else {
                showAlert(data.message, 'error');
                btnSendCode.disabled = false;
                btnSendCode.textContent = 'Gửi mã xác nhận';
            }
        } catch (error) {
            showAlert('Đã xảy ra lỗi. Vui lòng thử lại.', 'error');
            btnSendCode.disabled = false;
            btnSendCode.textContent = 'Gửi mã xác nhận';
        }
    }

    // Handle code input
    codeInputs.forEach((input, index) => {
        input.addEventListener('input', (e) => {
            const value = e.target.value;

            // Only allow numbers
            e.target.value = value.replace(/[^0-9]/g, '');

            if (e.target.value) {
                e.target.classList.add('filled');
                // Move to next input
                if (index < 5) {
                    codeInputs[index + 1].focus();
                }
            } else {
                e.target.classList.remove('filled');
            }

            // Update full code
            updateFullCode();
        });

        input.addEventListener('keydown', (e) => {
            // Handle backspace
            if (e.key === 'Backspace' && !e.target.value && index > 0) {
                codeInputs[index - 1].focus();
            }
        });

        // Handle paste
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

    function updateFullCode() {
        const code = Array.from(codeInputs).map(input => input.value).join('');
        fullCodeInput.value = code;
    }

    // Verify code
    verifyForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const code = fullCodeInput.value;

        if (code.length !== 6) {
            showAlert('Vui lòng nhập đầy đủ mã 6 số', 'error');
            return;
        }

        btnVerify.disabled = true;
        btnVerify.textContent = 'Đang xác nhận...';

        try {
            const response = await fetch('/auth/verify-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code })
            });

            const data = await response.json();

            if (data.success) {
                showAlert(data.message, 'success');
                // Redirect after 2 seconds
                setTimeout(() => {
                    window.location.href = '/auth/profile';
                }, 2000);
            } else {
                showAlert(data.message, 'error');
                // Mark inputs as error
                codeInputs.forEach(input => input.classList.add('error'));
                btnVerify.disabled = false;
                btnVerify.textContent = 'Xác nhận';
            }
        } catch (error) {
            showAlert('Đã xảy ra lỗi. Vui lòng thử lại.', 'error');
            btnVerify.disabled = false;
            btnVerify.textContent = 'Xác nhận';
        }
    });

    // Send code button
    btnSendCode.addEventListener('click', sendCode);

    // Resend button
    btnResend.addEventListener('click', async () => {
        btnResend.disabled = true;

        try {
            const response = await fetch('/auth/send-verification', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            const data = await response.json();

            if (data.success) {
                showAlert(data.message, 'success');
                // Clear inputs
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
});
