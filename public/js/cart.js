// Điều phối tương tác trình duyệt cho giỏ hàng, tách khỏi template EJS.
const quantityRequestState = new Map();

function readCartPricingConfig() {
    const fallback = {
        freeShippingMinAmount: 500000,
        shippingFeeAmount: 30000
    };
    const element = document.getElementById('cartPricingConfig');
    if (!element) return fallback;

    try {
        const parsed = JSON.parse(element.textContent || '{}');
        return {
            freeShippingMinAmount: Number.isFinite(Number(parsed.freeShippingMinAmount))
                ? Math.max(0, Number(parsed.freeShippingMinAmount))
                : fallback.freeShippingMinAmount,
            shippingFeeAmount: Number.isFinite(Number(parsed.shippingFeeAmount))
                ? Math.max(0, Number(parsed.shippingFeeAmount))
                : fallback.shippingFeeAmount
        };
    } catch (error) {
        return fallback;
    }
}

// Bật/tắt select tất cả.
function toggleSelectAll() {
    const selectAll = document.getElementById('selectAll');
    const checkboxes = document.querySelectorAll('.item-checkbox');
    checkboxes.forEach((cb) => {
        cb.checked = selectAll.checked;
    });
    updateSelectedTotal();
}

// Cập nhật selected tổng tiền.
function updateSelectedTotal() {
    const checkboxes = document.querySelectorAll('.item-checkbox:checked');
    let total = 0;
    let count = 0;

    checkboxes.forEach((cb) => {
        total += parseInt(cb.dataset.price, 10) || 0;
        count++;
    });

    const pricingConfig = readCartPricingConfig();
    const shippingFee = total >= pricingConfig.freeShippingMinAmount ? 0 : pricingConfig.shippingFeeAmount;
    const grandTotal = total + shippingFee;

    document.getElementById('selectedCount').textContent = count;
    document.getElementById('selectedSubtotal').textContent = total.toLocaleString('vi-VN') + 'đ';
    document.getElementById('shippingFee').textContent = shippingFee === 0 ? 'Miễn phí' : shippingFee.toLocaleString('vi-VN') + 'đ';
    document.getElementById('selectedTotal').textContent = grandTotal.toLocaleString('vi-VN') + 'đ';
    document.getElementById('checkoutCount').textContent = count;

    const checkoutBtn = document.getElementById('checkoutBtn');
    checkoutBtn.disabled = count === 0;
    checkoutBtn.classList.toggle('is-disabled', count === 0);

    const allCheckboxes = document.querySelectorAll('.item-checkbox');
    document.getElementById('selectAll').checked = checkboxes.length === allCheckboxes.length && allCheckboxes.length > 0;
}

// Xử lý checkout selected.
function checkoutSelected() {
    const checkboxes = document.querySelectorAll('.item-checkbox:checked');
    if (checkboxes.length === 0) {
        showNotification('Vui lòng chọn ít nhất một sản phẩm để thanh toán', 'error');
        return;
    }

    const selectedIds = Array.from(checkboxes).map((cb) => cb.value);
    sessionStorage.setItem('selectedCartItems', JSON.stringify(selectedIds));
    window.location.href = '/orders/checkout?items=' + selectedIds.join(',');
}

// Xử lý show notification.
function showNotification(message, type = 'success') {
    if (typeof showGlobalToast === 'function') {
        showGlobalToast(message, type);
    }
}

// Chuẩn hóa quantity input value.
function normalizeQuantityInputValue(value) {
    const digitsOnly = String(value ?? '').replace(/[^\d]/g, '');

    if (!digitsOnly) {
        return '';
    }

    return String(Number.parseInt(digitsOnly, 10) || 0);
}

// Lấy quantity input.
function getQuantityInput(cartItem) {
    return cartItem?.querySelector('.cart-item__qty-input') || null;
}

// Lấy stored quantity.
function getStoredQuantity(input) {
    const quantity = Number.parseInt(input?.dataset.currentQuantity || input?.value, 10);
    return Number.isInteger(quantity) && quantity > 0 ? quantity : 1;
}

// Xử lý reset quantity input.
function resetQuantityInput(input) {
    if (!input) return;
    input.value = String(getStoredQuantity(input));
}

// Xử lý set quantity controls disabled.
function setQuantityControlsDisabled(cartItem, disabled) {
    if (!cartItem) return;

    cartItem.querySelectorAll('.cart-item__qty-btn').forEach((button) => {
        button.disabled = disabled;
    });

    const input = getQuantityInput(cartItem);
    if (input) {
        input.disabled = disabled;
    }
}

