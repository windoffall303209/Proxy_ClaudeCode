let addressMap = null;
let addressMarker = null;

let provincesData = [];
let districtsData = [];
let wardsData = [];

async function loadProvinces() {
    try {
        const response = await fetch('/api/provinces');
        provincesData = await response.json();

        const select = document.getElementById('newCity');
        if (!select) return;

        select.innerHTML = '<option value="">-- Chá»n Tá»‰nh/TP --</option>';
        provincesData.forEach((p) => {
            const option = document.createElement('option');
            option.value = p.code;
            option.textContent = p.name;
            option.dataset.name = p.name;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Load provinces error:', error);
    }
}

async function loadDistricts() {
    const citySelect = document.getElementById('newCity');
    const districtSelect = document.getElementById('newDistrict');
    const wardSelect = document.getElementById('newWard');

    const cityCode = citySelect.value;
    const cityName = citySelect.options[citySelect.selectedIndex]?.dataset?.name || '';
    document.getElementById('newCityName').value = cityName;

    districtSelect.innerHTML = '<option value="">-- Chá»n Quáº­n/Huyá»‡n --</option>';
    districtSelect.disabled = true;
    wardSelect.innerHTML = '<option value="">-- Chá»n PhÆ°á»ng/XÃ£ --</option>';
    wardSelect.disabled = true;
    document.getElementById('newDistrictName').value = '';
    document.getElementById('newWardName').value = '';

    if (!cityCode) return;

    try {
        const response = await fetch(`/api/provinces/${cityCode}/districts`);
        districtsData = await response.json();

        districtsData.forEach((d) => {
            const option = document.createElement('option');
            option.value = d.code;
            option.textContent = d.name;
            option.dataset.name = d.name;
            districtSelect.appendChild(option);
        });

        districtSelect.disabled = false;
    } catch (error) {
        console.error('Load districts error:', error);
    }
}

async function loadWards() {
    const districtSelect = document.getElementById('newDistrict');
    const wardSelect = document.getElementById('newWard');

    const districtCode = districtSelect.value;
    const districtName = districtSelect.options[districtSelect.selectedIndex]?.dataset?.name || '';
    document.getElementById('newDistrictName').value = districtName;

    wardSelect.innerHTML = '<option value="">-- Chá»n PhÆ°á»ng/XÃ£ --</option>';
    wardSelect.disabled = true;
    document.getElementById('newWardName').value = '';

    if (!districtCode) return;

    try {
        const response = await fetch(`/api/districts/${districtCode}/wards`);
        wardsData = await response.json();

        wardsData.forEach((w) => {
            const option = document.createElement('option');
            option.value = w.code;
            option.textContent = w.name;
            option.dataset.name = w.name;
            wardSelect.appendChild(option);
        });

        wardSelect.disabled = false;

        wardSelect.onchange = function() {
            const wardName = wardSelect.options[wardSelect.selectedIndex]?.dataset?.name || '';
            document.getElementById('newWardName').value = wardName;
        };
    } catch (error) {
        console.error('Load wards error:', error);
    }
}

function toggleAddressForm() {
    const form = document.getElementById('newAddressForm');
    const isHidden = form.style.display === 'none';
    form.style.display = isHidden ? 'block' : 'none';

    if (isHidden && !addressMap) {
        setTimeout(initAddressMap, 100);
    }
}

function initAddressMap() {
    const mapContainer = document.getElementById('addressMap');
    if (!mapContainer || addressMap) return;

    if (mapContainer.offsetWidth === 0 || mapContainer.offsetHeight === 0) {
        setTimeout(initAddressMap, 200);
        return;
    }

    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
        iconRetinaUrl: '/images/marker-icon-2x.png',
        iconUrl: '/images/marker-icon.png',
        shadowUrl: '/images/marker-shadow.png'
    });

    const defaultLat = 10.8231;
    const defaultLng = 106.6297;

    try {
        addressMap = L.map('addressMap', {
            center: [defaultLat, defaultLng],
            zoom: 13
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: 'Â© OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(addressMap);

        const locateBtn = L.control({ position: 'topleft' });
        locateBtn.onAdd = function() {
            const div = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
            div.innerHTML = '<a href="#" title="Vá»‹ trÃ­ cá»§a tÃ´i" style="display:flex;align-items:center;justify-content:center;width:34px;height:34px;background:#fff;font-size:18px;">+</a>';
            div.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                locateUser();
            };
            return div;
        };
        locateBtn.addTo(addressMap);

        setTimeout(() => {
            addressMap.invalidateSize();
        }, 100);

        addressMap.on('click', function(e) {
            const { lat, lng } = e.latlng;
            placeMarker(lat, lng);
            updateAddressFromCoords(lat, lng);
        });
    } catch (error) {
        console.error('Error initializing map:', error);
    }
}

function placeMarker(lat, lng) {
    if (addressMarker) {
        addressMarker.setLatLng([lat, lng]);
    } else {
        addressMarker = L.marker([lat, lng], { draggable: true }).addTo(addressMap);
        addressMarker.on('dragend', function(e) {
            const pos = e.target.getLatLng();
            updateAddressFromCoords(pos.lat, pos.lng);
        });
    }
}

function locateUser() {
    if (!navigator.geolocation) {
        showGlobalToast('TrÃ¬nh duyá»‡t khÃ´ng há»— trá»£ Ä‘á»‹nh vá»‹', 'warning');
        return;
    }

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const { latitude, longitude } = position.coords;
            addressMap.setView([latitude, longitude], 16);
            placeMarker(latitude, longitude);
            updateAddressFromCoords(latitude, longitude);
            addressMap.invalidateSize();
        },
        (error) => {
            console.error('Geolocation error:', error);
            showGlobalToast('KhÃ´ng thá»ƒ láº¥y vá»‹ trÃ­. Vui lÃ²ng cho phÃ©p truy cáº­p vá»‹ trÃ­.', 'error');
        },
        { enableHighAccuracy: true, timeout: 10000 }
    );
}

