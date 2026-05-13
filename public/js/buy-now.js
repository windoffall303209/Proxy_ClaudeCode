// Điều phối tương tác trình duyệt cho buy now, tách khỏi template EJS.
let currentDiscount = 0;
let buyNowRuntimeData = null;

// Xử lý read buy now bootstrap dữ liệu.
function readBuyNowBootstrapData() {
    if (buyNowRuntimeData) {
        return buyNowRuntimeData;
    }

    const bootstrapElement = document.getElementById('checkoutBootstrapData');
    if (!bootstrapElement?.textContent) {
        buyNowRuntimeData = {};
        return buyNowRuntimeData;
    }

    try {
        buyNowRuntimeData = JSON.parse(bootstrapElement.textContent);
    } catch (error) {
        console.error('Buy now bootstrap parse error:', error);
        buyNowRuntimeData = {};
    }

    return buyNowRuntimeData;
}

// Xử lý set buy now mã giảm giá tin nhắn.
function setBuyNowVoucherMessage(message, type = '') {
    const messageElement = document.getElementById('voucherMessage');
    if (!messageElement) {
        return;
    }

    messageElement.textContent = message || '';
    if (type) {
        messageElement.dataset.state = type;
    } else {
        delete messageElement.dataset.state;
    }
}

// Lấy buy now mã giảm giá elements.
function getBuyNowVoucherElements() {
    return {
        codeInput: document.getElementById('voucherCode'),
        appliedInput: document.getElementById('appliedVoucherCode'),
        clearButton: document.querySelector('[data-checkout-action="clear-voucher"]')
    };
}

// Đồng bộ buy now mã giảm giá clear button.
function syncBuyNowVoucherClearButton() {
    const { codeInput, appliedInput, clearButton } = getBuyNowVoucherElements();
    if (!clearButton) {
        return;
    }

    clearButton.hidden = !((codeInput?.value || '').trim() || (appliedInput?.value || '').trim());
}

// Xử lý set buy now applied mã giảm giá code.
function setBuyNowAppliedVoucherCode(code) {
    const { appliedInput } = getBuyNowVoucherElements();
    if (appliedInput) {
        appliedInput.value = code || '';
    }
    syncBuyNowVoucherClearButton();
}

// Xử lý clear buy now mã giảm giá.
function clearBuyNowVoucher({ clearCode = true, message = '', type = '' } = {}) {
    const { codeInput, appliedInput } = getBuyNowVoucherElements();

    if (clearCode && codeInput) {
        codeInput.value = '';
    }

    if (appliedInput) {
        appliedInput.value = '';
    }

    currentDiscount = 0;
    document.querySelectorAll('.voucher-card').forEach((card) => {
        card.classList.remove('voucher-card--selected');
    });
    updateTotals();
    setBuyNowVoucherMessage(message, type);
    syncBuyNowVoucherClearButton();
}

// Xử lý apply mã giảm giá.
async function applyVoucher() {
    const codeInput = document.getElementById('voucherCode');
    const code = codeInput?.value.trim();

    if (!code) {
        clearBuyNowVoucher({ clearCode: false, message: 'Vui lòng nhập mã giảm giá', type: 'error' });
        return;
    }

    const data = readBuyNowBootstrapData();

    try {
        const response = await fetch('/orders/validate-voucher', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({
                code,
                order_amount: data.subtotal,
                mode: 'buy-now',
                product_id: data.productId,
                quantity: data.quantity,
                variant_id: data.variantId || null
            })
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            clearBuyNowVoucher({
                clearCode: false,
                message: result.message || 'Mã giảm giá không hợp lệ',
                type: 'error'
            });
            return;
        }

        currentDiscount = result.discount_amount || 0;
        setBuyNowAppliedVoucherCode(code);
        setBuyNowVoucherMessage(
            `${result.message} - Giảm ${currentDiscount.toLocaleString('vi-VN')}đ`,
            'success'
        );
    } catch (error) {
        console.error('Buy now voucher validation error:', error);
        clearBuyNowVoucher({ clearCode: false, message: 'Có lỗi xảy ra khi kiểm tra voucher', type: 'error' });
        return;
    }

    updateTotals();
    syncBuyNowVoucherClearButton();
}

