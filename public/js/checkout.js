let addressMap = null;
let addressMarker = null;
let locateButtonElement = null;

let provincesData = [];
let districtsData = [];
let wardsData = [];
let checkoutRuntimeData = null;
let provincesLoadPromise = null;
let reverseGeocodeRequestId = 0;
let editingAddressId = null;
const districtsCache = new Map();
const wardsCache = new Map();
const provinceDistrictTreeCache = new Map();

const PROVINCE_PLACEHOLDER = '-- Chọn Tỉnh/TP --';
const DISTRICT_PLACEHOLDER = '-- Chọn Quận/Huyện --';
const WARD_PLACEHOLDER = '-- Chọn Phường/Xã --';
const DETECTED_OPTION_PREFIX = '__detected__';
const MOJIBAKE_PATTERNS = ['Ã', 'Â', 'Æ', 'Ä', 'Å', 'áº', 'á»', 'á¼', 'á½', 'á¾', 'ï»¿'];

// ISO 3166-2:VN → provinces.open-api.vn province code
const ISO_TO_PROVINCE_CODE = {
    'VN-HN': 1,   // Hà Nội
    'VN-03': 2,   // Hà Giang
    'VN-04': 4,   // Cao Bằng
    'VN-53': 6,   // Bắc Kạn
    'VN-07': 8,   // Tuyên Quang
    'VN-02': 10,  // Lào Cai
    'VN-71': 11,  // Điện Biên
    'VN-01': 12,  // Lai Châu
    'VN-05': 14,  // Sơn La
    'VN-06': 15,  // Yên Bái
    'VN-14': 17,  // Hoà Bình
    'VN-69': 19,  // Thái Nguyên
    'VN-09': 20,  // Lạng Sơn
    'VN-13': 22,  // Quảng Ninh
    'VN-54': 24,  // Bắc Giang
    'VN-68': 25,  // Phú Thọ
    'VN-70': 26,  // Vĩnh Phúc
    'VN-56': 27,  // Bắc Ninh
    'VN-61': 30,  // Hải Dương
    'VN-HP': 31,  // Hải Phòng
    'VN-66': 33,  // Hưng Yên
    'VN-20': 34,  // Thái Bình
    'VN-63': 35,  // Hà Nam
    'VN-67': 36,  // Nam Định
    'VN-18': 37,  // Ninh Bình
    'VN-21': 38,  // Thanh Hóa
    'VN-22': 40,  // Nghệ An
    'VN-23': 42,  // Hà Tĩnh
    'VN-24': 44,  // Quảng Bình
    'VN-25': 45,  // Quảng Trị
    'VN-26': 46,  // Thừa Thiên Huế
    'VN-DN': 48,  // Đà Nẵng
    'VN-27': 49,  // Quảng Nam
    'VN-29': 51,  // Quảng Ngãi
    'VN-31': 52,  // Bình Định
    'VN-32': 54,  // Phú Yên
    'VN-34': 56,  // Khánh Hòa
    'VN-36': 58,  // Ninh Thuận
    'VN-40': 60,  // Bình Thuận
    'VN-28': 62,  // Kon Tum
    'VN-30': 64,  // Gia Lai
    'VN-33': 66,  // Đắk Lắk
    'VN-72': 67,  // Đắk Nông
    'VN-35': 68,  // Lâm Đồng
    'VN-58': 70,  // Bình Phước
    'VN-37': 72,  // Tây Ninh
    'VN-57': 74,  // Bình Dương
    'VN-39': 75,  // Đồng Nai
    'VN-43': 77,  // Bà Rịa - Vũng Tàu
    'VN-SG': 79,  // Hồ Chí Minh
    'VN-41': 80,  // Long An
    'VN-46': 82,  // Tiền Giang
    'VN-50': 83,  // Bến Tre
    'VN-51': 84,  // Trà Vinh
    'VN-49': 86,  // Vĩnh Long
    'VN-45': 87,  // Đồng Tháp
    'VN-44': 89,  // An Giang
    'VN-47': 91,  // Kiên Giang
    'VN-CT': 92,  // Cần Thơ
    'VN-73': 93,  // Hậu Giang
    'VN-52': 94,  // Sóc Trăng
    'VN-55': 95,  // Bạc Liêu
    'VN-59': 96,  // Cà Mau
};

function findProvinceByIsoCode(data) {
    const isoCode = data?.address?.['ISO3166-2-lvl4'];
    if (!isoCode) {
        return null;
    }

    const provinceCode = ISO_TO_PROVINCE_CODE[isoCode];
    if (!provinceCode) {
        return null;
    }

    return provincesData.find((p) => String(p.code) === String(provinceCode)) || null;
}

function readCheckoutBootstrapData() {
    if (checkoutRuntimeData) {
        return checkoutRuntimeData;
    }

    const bootstrapElement = document.getElementById('checkoutBootstrapData');
    if (!bootstrapElement?.textContent) {
        checkoutRuntimeData = {};
        return checkoutRuntimeData;
    }

    try {
        checkoutRuntimeData = JSON.parse(bootstrapElement.textContent);
    } catch (error) {
        console.error('Checkout bootstrap parse error:', error);
        checkoutRuntimeData = {};
    }

    return checkoutRuntimeData;
}

