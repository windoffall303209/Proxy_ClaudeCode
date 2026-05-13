// Model quản lí cấu hình website theo dạng key-value có bản nháp và bản đã áp dụng.
const pool = require('../config/database');

const SETTING_GROUPS = [
    { key: 'identity', title: 'Nhận diện thương hiệu', description: 'Logo, favicon, tên hiển thị và font chữ thương hiệu.' },
    { key: 'theme', title: 'Giao diện chung', description: 'Font, màu sắc, bo góc và mật độ hiển thị sản phẩm.' },
    { key: 'header', title: 'Header và menu', description: 'Tìm kiếm, nhãn menu, link nhanh và nội dung menu mobile.' },
    { key: 'home', title: 'Trang chủ', description: 'Hero, các khối nội dung và số lượng sản phẩm/danh mục hiển thị.' },
    { key: 'banner_popup', title: 'Banner và popup', description: 'Cấu hình cách popup banner xuất hiện trên trang chủ.' },
    { key: 'footer', title: 'Footer và liên hệ', description: 'Newsletter, liên hệ, mạng xã hội, bản quyền và phương thức thanh toán.' },
    { key: 'services', title: 'Dịch vụ và chính sách', description: 'Nội dung cam kết dịch vụ hiển thị ở trang chủ và footer.' },
    { key: 'seo', title: 'SEO và metadata', description: 'Title, description, OG image và robots mặc định.' },
    { key: 'chat', title: 'Chat widget', description: 'Bật/tắt, lời chào, tên hiển thị và vị trí nút chat.' },
    { key: 'email', title: 'Email và thông báo', description: 'Email mặc định, tên người gửi và nội dung chân email.' },
    { key: 'payment', title: 'Thanh toán và đơn hàng', description: 'Thời hạn thanh toán, phương thức thanh toán và lời nhắc.' },
    { key: 'security', title: 'Bảo mật và vận hành', description: 'JWT, OTP và chế độ bảo trì website.' }
];

const FONT_OPTIONS = [
    { value: "'Be Vietnam Pro', sans-serif", label: 'Be Vietnam Pro' },
    { value: "'Manrope', sans-serif", label: 'Manrope' },
    { value: "'Inter', sans-serif", label: 'Inter' },
    { value: "Arial, sans-serif", label: 'Arial' },
    { value: "'Times New Roman', serif", label: 'Times New Roman' }
];

const CHAT_POSITION_OPTIONS = [
    { value: 'right', label: 'Bên phải' },
    { value: 'left', label: 'Bên trái' }
];