// Xử lý select buy now mã giảm giá.
function selectBuyNowVoucher(card) {
    document.querySelectorAll('.voucher-card').forEach((voucherCard) => {
        voucherCard.classList.remove('voucher-card--selected');
    });
    card.classList.add('voucher-card--selected');

    const codeInput = document.getElementById('voucherCode');
    if (codeInput) {
        codeInput.value = card.dataset.code || '';
    }
    applyVoucher();
}

// Cập nhật totals.
function updateTotals() {
    const data = readBuyNowBootstrapData();
    const subtotal = data.subtotal || 0;
    const shippingFee = data.shippingFee || 0;

    document.getElementById('discountInput').value = currentDiscount;
    document.getElementById('discountAmount').textContent = `-${currentDiscount.toLocaleString('vi-VN')}đ`;

    const discountRow = document.getElementById('discountRow');
    if (discountRow) {
        discountRow.style.display = currentDiscount > 0 ? 'flex' : 'none';
    }

    const total = Math.max(0, subtotal + shippingFee - currentDiscount);
    document.getElementById('totalAmount').textContent = `${total.toLocaleString('vi-VN')}đ`;
}

// Khởi tạo buy now.
function initBuyNow() {
    readBuyNowBootstrapData();

    document.querySelectorAll('input[name="payment_method"]').forEach((radio) => {
        radio.addEventListener('change', function() {
            document.querySelectorAll('.payment-option').forEach((option) => {
                option.classList.remove('payment-option--selected');
            });
            this.closest('label')?.classList.add('payment-option--selected');
        });
    });

    document.querySelectorAll('input[name="address_id"]').forEach((radio) => {
        radio.addEventListener('change', function() {
            document.querySelectorAll('.address-card').forEach((card) => {
                card.classList.remove('address-card--selected');
            });
            this.closest('label')?.classList.add('address-card--selected');
        });
    });

    document.getElementById('buyNowForm')?.addEventListener('submit', function(event) {
        const addressSelected = document.querySelector('input[name="address_id"]:checked');
        if (!addressSelected) {
            event.preventDefault();
            showGlobalToast('Vui lòng chọn địa chỉ giao hàng', 'warning');
            return;
        }

        const button = document.getElementById('submitBtn');
        button.textContent = 'Đang xử lý...';
        button.disabled = true;
    });

    if (!window.__checkoutVoucherHandlersReady) {
        document.getElementById('voucherCode')?.addEventListener('keypress', function(event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                applyVoucher();
            }
        });

        document.querySelectorAll('[data-checkout-action="apply-voucher"]').forEach((button) => {
            button.addEventListener('click', applyVoucher);
        });

        document.querySelectorAll('[data-checkout-action="clear-voucher"]').forEach((button) => {
            button.addEventListener('click', () => {
                clearBuyNowVoucher({ message: 'Đã bỏ voucher khỏi đơn hàng.', type: 'success' });
            });
        });

        document.getElementById('voucherCode')?.addEventListener('input', () => {
            const { codeInput, appliedInput } = getBuyNowVoucherElements();
            if (!appliedInput?.value) {
                syncBuyNowVoucherClearButton();
                return;
            }

            if ((codeInput?.value || '').trim() !== appliedInput.value) {
                clearBuyNowVoucher({ clearCode: false });
            }
        });

        document.querySelectorAll('.voucher-card').forEach((card) => {
            card.addEventListener('click', () => selectBuyNowVoucher(card));
        });

        syncBuyNowVoucherClearButton();
    }

    const discountRow = document.getElementById('discountRow');
    if (discountRow) {
        discountRow.style.display = 'none';
    }
}
document.addEventListener('DOMContentLoaded', initBuyNow);