// Xử lý commit quantity input.
function commitQuantityInput(input) {
    if (!input) return;

    const itemId = Number(input.dataset.itemId);
    if (!itemId) {
        resetQuantityInput(input);
        return;
    }

    const previousQuantity = getStoredQuantity(input);
    const normalizedValue = normalizeQuantityInputValue(input.value);

    if (!normalizedValue) {
        input.value = String(previousQuantity);
        return;
    }

    const nextQuantity = Math.max(1, Number.parseInt(normalizedValue, 10));
    input.value = String(nextQuantity);

    if (nextQuantity === previousQuantity) {
        return;
    }

    updateQuantity(itemId, nextQuantity, {
        allowRemoval: false,
        sourceInput: input,
        previousQuantity
    });
}

// Cập nhật quantity.
function updateQuantity(itemId, newQuantity, options = {}) {
    const { allowRemoval = true, sourceInput = null, previousQuantity = null } = options;
    const normalizedQuantity = Number.parseInt(newQuantity, 10);

    if (!Number.isInteger(normalizedQuantity)) {
        if (sourceInput) {
            sourceInput.value = String(previousQuantity ?? getStoredQuantity(sourceInput));
        }
        return;
    }

    if (normalizedQuantity < 1) {
        if (!allowRemoval) {
            if (sourceInput) {
                sourceInput.value = String(previousQuantity ?? getStoredQuantity(sourceInput));
            }
            return;
        }

        removeItem(itemId);
        return;
    }

    const cartItem = document.querySelector(`.cart-item[data-item-id="${itemId}"]`);
    if (!cartItem || quantityRequestState.has(itemId)) return;

    quantityRequestState.set(itemId, normalizedQuantity);
    setQuantityControlsDisabled(cartItem, true);

    fetch('/cart/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ cart_item_id: itemId, quantity: normalizedQuantity })
    })
        .then((res) => res.json())
        .then((data) => {
            if (data.success) {
                updateCartItemUI(itemId, normalizedQuantity, data.item);
                updateCartCount();
            } else {
                if (sourceInput) {
                    sourceInput.value = String(previousQuantity ?? getStoredQuantity(sourceInput));
                }
                showNotification(data.message || 'Có lỗi xảy ra', 'error');
            }
        })
        .catch((err) => {
            console.error(err);
            if (sourceInput) {
                sourceInput.value = String(previousQuantity ?? getStoredQuantity(sourceInput));
            }
            showNotification('Có lỗi xảy ra', 'error');
        })
        .finally(() => {
            quantityRequestState.delete(itemId);
            setQuantityControlsDisabled(cartItem, false);
        });
}

// Cập nhật giỏ hàng item ui.
function updateCartItemUI(itemId, newQuantity, itemData) {
    const cartItem = document.querySelector(`.cart-item[data-item-id="${itemId}"]`);
    if (!cartItem) return;

    const unitPriceEl = cartItem.querySelector('.cart-item__unit-price');
    const unitPriceText = unitPriceEl.textContent.replace(/[^\d]/g, '');
    const unitPrice = parseInt(unitPriceText, 10) || 0;
    const newSubtotal = itemData?.subtotal || (unitPrice * newQuantity);

    const qtyInput = cartItem.querySelector('.cart-item__qty-input');
    qtyInput.value = String(newQuantity);
    qtyInput.dataset.currentQuantity = String(newQuantity);

    const quantityButtons = cartItem.querySelectorAll('.cart-item__qty-btn');
    const minusBtn = quantityButtons[0];
    const plusBtn = quantityButtons[1];
    if (minusBtn) {
        minusBtn.dataset.nextQuantity = String(newQuantity - 1);
    }
    if (plusBtn) {
        plusBtn.dataset.nextQuantity = String(newQuantity + 1);
    }

    const subtotalEl = cartItem.querySelector('.cart-item__subtotal-price');
    subtotalEl.textContent = newSubtotal.toLocaleString('vi-VN') + 'đ';

    cartItem.dataset.price = newSubtotal;
    const checkbox = cartItem.querySelector('.item-checkbox');
    if (checkbox) {
        checkbox.dataset.price = newSubtotal;
    }

    updateSelectedTotal();
}