const SETTING_DEFINITIONS = {
    site_name: { group: 'identity', type: 'string', label: 'Tên thương hiệu', defaultValue: 'WIND OF FALL', maxLength: 120 },
    site_tagline: { group: 'identity', type: 'string', label: 'Tagline', defaultValue: 'Thời trang mặc đẹp mỗi ngày', maxLength: 180 },
    brand_initials: { group: 'identity', type: 'string', label: 'Chữ viết tắt logo footer/chat', defaultValue: 'WF', maxLength: 12 },
    brand_alt_text: { group: 'identity', type: 'string', label: 'Alt text logo', defaultValue: 'WIND OF FALL', maxLength: 160 },
    logo_url: { group: 'identity', type: 'image', label: 'Logo storefront', defaultValue: '/favicon.png', maxLength: 500 },
    admin_logo_url: { group: 'identity', type: 'image', label: 'Logo admin', defaultValue: '/favicon.png', maxLength: 500 },
    favicon_url: { group: 'identity', type: 'image', label: 'Favicon', defaultValue: '/favicon.png', maxLength: 500 },
    brand_font_family: { group: 'identity', type: 'select', label: 'Font tên thương hiệu', defaultValue: "'Be Vietnam Pro', sans-serif", options: FONT_OPTIONS },
    brand_name_font_size: { group: 'identity', type: 'int', label: 'Cỡ chữ tên thương hiệu (px)', defaultValue: 18, min: 12, max: 42 },

    site_font_family: { group: 'theme', type: 'select', label: 'Font toàn web', defaultValue: "'Be Vietnam Pro', sans-serif", options: FONT_OPTIONS },
    primary_color: { group: 'theme', type: 'color', label: 'Màu chính', defaultValue: '#f2c94c' },
    secondary_color: { group: 'theme', type: 'color', label: 'Màu phụ', defaultValue: '#d8a617' },
    background_color: { group: 'theme', type: 'color', label: 'Màu nền', defaultValue: '#fcfaf4' },
    text_color: { group: 'theme', type: 'color', label: 'Màu chữ chính', defaultValue: '#18140d' },
    card_radius: { group: 'theme', type: 'int', label: 'Bo góc card (px)', defaultValue: 20, min: 0, max: 48 },
    button_radius: { group: 'theme', type: 'int', label: 'Bo góc nút (px)', defaultValue: 999, min: 0, max: 999 },
    product_grid_columns: { group: 'theme', type: 'int', label: 'Số sản phẩm mỗi hàng desktop', defaultValue: 5, min: 2, max: 6 },
    home_category_showcase_count: { group: 'theme', type: 'int', label: 'Số danh mục nổi bật trang chủ', defaultValue: 3, min: 1, max: 8 },

    search_placeholder: { group: 'header', type: 'string', label: 'Placeholder tìm kiếm desktop', defaultValue: 'Tìm áo polo, váy midi, quần jean...', maxLength: 180 },
    mobile_search_placeholder: { group: 'header', type: 'string', label: 'Placeholder tìm kiếm mobile', defaultValue: 'Tìm sản phẩm yêu thích...', maxLength: 180 },
    home_link_label: { group: 'header', type: 'string', label: 'Nhãn link Trang chủ', defaultValue: 'Trang chủ', maxLength: 80 },
    all_products_label: { group: 'header', type: 'string', label: 'Nhãn link Tất cả sản phẩm', defaultValue: 'Tất cả', maxLength: 80 },
    sale_link_label: { group: 'header', type: 'string', label: 'Nhãn link Sale', defaultValue: 'Sale tới 50%', maxLength: 80 },
    for_you_link_label: { group: 'header', type: 'string', label: 'Nhãn link For You', defaultValue: 'For You', maxLength: 80 },
    show_all_products_link: { group: 'header', type: 'boolean', label: 'Hiện link Tất cả sản phẩm', defaultValue: true },
    show_sale_link: { group: 'header', type: 'boolean', label: 'Hiện link Sale', defaultValue: true },
    show_for_you_link: { group: 'header', type: 'boolean', label: 'Hiện link For You', defaultValue: true },
    mobile_menu_eyebrow: { group: 'header', type: 'string', label: 'Eyebrow menu mobile', defaultValue: 'WIND OF FALL', maxLength: 100 },
    mobile_menu_slogan: { group: 'header', type: 'string', label: 'Slogan menu mobile', defaultValue: 'Tìm outfit cho cả gia đình', maxLength: 160 },
    mobile_support_text: { group: 'header', type: 'string', label: 'Dòng hỗ trợ menu mobile', defaultValue: 'Hỗ trợ tư vấn set đồ 1:1 qua hotline 1900 123 456', maxLength: 220 },

    hero_eyebrow: { group: 'home', type: 'string', label: 'Eyebrow hero', defaultValue: 'Bộ sưu tập mới / mặc đẹp mỗi ngày', maxLength: 180 },
    hero_title: { group: 'home', type: 'string', label: 'Tiêu đề hero', defaultValue: 'Chọn nhanh outfit đẹp cho nam, nữ và trẻ em.', maxLength: 220 },
    hero_copy: { group: 'home', type: 'string', label: 'Mô tả hero', defaultValue: 'Áo polo, sơ mi, váy, jeans và nhiều mẫu dễ mặc đã sẵn sàng để bạn mua ngay.', maxLength: 320 },
    hero_primary_label: { group: 'home', type: 'string', label: 'Nút hero chính', defaultValue: 'Mua bộ sưu tập mới', maxLength: 80 },
    hero_primary_url: { group: 'home', type: 'url', label: 'Link nút hero chính', defaultValue: '/products', maxLength: 500 },
    hero_secondary_label: { group: 'home', type: 'string', label: 'Nút hero phụ', defaultValue: 'Xem khu sale', maxLength: 80 },
    hero_secondary_url: { group: 'home', type: 'url', label: 'Link nút hero phụ', defaultValue: '/products?sale=true', maxLength: 500 },
    hero_stat_1_value: { group: 'home', type: 'string', label: 'Thống kê hero 1 - số', defaultValue: 'Từ 499K', maxLength: 80 },
    hero_stat_1_label: { group: 'home', type: 'string', label: 'Thống kê hero 1 - nhãn', defaultValue: 'Freeship toàn quốc', maxLength: 120 },
    hero_stat_2_value: { group: 'home', type: 'string', label: 'Thống kê hero 2 - số', defaultValue: '30 ngày', maxLength: 80 },
    hero_stat_2_label: { group: 'home', type: 'string', label: 'Thống kê hero 2 - nhãn', defaultValue: 'Đổi trả linh hoạt', maxLength: 120 },
    hero_stat_3_value: { group: 'home', type: 'string', label: 'Thống kê hero 3 - số', defaultValue: '24/7', maxLength: 80 },
    hero_stat_3_label: { group: 'home', type: 'string', label: 'Thống kê hero 3 - nhãn', defaultValue: 'Hỗ trợ online', maxLength: 120 },
    show_home_categories: { group: 'home', type: 'boolean', label: 'Hiện danh mục nổi bật', defaultValue: true },
    show_home_new_products: { group: 'home', type: 'boolean', label: 'Hiện mẫu mới', defaultValue: true },
    show_home_editorial: { group: 'home', type: 'boolean', label: 'Hiện gợi ý phối đồ', defaultValue: true },
    show_home_best_sellers: { group: 'home', type: 'boolean', label: 'Hiện bán chạy', defaultValue: true },
    show_home_services: { group: 'home', type: 'boolean', label: 'Hiện khối dịch vụ', defaultValue: true },
    home_new_products_limit: { group: 'home', type: 'int', label: 'Số mẫu mới hiển thị', defaultValue: 10, min: 4, max: 24 },
    home_best_sellers_limit: { group: 'home', type: 'int', label: 'Số bán chạy hiển thị', defaultValue: 5, min: 2, max: 12 },
    home_categories_title: { group: 'home', type: 'string', label: 'Tiêu đề danh mục nổi bật', defaultValue: 'Mua sắm theo nhu cầu của bạn.', maxLength: 180 },
    home_categories_copy: { group: 'home', type: 'string', label: 'Mô tả danh mục nổi bật', defaultValue: 'Chọn nhanh theo nam, nữ và trẻ em để tìm đúng sản phẩm bạn cần.', maxLength: 280 },
    home_new_products_title: { group: 'home', type: 'string', label: 'Tiêu đề mẫu mới', defaultValue: 'Hàng mới lên kệ hôm nay.', maxLength: 180 },
    home_best_sellers_title: { group: 'home', type: 'string', label: 'Tiêu đề bán chạy', defaultValue: 'Những mẫu được chọn nhiều nhất.', maxLength: 180 },
    home_editorial_title: { group: 'home', type: 'string', label: 'Tiêu đề gợi ý phối đồ', defaultValue: 'Dễ mặc từ công sở đến cuối tuần.', maxLength: 180 },
    home_editorial_copy: { group: 'home', type: 'string', label: 'Mô tả gợi ý phối đồ', defaultValue: 'Các nhóm sản phẩm được sắp theo những nhu cầu mặc thường ngày để bạn chọn nhanh hơn.', maxLength: 320 },

    popup_enabled: { group: 'banner_popup', type: 'boolean', label: 'Bật popup banner', defaultValue: true },
    popup_frequency_hours: { group: 'banner_popup', type: 'int', label: 'Hiện lại popup sau (giờ)', defaultValue: 24, min: 1, max: 720 },
    popup_fallback_eyebrow: { group: 'banner_popup', type: 'string', label: 'Eyebrow popup fallback', defaultValue: 'WIND OF FALL', maxLength: 120 },
    popup_fallback_button_label: { group: 'banner_popup', type: 'string', label: 'Nhãn nút popup fallback', defaultValue: 'Khám phá ngay', maxLength: 80 },

    footer_description: { group: 'footer', type: 'string', label: 'Mô tả footer', defaultValue: 'Thương hiệu thời trang everyday theo tinh thần hiện đại, gọn gàng và dễ mặc. Chúng tôi ưu tiên chất liệu, phom dáng và trải nghiệm mua sắm mượt mà trên mọi thiết bị.', maxLength: 520 },
    facebook_url: { group: 'footer', type: 'url', label: 'Facebook URL', defaultValue: '#', allowEmpty: true, maxLength: 500 },
    instagram_url: { group: 'footer', type: 'url', label: 'Instagram URL', defaultValue: '#', allowEmpty: true, maxLength: 500 },
    tiktok_url: { group: 'footer', type: 'url', label: 'TikTok URL', defaultValue: '#', allowEmpty: true, maxLength: 500 },
    zalo_url: { group: 'footer', type: 'url', label: 'Zalo URL', defaultValue: '', allowEmpty: true, maxLength: 500 },
    contact_hotline: { group: 'footer', type: 'string', label: 'Hotline', defaultValue: '1900 123 456', maxLength: 80 },
    contact_email: { group: 'footer', type: 'string', label: 'Email liên hệ', defaultValue: 'info@windoffall.vn', maxLength: 160 },
    contact_address: { group: 'footer', type: 'string', label: 'Địa chỉ', defaultValue: '123 Nguyễn Huệ, Quận 1, TP.HCM', maxLength: 220 },
    opening_hours: { group: 'footer', type: 'string', label: 'Giờ mở cửa', defaultValue: 'Mở cửa 8:00 - 22:00 mỗi ngày', maxLength: 160 },
    copyright_text: { group: 'footer', type: 'string', label: 'Copyright', defaultValue: '© 2026 WIND OF FALL. All rights reserved.', maxLength: 200 },
    newsletter_eyebrow: { group: 'footer', type: 'string', label: 'Newsletter eyebrow', defaultValue: 'Newsletter', maxLength: 80 },
    newsletter_title: { group: 'footer', type: 'string', label: 'Tiêu đề newsletter', defaultValue: 'Nhập email để nhận ưu đãi và bộ sưu tập mới sớm hơn', maxLength: 220 },
    newsletter_copy: { group: 'footer', type: 'string', label: 'Mô tả newsletter', defaultValue: 'Cập nhật BST mới, voucher độc quyền và gợi ý phối đồ theo mùa.', maxLength: 320 },
    newsletter_button_label: { group: 'footer', type: 'string', label: 'Nhãn nút newsletter', defaultValue: 'Đăng ký ngay', maxLength: 80 },
    newsletter_success_text: { group: 'footer', type: 'string', label: 'Thông báo đăng ký thành công', defaultValue: 'Bạn đã đăng ký nhận tin khuyến mại thành công.', maxLength: 220 },
    payment_badges: { group: 'footer', type: 'json', label: 'Payment badges (JSON array)', defaultValue: ['COD', 'VNPay', 'MoMo', 'Visa'] },

    service_shipping_title: { group: 'services', type: 'string', label: 'Tiêu đề freeship', defaultValue: 'Freeship đơn từ 499K', maxLength: 120 },
    service_shipping_copy: { group: 'services', type: 'string', label: 'Mô tả freeship', defaultValue: 'Thông tin ưu đãi rõ ràng ngay từ trang đầu để bạn chốt đơn nhanh hơn.', maxLength: 260 },
    service_return_title: { group: 'services', type: 'string', label: 'Tiêu đề đổi trả', defaultValue: 'Đổi trả trong 30 ngày', maxLength: 120 },
    service_return_copy: { group: 'services', type: 'string', label: 'Mô tả đổi trả', defaultValue: 'Yên tâm thử size và đổi mẫu nếu chưa thật sự phù hợp.', maxLength: 260 },
    service_consult_title: { group: 'services', type: 'string', label: 'Tiêu đề tư vấn', defaultValue: 'Hỗ trợ qua hotline và chat', maxLength: 120 },
    service_consult_copy: { group: 'services', type: 'string', label: 'Mô tả tư vấn', defaultValue: 'Dễ hỏi size, hỏi phối đồ và theo dõi đơn hàng khi cần.', maxLength: 260 },
    service_payment_title: { group: 'services', type: 'string', label: 'Tiêu đề thanh toán', defaultValue: 'Thanh toán rõ ràng', maxLength: 120 },
    service_payment_copy: { group: 'services', type: 'string', label: 'Mô tả thanh toán', defaultValue: 'COD, VNPay và MoMo hiển thị sớm để người mua dễ lựa chọn.', maxLength: 260 },
    free_shipping_min_amount: { group: 'services', type: 'int', label: 'Freeship từ đơn hàng (VND)', defaultValue: 500000, min: 0, max: 100000000 },
    return_window_days: { group: 'services', type: 'int', label: 'Số ngày đổi trả', defaultValue: 30, min: 0, max: 365 },
    policy_links: {
        group: 'services',
        type: 'json',
        label: 'Link chính sách footer (JSON array)',
        defaultValue: [
            { label: 'Vận chuyển', url: '/policy/shipping' },
            { label: 'Đổi trả', url: '/policy/return' },
            { label: 'Thanh toán', url: '/policy/payment' },
            { label: 'Bảo mật thông tin', url: '/policy/privacy' }
        ]
    },

    seo_title: { group: 'seo', type: 'string', label: 'Title mặc định', defaultValue: 'WIND OF FALL | Thời trang mỗi ngày', maxLength: 180 },
    meta_description: { group: 'seo', type: 'string', label: 'Meta description', defaultValue: 'WIND OF FALL - mua sắm thời trang everyday cho nam, nữ và trẻ em.', maxLength: 320 },
    meta_keywords: { group: 'seo', type: 'string', label: 'Meta keywords', defaultValue: 'thời trang, quần áo, wind of fall', maxLength: 260 },
    og_title: { group: 'seo', type: 'string', label: 'OG title', defaultValue: 'WIND OF FALL', maxLength: 180 },
    og_description: { group: 'seo', type: 'string', label: 'OG description', defaultValue: 'Thời trang everyday hiện đại, dễ mặc và dễ mua.', maxLength: 320 },
    og_image_url: { group: 'seo', type: 'image', label: 'OG image', defaultValue: '/favicon.png', maxLength: 500 },
    robots_index: { group: 'seo', type: 'boolean', label: 'Cho phép index/follow', defaultValue: true },

    chat_enabled: { group: 'chat', type: 'boolean', label: 'Bật chat widget', defaultValue: true },
    chat_title: { group: 'chat', type: 'string', label: 'Tiêu đề chat', defaultValue: 'WIND OF FALL', maxLength: 120 },
    chat_bot_name: { group: 'chat', type: 'string', label: 'Tên bot/thương hiệu trong chat', defaultValue: 'WIND OF FALL', maxLength: 120 },
    chat_greeting: { group: 'chat', type: 'string', label: 'Lời chào đầu tiên', defaultValue: 'Xin chào! Tôi là trợ lý AI của WIND OF FALL.', maxLength: 260 },
    chat_prompt_text: { group: 'chat', type: 'string', label: 'Câu hỏi gợi mở', defaultValue: 'Bạn cần hỗ trợ gì?', maxLength: 180 },
    chat_position: { group: 'chat', type: 'select', label: 'Vị trí nút chat', defaultValue: 'right', options: CHAT_POSITION_OPTIONS },

    default_web_email: { group: 'email', type: 'string', label: 'Email nhận OTP thao tác nhạy cảm', defaultValue: 'nvuthanh4@gmail.com', maxLength: 160 },
    email_sender_name: { group: 'email', type: 'string', label: 'Tên người gửi email', defaultValue: 'WIND OF FALL', maxLength: 120 },
    support_email: { group: 'email', type: 'string', label: 'Email hỗ trợ khách hàng', defaultValue: 'support@windoffall.vn', maxLength: 160 },
    email_footer_text: { group: 'email', type: 'string', label: 'Chân email thương hiệu', defaultValue: 'Cảm ơn bạn đã đồng hành cùng WIND OF FALL.', maxLength: 260 },

    payment_window_hours: { group: 'payment', type: 'int', label: 'Thời hạn chờ thanh toán online (giờ)', defaultValue: 24, min: 1, max: 168 },
    shipping_fee_amount: { group: 'payment', type: 'int', label: 'Phí ship (VND)', defaultValue: 30000, min: 0, max: 100000000 },
    payment_cod_enabled: { group: 'payment', type: 'boolean', label: 'Bật COD', defaultValue: true },
    payment_vnpay_enabled: { group: 'payment', type: 'boolean', label: 'Bật VNPay', defaultValue: true },
    payment_momo_enabled: { group: 'payment', type: 'boolean', label: 'Bật MoMo', defaultValue: true },
    payment_reminder_text: { group: 'payment', type: 'string', label: 'Lời nhắc thanh toán', defaultValue: 'Đơn hàng online cần thanh toán trong thời hạn quy định để được xử lý.', maxLength: 260 },

    jwt_expire_minutes: { group: 'security', type: 'int', label: 'Thời gian lưu JWT (phút)', defaultValue: 60, min: 5, max: 43200 },
    otp_expire_minutes: { group: 'security', type: 'int', label: 'Thời hạn OTP thao tác nhạy cảm (phút)', defaultValue: 10, min: 1, max: 60 },
    maintenance_mode: { group: 'security', type: 'boolean', label: 'Bật maintenance mode', defaultValue: false },
    maintenance_message: { group: 'security', type: 'string', label: 'Thông báo bảo trì', defaultValue: 'Website đang bảo trì, vui lòng quay lại sau.', maxLength: 260 }
};

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function clampInteger(value, { defaultValue, min, max }) {
    value = lastValue(value);
    const parsed = Number.parseInt(value, 10);
    if (!Number.isInteger(parsed)) {
        return defaultValue;
    }

    return Math.min(max, Math.max(min, parsed));
}

