// Helper che dữ liệu nhạy cảm trước khi ghi log hoặc trả về giao diện.
function maskEmail(value) {
    const email = String(value || '').trim();
    const atIndex = email.indexOf('@');
    if (atIndex <= 0) {
        return email || 'Chưa cập nhật';
    }

    const local = email.slice(0, atIndex);
    const domain = email.slice(atIndex);
    if (local.length <= 4) {
        return `${local.slice(0, 1)}****${local.slice(-1)}${domain}`;
    }

    return `${local.slice(0, 2)}****${local.slice(-2)}${domain}`;
}

// Che số điện thoại.
function maskPhone(value) {
    const phone = String(value || '').trim();
    if (!phone) {
        return 'Chưa cập nhật';
    }

    return `${'*'.repeat(Math.max(phone.length - 2, 0))}${phone.slice(-2)}`;
}

// Chuẩn hóa ngày input.
function normalizeDateInput(value) {
    if (!value) {
        return '';
    }
    if (typeof value === 'string') {
        return value.slice(0, 10);
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return '';
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Định dạng ngày display.
function formatDateDisplay(value) {
    const dateValue = normalizeDateInput(value);
    if (!dateValue) {
        return 'Chưa cập nhật';
    }

    const [year, month, day] = dateValue.split('-');
    return `${day}/${month}/${year}`;
}

// Che ngày sinh.
function maskBirthday(value) {
    const dateValue = normalizeDateInput(value);
    return dateValue ? dateValue.slice(0, 4) : 'Chưa cập nhật';
}

// Lọc giá trị CSS trước khi nhúng raw vào <style>; chặn ký tự có thể thoát context (vd `</style>`, `;`, `{`).
function safeCssValue(value, fallback = '') {
    const raw = String(value == null ? '' : value).trim();
    if (!raw) {
        return fallback;
    }

    // Chỉ cho phép chữ, số, khoảng trắng, dấu nháy đơn/đôi, dấu phẩy, gạch ngang/gạch dưới, dấu chấm.
    if (!/^[A-Za-z0-9 _,'"\-.]+$/.test(raw)) {
        return fallback;
    }

    return raw;
}

// Lọc mã màu CSS để chỉ cho phép #hex hoặc rgb()/rgba() có cấu trúc đơn giản.
function safeCssColor(value, fallback = '') {
    const raw = String(value == null ? '' : value).trim();
    if (!raw) {
        return fallback;
    }

    if (/^#[0-9a-fA-F]{3,8}$/.test(raw)) {
        return raw;
    }

    if (/^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(?:,\s*(?:0|1|0?\.\d+))?\s*\)$/.test(raw)) {
        return raw;
    }

    return fallback;
}

module.exports = {
    formatDateDisplay,
    maskBirthday,
    maskEmail,
    maskPhone,
    normalizeDateInput,
    safeCssColor,
    safeCssValue
};