function getSavedAddresses() {
    const bootstrap = readCheckoutBootstrapData();
    return Array.isArray(bootstrap.addresses) ? bootstrap.addresses : [];
}

function getSavedAddressById(addressId) {
    const normalizedId = Number.parseInt(addressId, 10);
    if (!Number.isInteger(normalizedId) || normalizedId <= 0) {
        return null;
    }

    return getSavedAddresses().find((address) => Number.parseInt(address.id, 10) === normalizedId) || null;
}

function getAddressFormElement() {
    return document.getElementById('newAddressForm');
}

function closeAddressForm() {
    const form = getAddressFormElement();
    if (!form) {
        return;
    }

    form.hidden = true;
    document.body.classList.remove('address-form-open');
    setAddressFormEditingState(null);
}

function setAddressFormEditingState(address = null) {
    editingAddressId = address ? Number.parseInt(address.id, 10) : null;

    const editingAddressIdInput = document.getElementById('editingAddressId');
    const editingAddressDefaultInput = document.getElementById('editingAddressDefault');
    const formTitle = document.getElementById('addressFormTitle');
    const saveButton = document.getElementById('saveAddressBtn');
    const deleteButton = document.getElementById('deleteAddressInlineBtn');

    if (editingAddressIdInput) {
        editingAddressIdInput.value = editingAddressId || '';
    }

    if (editingAddressDefaultInput) {
        editingAddressDefaultInput.value = address ? String(Boolean(address.is_default)) : 'true';
    }

    if (formTitle) {
        formTitle.textContent = address ? 'Chỉnh sửa địa chỉ' : 'Địa chỉ mới';
    }

    if (saveButton) {
        saveButton.textContent = 'Lưu địa chỉ';
    }

    if (deleteButton) {
        deleteButton.hidden = !address;
        deleteButton.dataset.addressId = address ? String(address.id) : '';
    }
}

function resetAddressFormFields() {
    const fullNameInput = document.getElementById('newFullName');
    const phoneInput = document.getElementById('newPhone');
    const addressLineInput = document.getElementById('newAddressLine');
    const cityNameInput = document.getElementById('newCityName');
    const districtNameInput = document.getElementById('newDistrictName');
    const wardNameInput = document.getElementById('newWardName');
    const latitudeInput = document.getElementById('newLatitude');
    const longitudeInput = document.getElementById('newLongitude');
    const citySelect = document.getElementById('newCity');
    const districtSelect = document.getElementById('newDistrict');
    const wardSelect = document.getElementById('newWard');

    if (fullNameInput) fullNameInput.value = '';
    if (phoneInput) phoneInput.value = '';
    if (addressLineInput) addressLineInput.value = '';
    if (cityNameInput) cityNameInput.value = '';
    if (districtNameInput) districtNameInput.value = '';
    if (wardNameInput) wardNameInput.value = '';
    if (latitudeInput) latitudeInput.value = '';
    if (longitudeInput) longitudeInput.value = '';

    if (citySelect) {
        removeDetectedOptions(citySelect);
        citySelect.value = '';
    }

    if (districtSelect) {
        removeDetectedOptions(districtSelect);
        districtSelect.innerHTML = `<option value="">${DISTRICT_PLACEHOLDER}</option>`;
        districtSelect.disabled = true;
    }

    if (wardSelect) {
        removeDetectedOptions(wardSelect);
        wardSelect.innerHTML = `<option value="">${WARD_PLACEHOLDER}</option>`;
        wardSelect.disabled = true;
    }

    districtsData = [];
    wardsData = [];

    clearFieldError('newFullName', 'newFullNameError');
    clearFieldError('newPhone', 'newPhoneError');

    if (addressMarker && addressMap) {
        addressMap.removeLayer(addressMarker);
        addressMarker = null;
    }
}

function openAddressForm() {
    const form = getAddressFormElement();
    if (!form) {
        return;
    }

    const panel = form.querySelector('.address-form');
    const wasHidden = form.hidden;
    form.hidden = false;
    document.body.classList.add('address-form-open');
    if (panel) {
        panel.scrollTop = 0;
    }

    if (wasHidden && !addressMap) {
        setTimeout(initAddressMap, 100);
    } else if (addressMap) {
        setTimeout(() => addressMap.invalidateSize(), 100);
    }
}

async function openCreateAddressForm() {
    resetAddressFormFields();
    setAddressFormEditingState(null);
    openAddressForm();
    await loadProvinces();
    document.getElementById('newFullName')?.focus();
}

