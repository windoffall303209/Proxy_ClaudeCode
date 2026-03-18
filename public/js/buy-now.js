let currentDiscount = 0;
let buyNowRuntimeData = null;

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

async function applyVoucher() {
    const codeInput = document.getElementById('voucherCode');
    const code = codeInput?.value.trim();

    if (!code) {
        setBuyNowVoucherMessage('Vui lòng nhập mã giảm giá', 'error');
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
            currentDiscount = 0;
            setBuyNowVoucherMessage(result.message || 'Mã giảm giá không hợp lệ', 'error');
            updateTotals();
            return;
        }

        currentDiscount = result.discount_amount || 0;
        setBuyNowVoucherMessage(
            `${result.message} - Giảm ${currentDiscount.toLocaleString('vi-VN')}đ`,
            'success'
        );
    } catch (error) {
        console.error('Buy now voucher validation error:', error);
        currentDiscount = 0;
        setBuyNowVoucherMessage('Có lỗi xảy ra khi kiểm tra voucher', 'error');
    }

    updateTotals();
}

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

    const total = subtotal + shippingFee - currentDiscount;
    document.getElementById('totalAmount').textContent = `${total.toLocaleString('vi-VN')}đ`;
}

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

    document.getElementById('voucherCode')?.addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            applyVoucher();
        }
    });

    document.querySelectorAll('[data-checkout-action="apply-voucher"]').forEach((button) => {
        button.addEventListener('click', applyVoucher);
    });

    const discountRow = document.getElementById('discountRow');
    if (discountRow) {
        discountRow.style.display = 'none';
    }
}

document.addEventListener('DOMContentLoaded', initBuyNow);