function isBlank(value) {
    return value === undefined || value === null || String(value).trim() === '';
}

function lastValue(value) {
    return Array.isArray(value) ? value[value.length - 1] : value;
}

function normalizeBoolean(value, defaultValue) {
    value = lastValue(value);

    if (value === undefined || value === null || value === '') {
        return Boolean(defaultValue);
    }

    if (typeof value === 'boolean') {
        return value;
    }

    const normalized = String(value).trim().toLowerCase();
    return ['true', '1', 'on', 'yes', 'y'].includes(normalized);
}

function normalizeColor(value, defaultValue) {
    value = lastValue(value);
    const normalized = String(value || '').trim();
    return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(normalized) ? normalized : defaultValue;
}

function normalizeUrl(value, definition) {
    value = lastValue(value);
    const normalized = String(value || '').trim();
    if (!normalized) {
        return definition.allowEmpty ? '' : definition.defaultValue;
    }

    const isAllowed = normalized === '#'
        || normalized.startsWith('/')
        || normalized.startsWith('http://')
        || normalized.startsWith('https://')
        || normalized.startsWith('mailto:')
        || normalized.startsWith('tel:');

    if (!isAllowed) {
        return definition.defaultValue;
    }

    return normalized.slice(0, definition.maxLength || 500);
}