// Xóa item.
async function removeItem(itemId) {
    const confirmed = await window.showGlobalConfirm({
        title: 'Xóa sản phẩm',
        message: 'Bạn có chắc muốn xóa sản phẩm này khỏi giỏ hàng không?',
        confirmText: 'Xóa sản phẩm',
        cancelText: 'Giữ lại',
        tone: 'danger'
    });

    if (!confirmed) return;

    const cartItem = document.querySelector(`.cart-item[data-item-id="${itemId}"]`);
    if (!cartItem) return;

    cartItem.style.opacity = '0.5';
    cartItem.style.pointerEvents = 'none';

    fetch('/cart/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ cart_item_id: itemId })
    })
        .then((res) => res.json())
        .then((data) => {
            if (data.success) {
                cartItem.style.transition = 'all 0.3s ease';
                cartItem.style.transform = 'translateX(-100%)';
                cartItem.style.opacity = '0';
                cartItem.style.height = cartItem.offsetHeight + 'px';

                setTimeout(() => {
                    cartItem.style.height = '0';
                    cartItem.style.padding = '0';
                    cartItem.style.margin = '0';
                    cartItem.style.overflow = 'hidden';
                }, 200);

                setTimeout(() => {
                    cartItem.remove();
                    updateCartCount();
                    updateSelectedTotal();
                    updateSelectAllText();
                    checkEmptyCart();
                    showNotification('Đã xóa sản phẩm');
                }, 400);
            } else {
                cartItem.style.opacity = '1';
                cartItem.style.pointerEvents = 'auto';
                showNotification(data.message || 'Có lỗi xảy ra', 'error');
            }
        })
        .catch((err) => {
            console.error(err);
            cartItem.style.opacity = '1';
            cartItem.style.pointerEvents = 'auto';
            showNotification('Có lỗi xảy ra', 'error');
        });
}

// Cập nhật giỏ hàng count.
function updateCartCount() {
    fetch('/cart/count', {
        method: 'GET',
        credentials: 'same-origin'
    })
        .then((res) => res.json())
        .then((data) => {
            const cartCountEl = document.getElementById('cart-count');
            if (cartCountEl) {
                cartCountEl.textContent = data.count || 0;
            }
        })
        .catch((err) => console.error(err));
}

// Cập nhật select tất cả text.
function updateSelectAllText() {
    const items = document.querySelectorAll('.cart-item');
    const selectAllText = document.querySelector('.cart-select-all__text');
    if (selectAllText) {
        selectAllText.textContent = `Chọn tất cả (${items.length} sản phẩm)`;
    }
}

// Xử lý check empty giỏ hàng.
function checkEmptyCart() {
    const items = document.querySelectorAll('.cart-item');
    if (items.length === 0) {
        const cartGrid = document.querySelector('.cart-grid');
        if (cartGrid) {
            cartGrid.innerHTML = `
                <div class="cart-empty" style="grid-column: 1 / -1;">
                    <h2 class="cart-empty__title">Giỏ hàng trống</h2>
                    <p class="cart-empty__text">Thêm sản phẩm vào giỏ hàng để tiếp tục mua sắm.</p>
                    <a href="/products" class="cart-empty__btn">Tiếp tục mua sắm</a>
                </div>
            `;
        }
    }
}
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('selectAll')?.addEventListener('change', toggleSelectAll);

    document.querySelectorAll('.item-checkbox').forEach((checkbox) => {
        checkbox.addEventListener('change', updateSelectedTotal);
    });
    document.addEventListener('click', (event) => {
        const quantityButton = event.target.closest('[data-cart-action="update-quantity"]');
        if (quantityButton) {
            const itemId = Number(quantityButton.dataset.itemId);
            const nextQuantity = Number(quantityButton.dataset.nextQuantity);
            if (itemId) {
                updateQuantity(itemId, nextQuantity, { allowRemoval: true });
            }
            return;
        }

        const removeButton = event.target.closest('[data-cart-action="remove-item"]');
        if (removeButton) {
            const itemId = Number(removeButton.dataset.itemId);
            if (itemId) {
                removeItem(itemId);
            }
            return;
        }

        const checkoutButton = event.target.closest('[data-cart-action="checkout-selected"]');
        if (checkoutButton) {
            checkoutSelected();
        }
    });
    document.addEventListener('focusin', (event) => {
        const quantityInput = event.target.closest('.cart-item__qty-input');
        if (!quantityInput) {
            return;
        }

        requestAnimationFrame(() => quantityInput.select());
    });
    document.addEventListener('input', (event) => {
        const quantityInput = event.target.closest('.cart-item__qty-input');
        if (!quantityInput) {
            return;
        }

        const normalizedValue = normalizeQuantityInputValue(quantityInput.value);
        quantityInput.value = normalizedValue === '0' ? '' : normalizedValue;
    });
    document.addEventListener('keydown', (event) => {
        const quantityInput = event.target.closest('.cart-item__qty-input');
        if (!quantityInput || event.key !== 'Enter') {
            return;
        }

        event.preventDefault();
        commitQuantityInput(quantityInput);
        quantityInput.blur();
    });
    document.addEventListener('blur', (event) => {
        const quantityInput = event.target.closest('.cart-item__qty-input');
        if (!quantityInput) {
            return;
        }

        commitQuantityInput(quantityInput);
    }, true);

    updateSelectedTotal();
});
