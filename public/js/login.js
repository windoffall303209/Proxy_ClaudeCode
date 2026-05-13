// Điều phối tương tác trình duyệt cho đăng nhập, tách khỏi template EJS.
function toggleLoginPassword(inputId, button) {
    const input = document.getElementById(inputId);
    if (!input || !button) {
        return;
    }

    const eyeOpen = button.querySelector('.eye-open');
    const eyeClosed = button.querySelector('.eye-closed');
    const isHidden = input.type === 'password';

    input.type = isHidden ? 'text' : 'password';
    button.setAttribute('aria-pressed', String(isHidden));
    if (eyeOpen) eyeOpen.hidden = isHidden;
    if (eyeClosed) eyeClosed.hidden = !isHidden;
}
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-password-target]').forEach((button) => {
        button.addEventListener('click', () => {
            toggleLoginPassword(button.dataset.passwordTarget, button);
        });
    });
});