function normalizeJson(value, defaultValue) {
    value = lastValue(value);

    if (value === undefined || value === null || value === '') {
        return clone(defaultValue);
    }

    if (typeof value === 'object') {
        return value;
    }

    try {
        return JSON.parse(String(value));
    } catch (error) {
        return clone(defaultValue);
    }
}

function getDefinitionKeysForGroup(groupKey) {
    return Object.entries(SETTING_DEFINITIONS)
        .filter(([, definition]) => definition.group === groupKey)
        .map(([key]) => key);
}

class StorefrontSetting {
    static getGroups() {
        return clone(SETTING_GROUPS);
    }

    static getDefinitions() {
        return clone(SETTING_DEFINITIONS);
    }

    static getDefinitionKeysForGroup(groupKey) {
        return getDefinitionKeysForGroup(groupKey);
    }

    static getDefaultSettings() {
        return Object.entries(SETTING_DEFINITIONS).reduce((settings, [key, definition]) => {
            settings[key] = clone(definition.defaultValue);
            return settings;
        }, {});
    }

    static normalizeValue(key, rawValue) {
        const definition = SETTING_DEFINITIONS[key];
        if (!definition) {
            return null;
        }

        if (definition.type === 'int') {
            return clampInteger(rawValue, definition);
        }

        if (definition.type === 'boolean') {
            return normalizeBoolean(rawValue, definition.defaultValue);
        }

        if (definition.type === 'color') {
            return normalizeColor(rawValue, definition.defaultValue);
        }

        if (definition.type === 'url' || definition.type === 'image') {
            return normalizeUrl(rawValue, definition);
        }

        if (definition.type === 'select') {
            const value = String(lastValue(rawValue) || '').trim();
            const allowedValues = (definition.options || []).map((option) => option.value);
            return allowedValues.includes(value) ? value : definition.defaultValue;
        }

        if (definition.type === 'json') {
            return normalizeJson(rawValue, definition.defaultValue);
        }

        const value = String(lastValue(rawValue) ?? '').trim();
        if (!value) {
            return definition.allowEmpty ? '' : definition.defaultValue;
        }

        return value.slice(0, definition.maxLength || 255);
    }