async function updateAddressFromCoords(lat, lng) {
    document.getElementById('newLatitude').value = lat;
    document.getElementById('newLongitude').value = lng;

    try {
        const response = await fetch(`/api/geocode/reverse?lat=${lat}&lon=${lng}`);
        const data = await response.json();

        if (data && data.address) {
            const addr = data.address;
            if (addr.road || addr.house_number) {
                const addressLine = [addr.house_number, addr.road].filter(Boolean).join(' ');
                document.getElementById('newAddressLine').value = addressLine;
            }
        }
    } catch (error) {
        console.error('Reverse geocoding error:', error);
    }
}

function selectVoucher(card) {
    document.querySelectorAll('.voucher-card').forEach((c) => {
        c.classList.remove('voucher-card--selected');
    });

    card.classList.add('voucher-card--selected');

    const code = card.dataset.code;
    document.getElementById('voucherCode').value = code;
    applyVoucher();
}

async function saveNewAddress() {
    const fullName = document.getElementById('newFullName').value;
    const phone = document.getElementById('newPhone').value;
    const addressLine = document.getElementById('newAddressLine').value;

    const ward = document.getElementById('newWardName').value ||
        document.getElementById('newWard').options[document.getElementById('newWard').selectedIndex]?.text || '';
    const district = document.getElementById('newDistrictName').value ||
        document.getElementById('newDistrict').options[document.getElementById('newDistrict').selectedIndex]?.text || '';
    const city = document.getElementById('newCityName').value ||
        document.getElementById('newCity').options[document.getElementById('newCity').selectedIndex]?.text || '';

    if (!fullName || !phone || !addressLine || !city || !district || !ward) {
        showGlobalToast('Vui lÃ²ng Ä‘iá»n Ä‘áº§y Ä‘á»§ thÃ´ng tin báº¯t buá»™c', 'warning');
        return;
    }

    try {
        const response = await fetch('/auth/address', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({
                full_name: fullName,
                phone,
                address_line: addressLine,
                ward,
                district,
                city,
                is_default: true
            })
        });

        const data = await response.json();

        if (data.success) {
            showGlobalToast('ÄÃ£ lÆ°u Ä‘á»‹a chá»‰ thÃ nh cÃ´ng!', 'success');
            location.reload();
        } else {
            showGlobalToast(data.message || 'CÃ³ lá»—i xáº£y ra', 'error');
        }
    } catch (error) {
        console.error('Save address error:', error);
        showGlobalToast('CÃ³ lá»—i xáº£y ra khi lÆ°u Ä‘á»‹a chá»‰', 'error');
    }
}