async function populateAddressAdministrativeFields(address) {
    const citySelect = document.getElementById('newCity');
    const districtSelect = document.getElementById('newDistrict');
    const wardSelect = document.getElementById('newWard');
    const cityNameInput = document.getElementById('newCityName');
    const districtNameInput = document.getElementById('newDistrictName');
    const wardNameInput = document.getElementById('newWardName');

    if (!citySelect || !districtSelect || !wardSelect || !cityNameInput || !districtNameInput || !wardNameInput) {
        return;
    }

    await loadProvinces();

    const provinceMatch = findAdministrativeMatch(provincesData, [address.city]);
    if (provinceMatch) {
        removeDetectedOptions(citySelect);
        citySelect.value = String(provinceMatch.code);
        cityNameInput.value = provinceMatch.name;
        await loadDistricts();
    } else {
        setDetectedSelection(citySelect, address.city, 'province');
        cityNameInput.value = address.city;
    }

    const districtMatch = findAdministrativeMatch(districtsData, [address.district]);
    if (districtMatch) {
        removeDetectedOptions(districtSelect);
        districtSelect.value = String(districtMatch.code);
        districtNameInput.value = districtMatch.name;
        await loadWards();
    } else if (address.district) {
        setDetectedSelection(districtSelect, address.district, 'district');
        districtNameInput.value = address.district;
    }

    const wardMatch = findAdministrativeMatch(wardsData, [address.ward]);
    if (wardMatch) {
        removeDetectedOptions(wardSelect);
        wardSelect.value = String(wardMatch.code);
        wardNameInput.value = wardMatch.name;
    } else if (address.ward) {
        setDetectedSelection(wardSelect, address.ward, 'ward');
        wardNameInput.value = address.ward;
    }
}

async function editAddress(addressId) {
    const address = getSavedAddressById(addressId);
    if (!address) {
        showGlobalToast('Không tìm thấy địa chỉ để chỉnh sửa', 'error');
        return;
    }

    resetAddressFormFields();
    setAddressFormEditingState(address);
    openAddressForm();

    document.getElementById('newFullName').value = address.full_name || '';
    document.getElementById('newPhone').value = address.phone || '';
    document.getElementById('newAddressLine').value = address.address_line || '';

    await populateAddressAdministrativeFields(address);
    document.getElementById('newFullName')?.focus();
}

function setVoucherMessage(message, type = '') {
    const messageEl = document.getElementById('voucherMessage');
    if (!messageEl) {
        return;
    }

    messageEl.textContent = message || '';
    if (type) {
        messageEl.dataset.state = type;
    } else {
        delete messageEl.dataset.state;
    }
}

function syncSelectedWardName() {
    const wardSelect = document.getElementById('newWard');
    if (!wardSelect) {
        return;
    }

    const wardName = wardSelect.options[wardSelect.selectedIndex]?.dataset?.name || '';
    document.getElementById('newWardName').value = wardName;
}

function setLocateButtonLoading(isLoading) {
    if (!locateButtonElement) {
        return;
    }

    locateButtonElement.classList.toggle('is-loading', isLoading);
    locateButtonElement.setAttribute('aria-busy', String(isLoading));
    locateButtonElement.setAttribute('aria-disabled', String(isLoading));
}

function repairMojibakeText(value) {
    const text = String(value || '').trim();
    if (!text || !MOJIBAKE_PATTERNS.some((pattern) => text.includes(pattern))) {
        return text;
    }

    try {
        const decoded = new TextDecoder('utf-8').decode(Uint8Array.from(Array.from(text, (char) => char.charCodeAt(0))));
        return decoded.includes('\uFFFD') ? text : decoded;
    } catch (error) {
        return text;
    }
}

function normalizeLocationText(value) {
    return repairMojibakeText(value)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'd')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function stripAdministrativePrefixes(value) {
    let normalized = normalizeLocationText(value);
    let previousValue = '';

    while (normalized && normalized !== previousValue) {
        previousValue = normalized;
        normalized = normalized
            .replace(/^(thanh pho|tp|tinh|quan|q|huyen|thi xa|tx|thi tran|tt|phuong|p|xa)\s+/, '')
            .trim();
    }

    return normalized;
}

function getNormalizedVariants(value) {
    const normalized = normalizeLocationText(value);
    const stripped = stripAdministrativePrefixes(value);

    return Array.from(new Set([normalized, stripped].filter(Boolean)));
}

function uniqueLocationValues(values) {
    return Array.from(
        new Set(
            values
                .map((value) => repairMojibakeText(value))
                .filter(Boolean)
        )
    );
}

function getDisplayNameParts(data) {
    if (!data?.display_name) {
        return [];
    }

    return data.display_name
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean);
}

function getProvinceCandidates(data) {
    const address = data?.address || {};

    return uniqueLocationValues([
        address.state,
        address.province,
        address.region,
        address.state_district,
        address.city,
        address.county,
        ...getDisplayNameParts(data)
    ]);
}

function getDistrictCandidates(data) {
    const address = data?.address || {};

    return uniqueLocationValues([
        address.city_district,
        address.county,
        address.district,
        address.city,
        address.town,
        address.municipality,
        address.state_district,
        ...getDisplayNameParts(data)
    ]);
}

function getWardCandidates(data) {
    const address = data?.address || {};

    return uniqueLocationValues([
        address.suburb,
        address.quarter,
        address.village,
        address.hamlet,
        address.neighbourhood,
        address.city_block,
        address.subdistrict,
        address.residential,
        ...getDisplayNameParts(data)
    ]);
}

function sanitizeAdministrativeItem(item) {
    return {
        ...item,
        name: repairMojibakeText(item?.name),
        division_type: repairMojibakeText(item?.division_type),
        codename: String(item?.codename || '').trim()
    };
}

function removeDetectedOptions(select) {
    Array.from(select?.options || []).forEach((option) => {
        if (option.dataset.detected === 'true') {
            option.remove();
        }
    });
}