    static serializeValue(key, value) {
        const definition = SETTING_DEFINITIONS[key];
        const normalizedValue = this.normalizeValue(key, value);

        if (definition?.type === 'json') {
            return JSON.stringify(normalizedValue);
        }

        if (definition?.type === 'boolean') {
            return normalizedValue ? 'true' : 'false';
        }

        return String(normalizedValue);
    }

    static formatValueForInput(key, value) {
        const definition = SETTING_DEFINITIONS[key];
        const normalizedValue = this.normalizeValue(key, value);

        if (definition?.type === 'json') {
            return JSON.stringify(normalizedValue, null, 2);
        }

        return normalizedValue;
    }

    static hydrateSettings(rows = [], columnName = 'setting_value') {
        const settings = this.getDefaultSettings();
        const knownKeys = new Set(Object.keys(SETTING_DEFINITIONS));

        (rows || []).forEach((row) => {
            const key = row?.setting_key;
            if (!knownKeys.has(key)) {
                return;
            }

            settings[key] = this.normalizeValue(key, row[columnName]);
        });

        return settings;
    }

    static async getAll() {
        const keys = Object.keys(SETTING_DEFINITIONS);
        const placeholders = keys.map(() => '?').join(', ');

        try {
            const [rows] = await pool.execute(
                `SELECT setting_key, setting_value
                 FROM storefront_settings
                 WHERE setting_key IN (${placeholders})`,
                keys
            );

            return this.hydrateSettings(rows);
        } catch (error) {
            if (error?.code === 'ER_NO_SUCH_TABLE' || error?.code === 'ER_BAD_FIELD_ERROR') {
                return this.getDefaultSettings();
            }

            throw error;
        }
    }