async function applyVoucher() {
    const code = document.getElementById('voucherCode').value.trim();
    const messageEl = document.getElementById('voucherMessage');
    const discountRowEl = document.getElementById('discountRow');
    const discountAmountEl = document.getElementById('discountAmount');
    const discountInput = document.getElementById('discountInput');
    const totalEl = document.getElementById('totalAmount');

    const checkoutSubtotal = window.checkoutData?.subtotal || window.buyNowData?.subtotal || 0;
    const checkoutShippingFee = window.checkoutData?.shippingFee ?? window.buyNowData?.shippingFee ?? 30000;
    const mode = window.buyNowData ? 'buy-now' : 'cart';

    let currentDiscount = 0;

    if (!code) {
        messageEl.innerHTML = '<span style="color: #f44336;">Vui lòng nhập mã giảm giá</span>';
        return;
    }

    try {
        const response = await fetch('/orders/validate-voucher', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({
                code,
                order_amount: checkoutSubtotal,
                mode
            })
        });

        const data = await response.json();

        if (data.success) {
            currentDiscount = data.discount_amount;
            messageEl.innerHTML = '<span style="color: #2e7d32;">Đã áp dụng voucher - Giảm ' + currentDiscount.toLocaleString('vi-VN') + 'đ</span>';
        } else {
            messageEl.innerHTML = '<span style="color: #f44336;">' + data.message + '</span>';
            currentDiscount = 0;
        }
    } catch (error) {
        console.error('Voucher validation error:', error);
        messageEl.innerHTML = '<span style="color: #f44336;">Có lỗi xảy ra khi kiểm tra voucher</span>';
        currentDiscount = 0;
    }

    if (currentDiscount > 0) {
        discountRowEl.style.display = 'flex';
        discountAmountEl.textContent = '-' + currentDiscount.toLocaleString('vi-VN') + 'đ';
    } else {
        discountRowEl.style.display = 'none';
    }

    discountInput.value = currentDiscount;

    const total = checkoutSubtotal + checkoutShippingFee - currentDiscount;
    totalEl.textContent = total.toLocaleString('vi-VN') + 'đ';
}

function initCheckout() {
    loadProvinces();

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

    document.getElementById('checkoutForm')?.addEventListener('submit', function(e) {
        const addressSelected = document.querySelector('input[name="address_id"]:checked');
        if (!addressSelected) {
            e.preventDefault();
            showGlobalToast('Vui lòng chọn hoặc thêm địa chỉ giao hàng', 'warning');
            return;
        }

        const btn = document.getElementById('submitBtn');
        btn.textContent = 'Đang xử lý...';
        btn.disabled = true;
    });

    document.getElementById('buyNowForm')?.addEventListener('submit', function(e) {
        const addressSelected = document.querySelector('input[name="address_id"]:checked');
        if (!addressSelected) {
            e.preventDefault();
            showGlobalToast('Vui lòng chọn hoặc thêm địa chỉ giao hàng', 'warning');
            return;
        }

        const btn = document.getElementById('submitBtn');
        btn.textContent = 'Đang xử lý...';
        btn.disabled = true;
    });

    const addressForm = document.getElementById('newAddressForm');
    if (addressForm && addressForm.style.display !== 'none') {
        setTimeout(initAddressMap, 300);
    }
}

document.addEventListener('DOMContentLoaded', initCheckout);