function setDetectedSelection(select, label, valueKey) {
    if (!select || !label) {
        return false;
    }

    removeDetectedOptions(select);

    const option = document.createElement('option');
    option.value = `${DETECTED_OPTION_PREFIX}${valueKey}`;
    option.textContent = label;
    option.dataset.name = label;
    option.dataset.detected = 'true';
    select.appendChild(option);
    select.value = option.value;
    select.disabled = false;
    return true;
}

function getOptionMatchValues(item) {
    return uniqueLocationValues([
        item?.name,
        item?.codename?.replace(/_/g, ' ')
    ]);
}

function getMatchScore(optionValue, candidateValue) {
    const optionVariants = getNormalizedVariants(optionValue);
    const candidateVariants = getNormalizedVariants(candidateValue);
    let score = 0;

    optionVariants.forEach((optionVariant) => {
        candidateVariants.forEach((candidateVariant) => {
            if (!optionVariant || !candidateVariant) {
                return;
            }

            if (optionVariant === candidateVariant) {
                score = Math.max(score, 4);
                return;
            }

            if (optionVariant.includes(candidateVariant) || candidateVariant.includes(optionVariant)) {
                score = Math.max(score, 2);
            }
        });
    });

    return score;
}

function findAdministrativeMatchResult(items, candidates) {
    let bestMatch = null;
    let bestScore = 0;

    items.forEach((item) => {
        const optionValues = getOptionMatchValues(item);

        optionValues.forEach((optionValue) => {
            candidates.forEach((candidateValue, candidateIndex) => {
                const matchScore = getMatchScore(optionValue, candidateValue);
                if (!matchScore) {
                    return;
                }

                const weightedScore = (matchScore * 100) - candidateIndex;
                if (weightedScore > bestScore) {
                    bestScore = weightedScore;
                    bestMatch = item;
                }
            });
        });
    });

    return {
        item: bestMatch,
        score: bestScore
    };
}

function findAdministrativeMatch(items, candidates) {
    return findAdministrativeMatchResult(items, candidates).item;
}

function buildAddressLine(address) {
    return uniqueLocationValues([
        address?.house_number,
        address?.road,
        address?.pedestrian,
        address?.residential,
        address?.building,
        address?.amenity
    ]).join(' ');
}

async function ensureProvincesLoaded() {
    if (provincesData.length) {
        return provincesData;
    }

    await loadProvinces();
    return provincesData;
}

async function loadProvinceDistrictTree(provinceCode) {
    const cacheKey = String(provinceCode);
    if (provinceDistrictTreeCache.has(cacheKey)) {
        return provinceDistrictTreeCache.get(cacheKey);
    }

    const response = await fetch(`/api/provinces/${provinceCode}/districts?depth=3`);
    const districts = (await response.json()).map((district) => ({
        ...sanitizeAdministrativeItem(district),
        wards: Array.isArray(district?.wards)
            ? district.wards.map((ward) => sanitizeAdministrativeItem(ward))
            : []
    }));

    provinceDistrictTreeCache.set(cacheKey, districts);
    return districts;
}

function isSameLocationName(left, right) {
    const leftVariants = getNormalizedVariants(left);
    const rightVariants = getNormalizedVariants(right);
    return leftVariants.some((leftValue) => rightVariants.includes(leftValue));
}

function findProvinceFallbackLabel(data) {
    const address = data?.address || {};
    const directMatch = uniqueLocationValues([
        address.state,
        address.province,
        address.region
    ])[0];

    if (directMatch) {
        return directMatch;
    }

    const displayParts = getDisplayNameParts(data).filter((part) => {
        const normalized = normalizeLocationText(part);
        return normalized && normalized !== 'viet nam' && !/^\d+$/.test(normalized);
    });

    return [...displayParts]
        .reverse()
        .find((part) => {
            const normalized = normalizeLocationText(part);
            return /\b(thanh pho|tinh)\b/.test(normalized);
        }) || displayParts.at(-1) || '';
}

function findDistrictFallbackLabel(data, provinceLabel) {
    const directCandidates = uniqueLocationValues([
        data?.address?.city_district,
        data?.address?.county,
        data?.address?.district,
        data?.address?.city,
        data?.address?.town,
        data?.address?.municipality,
        data?.address?.state_district
    ]);

    const directMatch = directCandidates.find((candidate) => !isSameLocationName(candidate, provinceLabel));
    if (directMatch) {
        return directMatch;
    }

    return [...getDisplayNameParts(data)]
        .reverse()
        .find((part) => {
            const normalized = normalizeLocationText(part);
            return normalized &&
                normalized !== 'viet nam' &&
                !isSameLocationName(part, provinceLabel) &&
                /\b(quan|huyen|thi xa|thi tran|thanh pho)\b/.test(normalized);
        }) || '';
}