    static async getAdminState() {
        const keys = Object.keys(SETTING_DEFINITIONS);
        const placeholders = keys.map(() => '?').join(', ');
        let rows = [];

        try {
            [rows] = await pool.execute(
                `SELECT setting_key, setting_value, draft_value, value_type, updated_by, updated_at, published_at
                 FROM storefront_settings
                 WHERE setting_key IN (${placeholders})`,
                keys
            );
        } catch (error) {
            if (error?.code !== 'ER_NO_SUCH_TABLE' && error?.code !== 'ER_BAD_FIELD_ERROR') {
                throw error;
            }
        }

        const rowsByKey = new Map(rows.map((row) => [row.setting_key, row]));
        const values = {};
        const publishedValues = {};
        const inputValues = {};
        const draftKeys = [];

        keys.forEach((key) => {
            const row = rowsByKey.get(key);
            const published = this.normalizeValue(key, row ? row.setting_value : SETTING_DEFINITIONS[key].defaultValue);
            const hasDraft = row && row.draft_value !== null && row.draft_value !== undefined;
            const current = hasDraft ? this.normalizeValue(key, row.draft_value) : published;

            publishedValues[key] = published;
            values[key] = current;
            inputValues[key] = this.formatValueForInput(key, current);

            if (hasDraft) {
                draftKeys.push(key);
            }
        });

        const groups = this.getGroups().map((group) => {
            const groupKeys = getDefinitionKeysForGroup(group.key);
            const draftCount = groupKeys.filter((key) => draftKeys.includes(key)).length;
            return {
                ...group,
                keys: groupKeys,
                draftCount,
                hasDraft: draftCount > 0
            };
        });

        return {
            values,
            publishedValues,
            inputValues,
            definitions: this.getDefinitions(),
            groups,
            draftKeys,
            hasDraft: draftKeys.length > 0
        };
    }