function findWardFallbackLabel(data, districtLabel, provinceLabel) {
    const directCandidates = uniqueLocationValues([
        data?.address?.suburb,
        data?.address?.quarter,
        data?.address?.village,
        data?.address?.hamlet,
        data?.address?.neighbourhood,
        data?.address?.city_block,
        data?.address?.subdistrict,
        data?.address?.residential
    ]);

    const directMatch = directCandidates.find((candidate) => (
        !isSameLocationName(candidate, districtLabel) &&
        !isSameLocationName(candidate, provinceLabel)
    ));

    if (directMatch) {
        return directMatch;
    }

    return getDisplayNameParts(data).find((part) => {
        const normalized = normalizeLocationText(part);
        return normalized &&
            !isSameLocationName(part, districtLabel) &&
            !isSameLocationName(part, provinceLabel) &&
            /\b(phuong|xa|thi tran)\b/.test(normalized);
    }) || '';
}

function findDistrictByWardCandidates(districts, wardCandidates) {
    let bestDistrict = null;
    let bestWard = null;
    let bestScore = 0;

    districts.forEach((district) => {
        const result = findAdministrativeMatchResult(district.wards || [], wardCandidates);
        if (result.score > bestScore) {
            bestScore = result.score;
            bestDistrict = district;
            bestWard = result.item;
        }
    });

    return {
        district: bestDistrict,
        ward: bestWard,
        score: bestScore
    };
}

async function syncAdministrativeSelections(data, requestId) {
    const citySelect = document.getElementById('newCity');
    const districtSelect = document.getElementById('newDistrict');
    const wardSelect = document.getElementById('newWard');
    const cityNameInput = document.getElementById('newCityName');
    const districtNameInput = document.getElementById('newDistrictName');
    const wardNameInput = document.getElementById('newWardName');

    if (!citySelect || !districtSelect || !wardSelect || !cityNameInput || !districtNameInput || !wardNameInput) {
        return;
    }

    await ensureProvincesLoaded();
    if (requestId !== reverseGeocodeRequestId) {
        return;
    }

    const provinceCandidates = getProvinceCandidates(data);
    const districtCandidates = getDistrictCandidates(data);
    const wardCandidates = getWardCandidates(data);

    // 1) Tìm tỉnh: ưu tiên ISO code, rồi mới text-match
    const provinceMatch = findProvinceByIsoCode(data) || findAdministrativeMatch(provincesData, provinceCandidates);
    const provinceFallbackLabel = findProvinceFallbackLabel(data);

    if (!provinceMatch && !provinceFallbackLabel) {
        return;
    }

    // 2) Set province vào select
    if (provinceMatch) {
        removeDetectedOptions(citySelect);
        citySelect.value = String(provinceMatch.code);
        cityNameInput.value = provinceMatch.name;
    } else {
        setDetectedSelection(citySelect, provinceFallbackLabel, 'province');
        cityNameInput.value = provinceFallbackLabel;
    }

    // Nếu không match được province code → dùng fallback text cho district/ward
    if (!provinceMatch) {
        const districtFallbackOnly = findDistrictFallbackLabel(data, provinceFallbackLabel);
        const wardFallbackOnly = findWardFallbackLabel(data, districtFallbackOnly, provinceFallbackLabel);

        if (districtFallbackOnly) {
            setDetectedSelection(districtSelect, districtFallbackOnly, 'district');
            districtNameInput.value = districtFallbackOnly;
        }

        if (wardFallbackOnly) {
            setDetectedSelection(wardSelect, wardFallbackOnly, 'ward');
            wardNameInput.value = wardFallbackOnly;
        }

        return;
    }

    // 3) Load danh sách quận/huyện (loadDistricts reads citySelect.value)
    await loadDistricts();
    if (requestId !== reverseGeocodeRequestId) {
        return;
    }

    // 4) Tìm quận/huyện: text-match trước, rồi thử suy luận từ ward
    let districtMatch = findAdministrativeMatch(districtsData, districtCandidates);
    let inferredWardMatch = null;

    if (!districtMatch && wardCandidates.length) {
        try {
            const districtTree = await loadProvinceDistrictTree(provinceMatch.code);
            if (requestId !== reverseGeocodeRequestId) {
                return;
            }

            const inferredByWard = findDistrictByWardCandidates(districtTree, wardCandidates);
            if (inferredByWard.score > 0) {
                districtMatch = districtsData.find((district) => String(district.code) === String(inferredByWard.district.code)) || inferredByWard.district;
                inferredWardMatch = inferredByWard.ward;
            }
        } catch (error) {
            console.error('Province district tree load error:', error);
        }
    }

    const districtFallbackLabel = findDistrictFallbackLabel(data, cityNameInput.value);

    if (districtMatch) {
        removeDetectedOptions(districtSelect);
        districtSelect.value = String(districtMatch.code);
        districtNameInput.value = districtMatch.name;
    } else if (districtFallbackLabel) {
        setDetectedSelection(districtSelect, districtFallbackLabel, 'district');
        districtNameInput.value = districtFallbackLabel;
        const wardFallbackWithoutDistrict = findWardFallbackLabel(data, districtFallbackLabel, cityNameInput.value);
        if (wardFallbackWithoutDistrict) {
            setDetectedSelection(wardSelect, wardFallbackWithoutDistrict, 'ward');
            wardNameInput.value = wardFallbackWithoutDistrict;
        }
        return;
    } else {
        return;
    }

    // 5) Load danh sách phường/xã (loadWards reads districtSelect.value)
    await loadWards();
    if (requestId !== reverseGeocodeRequestId) {
        return;
    }

    // 6) Tìm phường/xã
    const wardMatch = findAdministrativeMatch(wardsData, wardCandidates) || inferredWardMatch;
    const wardFallbackLabel = findWardFallbackLabel(data, districtNameInput.value, cityNameInput.value);

    if (wardMatch) {
        removeDetectedOptions(wardSelect);
        wardSelect.value = String(wardMatch.code);
        wardNameInput.value = wardMatch.name;
    } else if (wardFallbackLabel) {
        setDetectedSelection(wardSelect, wardFallbackLabel, 'ward');
        wardNameInput.value = wardFallbackLabel;
    }
}

async function loadProvinces() {
    if (provincesLoadPromise) {
        return provincesLoadPromise;
    }

    provincesLoadPromise = (async () => {
        try {
            const response = await fetch('/api/provinces');
            provincesData = (await response.json()).map((province) => sanitizeAdministrativeItem(province));

            const select = document.getElementById('newCity');
            if (!select) {
                return provincesData;
            }

            select.innerHTML = `<option value="">${PROVINCE_PLACEHOLDER}</option>`;
            removeDetectedOptions(select);
            provincesData.forEach((province) => {
                const option = document.createElement('option');
                option.value = province.code;
                option.textContent = province.name;
                option.dataset.name = province.name;
                select.appendChild(option);
            });
        } catch (error) {
            console.error('Load provinces error:', error);
        } finally {
            provincesLoadPromise = null;
        }

        return provincesData;
    })();

    return provincesLoadPromise;
}

async function loadDistricts() {
    const citySelect = document.getElementById('newCity');
    const districtSelect = document.getElementById('newDistrict');
    const wardSelect = document.getElementById('newWard');

    if (!citySelect || !districtSelect || !wardSelect) {
        return [];
    }

    const cityCode = citySelect.value;
    const cityName = citySelect.options[citySelect.selectedIndex]?.dataset?.name || '';
    document.getElementById('newCityName').value = cityName;

    districtSelect.innerHTML = `<option value="">${DISTRICT_PLACEHOLDER}</option>`;
    districtSelect.disabled = true;
    wardSelect.innerHTML = `<option value="">${WARD_PLACEHOLDER}</option>`;
    wardSelect.disabled = true;
    document.getElementById('newDistrictName').value = '';
    document.getElementById('newWardName').value = '';
    districtsData = [];
    wardsData = [];

    if (!cityCode) {
        return [];
    }

    try {
        if (districtsCache.has(String(cityCode))) {
            districtsData = districtsCache.get(String(cityCode));
        } else {
            const response = await fetch(`/api/provinces/${cityCode}/districts`);
            districtsData = (await response.json()).map((district) => sanitizeAdministrativeItem(district));
            districtsCache.set(String(cityCode), districtsData);
        }

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

    return districtsData;
}

async function loadWards() {
    const districtSelect = document.getElementById('newDistrict');
    const wardSelect = document.getElementById('newWard');

    if (!districtSelect || !wardSelect) {
        return [];
    }

    const districtCode = districtSelect.value;
    const districtName = districtSelect.options[districtSelect.selectedIndex]?.dataset?.name || '';
    document.getElementById('newDistrictName').value = districtName;

    wardSelect.innerHTML = `<option value="">${WARD_PLACEHOLDER}</option>`;
    wardSelect.disabled = true;
    document.getElementById('newWardName').value = '';
    wardsData = [];

    if (!districtCode) {
        return [];
    }

    try {
        if (wardsCache.has(String(districtCode))) {
            wardsData = wardsCache.get(String(districtCode));
        } else {
            const response = await fetch(`/api/districts/${districtCode}/wards`);
            wardsData = (await response.json()).map((ward) => sanitizeAdministrativeItem(ward));
            wardsCache.set(String(districtCode), wardsData);
        }

        wardsData.forEach((w) => {
            const option = document.createElement('option');
            option.value = w.code;
            option.textContent = w.name;
            option.dataset.name = w.name;
            wardSelect.appendChild(option);
        });

        wardSelect.disabled = false;
    } catch (error) {
        console.error('Load wards error:', error);
    }

    return wardsData;
}

async function toggleAddressForm() {
    await openCreateAddressForm();
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
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(addressMap);

        const locateBtn = L.control({ position: 'topleft' });
        locateBtn.onAdd = function() {
            const div = L.DomUtil.create('div', 'leaflet-control leaflet-bar');
            const button = L.DomUtil.create('a', 'locate-btn', div);

            button.href = '#';
            button.title = 'Vị trí của tôi';
            button.setAttribute('aria-label', 'Lấy vị trí hiện tại');
            button.innerHTML = [
                '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">',
                '<circle cx="12" cy="12" r="3.25"></circle>',
                '<circle cx="12" cy="12" r="7"></circle>',
                '<path d="M12 2.5v3.25M12 18.25v3.25M21.5 12h-3.25M5.75 12H2.5"></path>',
                '</svg>'
            ].join('');

            locateButtonElement = button;

            L.DomEvent.disableClickPropagation(div);
            L.DomEvent.disableScrollPropagation(div);
            L.DomEvent.on(button, 'click', function(e) {
                L.DomEvent.stop(e);
                locateUser();
            });

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
    if (locateButtonElement?.classList.contains('is-loading')) {
        return;
    }

    if (!navigator.geolocation) {
        showGlobalToast('Trình duyệt không hỗ trợ định vị', 'warning');
        return;
    }

    setLocateButtonLoading(true);

    navigator.geolocation.getCurrentPosition(
        (position) => {
            setLocateButtonLoading(false);
            const { latitude, longitude } = position.coords;
            addressMap.setView([latitude, longitude], 16);
            placeMarker(latitude, longitude);
            updateAddressFromCoords(latitude, longitude);
            addressMap.invalidateSize();
        },
        (error) => {
            setLocateButtonLoading(false);
            console.error('Geolocation error:', error);
            showGlobalToast('Không thể lấy vị trí. Vui lòng cho phép truy cập vị trí.', 'error');
        },
        { enableHighAccuracy: true, timeout: 10000 }
    );
}

async function updateAddressFromCoords(lat, lng) {
    document.getElementById('newLatitude').value = lat;
    document.getElementById('newLongitude').value = lng;
    const requestId = ++reverseGeocodeRequestId;

    try {
        const response = await fetch(`/api/geocode/reverse?lat=${lat}&lon=${lng}`);
        const data = await response.json();

        if (requestId !== reverseGeocodeRequestId) {
            return;
        }

        if (data?.address) {
            const addressLine = buildAddressLine(data.address);
            if (addressLine) {
                document.getElementById('newAddressLine').value = addressLine;
            }

            await syncAdministrativeSelections(data, requestId);
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

function setFieldError(inputId, errorId, message) {
    const input = document.getElementById(inputId);
    const error = document.getElementById(errorId);
    if (input) input.classList.add('is-invalid');
    if (error) error.textContent = message;
}

function clearFieldError(inputId, errorId) {
    const input = document.getElementById(inputId);
    const error = document.getElementById(errorId);
    if (input) input.classList.remove('is-invalid');
    if (error) error.textContent = '';
}

function validateFullName() {
    const fullName = document.getElementById('newFullName').value.trim();
    if (!fullName || fullName.length < 2) {
        setFieldError('newFullName', 'newFullNameError', 'Họ tên phải có ít nhất 2 ký tự');
        return false;
    }
    if (/\d/.test(fullName)) {
        setFieldError('newFullName', 'newFullNameError', 'Họ tên không được chứa số');
        return false;
    }
    clearFieldError('newFullName', 'newFullNameError');
    return true;
}

function validatePhone() {
    const phone = document.getElementById('newPhone').value.trim();
    if (!phone) {
        setFieldError('newPhone', 'newPhoneError', 'Vui lòng nhập số điện thoại');
        return false;
    }
    if (phone.length < 10) {
        setFieldError('newPhone', 'newPhoneError', 'Số điện thoại phải gồm đúng 10 chữ số');
        return false;
    }
    clearFieldError('newPhone', 'newPhoneError');
    return true;
}

async function saveNewAddress() {
    const fullName = document.getElementById('newFullName').value.trim();
    const phone = document.getElementById('newPhone').value.trim();
    const addressLine = document.getElementById('newAddressLine').value;
    const currentEditingAddressId = editingAddressId || Number.parseInt(document.getElementById('editingAddressId')?.value, 10) || null;
    const currentEditingDefault = document.getElementById('editingAddressDefault')?.value === 'true';

    const ward = document.getElementById('newWardName').value ||
        document.getElementById('newWard').options[document.getElementById('newWard').selectedIndex]?.text || '';
    const district = document.getElementById('newDistrictName').value ||
        document.getElementById('newDistrict').options[document.getElementById('newDistrict').selectedIndex]?.text || '';
    const city = document.getElementById('newCityName').value ||
        document.getElementById('newCity').options[document.getElementById('newCity').selectedIndex]?.text || '';

    const nameValid = validateFullName();
    const phoneValid = validatePhone();

    if (!nameValid) {
        document.getElementById('newFullName').focus();
        return;
    }
    if (!phoneValid) {
        document.getElementById('newPhone').focus();
        return;
    }

    if (!addressLine || !city || !district || !ward) {
        showGlobalToast('Vui lòng điền đầy đủ thông tin bắt buộc', 'warning');
        return;
    }

    try {
        const response = await fetch(currentEditingAddressId ? `/auth/address/${currentEditingAddressId}` : '/auth/address', {
            method: currentEditingAddressId ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({
                full_name: fullName,
                phone,
                address_line: addressLine,
                ward,
                district,
                city,
                is_default: currentEditingAddressId ? currentEditingDefault : true
            })
        });

        const data = await response.json();

        if (data.success) {
            showGlobalToast(currentEditingAddressId ? 'Đã cập nhật địa chỉ thành công' : 'Đã lưu địa chỉ thành công', 'success');
            location.reload();
        } else {
            showGlobalToast(data.message || 'Có lỗi xảy ra', 'error');
        }
    } catch (error) {
        console.error('Save address error:', error);
        showGlobalToast(currentEditingAddressId ? 'Có lỗi xảy ra khi cập nhật địa chỉ' : 'Có lỗi xảy ra khi lưu địa chỉ', 'error');
    }
}

async function deleteAddress(addressId) {
    const confirmed = await window.showGlobalConfirm({
        title: 'Xóa địa chỉ',
        message: 'Bạn muốn xóa địa chỉ này không?',
        confirmText: 'Xóa địa chỉ',
        cancelText: 'Giữ lại',
        tone: 'danger'
    });
    if (!confirmed) {
        return;
    }

    try {
        const response = await fetch(`/auth/address/${addressId}`, {
            method: 'DELETE',
            credentials: 'same-origin'
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.success) {
            showGlobalToast(data.message || 'Không thể xóa địa chỉ', 'error');
            return;
        }

        showGlobalToast('Đã xóa địa chỉ thành công', 'success');
        window.location.reload();
    } catch (error) {
        console.error('Delete address error:', error);
        showGlobalToast('Có lỗi xảy ra khi xóa địa chỉ', 'error');
    }
}

async function deleteEditingAddress() {
    const currentEditingAddressId = editingAddressId || Number.parseInt(document.getElementById('editingAddressId')?.value, 10) || null;
    if (!currentEditingAddressId) {
        return;
    }

    await deleteAddress(currentEditingAddressId);
}

async function applyVoucher() {
    const code = document.getElementById('voucherCode').value.trim();
    const discountRowEl = document.getElementById('discountRow');
    const discountAmountEl = document.getElementById('discountAmount');
    const discountInput = document.getElementById('discountInput');
    const totalEl = document.getElementById('totalAmount');

    const bootstrap = readCheckoutBootstrapData();
    const checkoutSubtotal = bootstrap.subtotal || 0;
    const checkoutShippingFee = bootstrap.shippingFee ?? 30000;
    const mode = bootstrap.mode || 'cart';

    let currentDiscount = 0;

    if (!code) {
        setVoucherMessage('Vui lòng nhập mã giảm giá', 'error');
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
                mode,
                selected_cart_item_ids: Array.isArray(bootstrap.selectedCartItemIds)
                    ? bootstrap.selectedCartItemIds.join(',')
                    : ''
            })
        });

        const data = await response.json();

        if (data.success) {
            currentDiscount = data.discount_amount;
            setVoucherMessage('Đã áp dụng voucher - Giảm ' + currentDiscount.toLocaleString('vi-VN') + 'đ', 'success');
        } else {
            setVoucherMessage(data.message, 'error');
            currentDiscount = 0;
        }
    } catch (error) {
        console.error('Voucher validation error:', error);
        setVoucherMessage('Có lỗi xảy ra khi kiểm tra voucher', 'error');
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
    const bootstrap = readCheckoutBootstrapData();
    loadProvinces();

    document.querySelectorAll('[data-checkout-action="toggle-address-form"]').forEach((button) => {
        button.addEventListener('click', async () => {
            await toggleAddressForm();
        });
    });

    document.querySelectorAll('[data-checkout-action="save-address"]').forEach((button) => {
        button.addEventListener('click', saveNewAddress);
    });

    document.querySelectorAll('[data-checkout-action="edit-address"]').forEach((button) => {
        button.addEventListener('click', async function(event) {
            event.preventDefault();
            event.stopPropagation();
            await editAddress(this.dataset.addressId);
        });
    });

    document.querySelectorAll('[data-checkout-action="delete-address-inline"]').forEach((button) => {
        button.addEventListener('click', async function(event) {
            event.preventDefault();
            await deleteEditingAddress();
        });
    });

    document.querySelectorAll('[data-checkout-action="close-address-form"]').forEach((button) => {
        button.addEventListener('click', function(event) {
            event.preventDefault();
            closeAddressForm();
        });
    });

    if (bootstrap.mode !== 'buy-now') {
        document.querySelectorAll('[data-checkout-action="apply-voucher"]').forEach((button) => {
            button.addEventListener('click', applyVoucher);
        });

        document.querySelectorAll('.voucher-card').forEach((card) => {
            card.addEventListener('click', () => selectVoucher(card));
        });
    }

    document.getElementById('newCity')?.addEventListener('change', loadDistricts);
    document.getElementById('newDistrict')?.addEventListener('change', loadWards);
    document.getElementById('newWard')?.addEventListener('change', syncSelectedWardName);

    // Chặn nhập số vào ô họ tên + validate inline
    document.getElementById('newFullName')?.addEventListener('input', function() {
        this.value = this.value.replace(/[0-9]/g, '');
        validateFullName();
    });

    // Chỉ cho phép nhập số vào ô điện thoại + validate inline
    document.getElementById('newPhone')?.addEventListener('input', function() {
        this.value = this.value.replace(/[^0-9]/g, '');
        validatePhone();
    });

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
            this.closest('.address-card')?.classList.add('address-card--selected');
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
    if (addressForm && !addressForm.hidden) {
        document.body.classList.add('address-form-open');
        setAddressFormEditingState(null);
        setTimeout(initAddressMap, 300);
    } else {
        document.body.classList.remove('address-form-open');
        setAddressFormEditingState(null);
    }

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !getAddressFormElement()?.hidden) {
            closeAddressForm();
        }
    });
}

document.addEventListener('DOMContentLoaded', initCheckout);