    static getKnownKeys(nextValues = {}, groupKey = '') {
        const allowedKeys = groupKey
            ? new Set(getDefinitionKeysForGroup(groupKey))
            : new Set(Object.keys(SETTING_DEFINITIONS));

        return Object.keys(nextValues)
            .filter((key) => allowedKeys.has(key) && Object.prototype.hasOwnProperty.call(SETTING_DEFINITIONS, key));
    }

    static async saveDraft(nextValues = {}, userId = null, groupKey = '') {
        const keysToUpdate = this.getKnownKeys(nextValues, groupKey);
        if (keysToUpdate.length === 0) {
            return this.getAdminState();
        }

        const connection = await pool.getConnection();

        try {
            await connection.beginTransaction();

            for (const key of keysToUpdate) {
                const definition = SETTING_DEFINITIONS[key];
                const draftValue = this.serializeValue(key, nextValues[key]);
                const defaultValue = this.serializeValue(key, definition.defaultValue);
                await connection.execute(
                    `INSERT INTO storefront_settings (setting_key, setting_value, draft_value, value_type, updated_by)
                     VALUES (?, ?, ?, ?, ?)
                     ON CONFLICT (setting_key) DO UPDATE SET
                        draft_value = EXCLUDED.draft_value,
                        value_type = EXCLUDED.value_type,
                        updated_by = EXCLUDED.updated_by,
                        updated_at = CURRENT_TIMESTAMP`,
                    [key, defaultValue, draftValue, definition.type || 'string', userId || null]
                );
            }

            await connection.commit();
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }

        return this.getAdminState();
    }

    static async publish(groupKey = '', userId = null) {
        const keysToPublish = groupKey ? getDefinitionKeysForGroup(groupKey) : Object.keys(SETTING_DEFINITIONS);
        if (keysToPublish.length === 0) {
            return this.getAdminState();
        }

        const placeholders = keysToPublish.map(() => '?').join(', ');
        await pool.execute(
            `UPDATE storefront_settings
             SET setting_value = COALESCE(draft_value, setting_value),
                 draft_value = NULL,
                 updated_by = ?,
                 published_at = CURRENT_TIMESTAMP
             WHERE setting_key IN (${placeholders})`,
            [userId || null, ...keysToPublish]
        );

        return this.getAdminState();
    }

    static async discardDraft(groupKey = '') {
        const keysToDiscard = groupKey ? getDefinitionKeysForGroup(groupKey) : Object.keys(SETTING_DEFINITIONS);
        if (keysToDiscard.length === 0) {
            return this.getAdminState();
        }

        const placeholders = keysToDiscard.map(() => '?').join(', ');
        await pool.execute(
            `UPDATE storefront_settings
             SET draft_value = NULL
             WHERE setting_key IN (${placeholders})`,
            keysToDiscard
        );

        return this.getAdminState();
    }

    static async resetDraft(groupKey = '', userId = null) {
        const keysToReset = groupKey ? getDefinitionKeysForGroup(groupKey) : Object.keys(SETTING_DEFINITIONS);
        const nextValues = keysToReset.reduce((values, key) => {
            values[key] = SETTING_DEFINITIONS[key].defaultValue;
            return values;
        }, {});

        return this.saveDraft(nextValues, userId, groupKey);
    }

    static async updateMany(nextValues = {}) {
        const keysToUpdate = this.getKnownKeys(nextValues);
        if (keysToUpdate.length === 0) {
            return this.getAll();
        }

        const connection = await pool.getConnection();

        try {
            await connection.beginTransaction();

            for (const key of keysToUpdate) {
                const definition = SETTING_DEFINITIONS[key];
                const settingValue = this.serializeValue(key, nextValues[key]);
                await connection.execute(
                    `INSERT INTO storefront_settings (setting_key, setting_value, draft_value, value_type, published_at)
                     VALUES (?, ?, NULL, ?, CURRENT_TIMESTAMP)
                     ON CONFLICT (setting_key) DO UPDATE SET
                        setting_value = EXCLUDED.setting_value,
                        draft_value = NULL,
                        value_type = EXCLUDED.value_type,
                        published_at = CURRENT_TIMESTAMP`,
                    [key, settingValue, definition.type || 'string']
                );
            }

            await connection.commit();
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }

        return this.getAll();
    }
}

module.exports = StorefrontSetting;
