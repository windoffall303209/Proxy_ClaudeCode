// Controller chat xử lý luồng chat handler cũ giữa khách hàng, admin và service AI.

const Chat = require('../../models/Chat');
const Product = require('../../models/Product');
const { describeProductFromImage } = require('../../services/chatVisionService');
const { retrieveChatRagContext } = require('../../services/chatRagService');
const productVisualEmbeddingService = require('../../services/productVisualEmbeddingService');

const CHAT_PRODUCT_KEYWORDS = [
    'ao', 'ao thun', 'ao so mi', 'ao polo', 'quan', 'quan jean', 'jeans', 'kaki',
    'dam', 'vay', 'chan vay', 'croptop', 'crop top', 'hoodie', 'jacket', 'outfit', 'phoi do',
    'thoi trang', 'mac di lam', 'di lam', 'cong so', 'di choi', 'size', 'mau',
    'goi y', 'tu van', 'phu hop', 'tim san pham', 'do nam', 'do nu',
    'nam', 'nu', 'tre em', 'be trai', 'be gai'
];

const CHAT_SUPPORT_KEYWORDS = [
    'don hang', 'ma don', 'van chuyen', 'giao hang', 'ship', 'thanh toan',
    'doi tra', 'hoan tien', 'bao hanh', 'tai khoan', 'dang nhap', 'dang ky',
    'voucher', 'ma giam', 'khuyen mai', 'loi he thong'
];

const CHAT_IMAGE_SEARCH_HINTS = [
    'bang hinh anh', 'bang anh', 'theo anh', 'tu anh', 'gui anh', 'upload anh',
    'anh san pham', 'hinh san pham', 'photo', 'image'
];

const CHAT_IMAGE_SEARCH_ACTIONS = [
    'tim', 'tim kiem', 'tim san pham', 'goi y', 'tu van', 'nhan dien',
    'so sanh', 'tuong dong', 'co the', 'duoc khong', 'ho tro', 'giup'
];

const CHAT_GENDER_RULES = [
    { id: 'kids', label: 'tr\u1ebb em', searchPhrase: 'tre em', keywords: ['tre em', 'em be', 'be trai', 'be gai', 'kids'] },
    { id: 'male', label: 'nam', searchPhrase: 'nam', keywords: ['do nam', 'thoi trang nam', 'nam', 'men', 'male', 'chong', 'ban trai', 'nguoi yeu nam', 'anh trai', 'em trai'] },
    { id: 'female', label: 'n\u1eef', searchPhrase: 'nu', keywords: ['do nu', 'thoi trang nu', 'nu', 'women', 'female', 'vo', 'ban gai', 'nguoi yeu nu', 'chi gai', 'em gai'] }
];

const CHAT_OCCASION_RULES = [
    { id: 'office', label: '\u0111i l\u00e0m', searchPhrase: 'cong so', keywords: ['di lam', 'cong so', 'van phong', 'lich su', 'hop', 'meeting'] },
    { id: 'casual', label: '\u0111i ch\u01a1i', searchPhrase: 'di choi', keywords: ['di choi', 'dao pho', 'hang ngay', 'casual'] },
    { id: 'party', label: 'd\u1ef1 ti\u1ec7c', searchPhrase: 'du tiec', keywords: ['du tiec', 'party', 'su kien', 'dam cuoi', 'cuoi hoi'] },
    { id: 'sport', label: 'th\u1ec3 thao', searchPhrase: 'the thao', keywords: ['the thao', 'tap gym', 'chay bo', 'workout'] }
];

const CHAT_CATEGORY_RULES = [
    { id: 'shirt', family: 'top', generic: true, label: '\u00e1o', searchPhrase: 'ao', keywords: ['ao'] },
    { id: 'croptop', family: 'top', generic: false, label: '\u00e1o croptop', searchPhrase: 'ao croptop', keywords: ['ao croptop', 'croptop', 'crop top'] },
    { id: 'shirt-office', family: 'top', generic: false, label: '\u00e1o s\u01a1 mi', searchPhrase: 'ao so mi', keywords: ['ao so mi', 'so mi', 'shirt', 'oxford'] },
    { id: 'shirt-polo', family: 'top', generic: false, label: '\u00e1o polo', searchPhrase: 'ao polo', keywords: ['ao polo', 'polo'] },
    { id: 'shirt-tee', family: 'top', generic: false, label: '\u00e1o thun', searchPhrase: 'ao thun', keywords: ['ao thun', 'thun', 't-shirt', 'tee'] },
    { id: 'hoodie', family: 'top', generic: false, label: 'hoodie', searchPhrase: 'hoodie', keywords: ['hoodie'] },
    { id: 'jacket', family: 'top', generic: false, label: '\u00e1o kho\u00e1c', searchPhrase: 'ao khoac', keywords: ['ao khoac', 'khoac', 'jacket', 'blazer'] },
    { id: 'pants', family: 'bottom', generic: true, label: 'qu\u1ea7n', searchPhrase: 'quan', keywords: ['quan', 'pants', 'trousers'] },
    { id: 'jeans', family: 'bottom', generic: false, label: 'qu\u1ea7n jeans', searchPhrase: 'quan jeans', keywords: ['quan jeans', 'jeans', 'denim'] },
    { id: 'kaki', family: 'bottom', generic: false, label: 'qu\u1ea7n kaki', searchPhrase: 'quan kaki', keywords: ['quan kaki', 'kaki'] },
    { id: 'dress', family: 'dress', generic: false, label: '\u0111\u1ea7m', searchPhrase: 'dam', keywords: ['dam', 'maxi', 'dress'] },
    { id: 'skirt', family: 'dress', generic: false, label: 'v\u00e1y', searchPhrase: 'vay', keywords: ['vay', 'chan vay', 'skirt'] }
];

const CHAT_COLOR_RULES = [
    { id: 'yellow', label: 'v\u00e0ng', searchPhrase: 'vang', keywords: ['mau vang', 'vang', 'yellow'] },
    { id: 'black', label: '\u0111en', searchPhrase: 'den', keywords: ['mau den', 'den', 'black'] },
    { id: 'white', label: 'tr\u1eafng', searchPhrase: 'trang', keywords: ['mau trang', 'trang', 'white'] },
    { id: 'blue', label: 'xanh', searchPhrase: 'xanh', keywords: ['mau xanh', 'xanh', 'xanh duong', 'xanh bien', 'blue'] },
    { id: 'green', label: 'xanh l\u00e1', searchPhrase: 'xanh la', keywords: ['mau xanh la', 'xanh la', 'xanh reu', 'green'] },
    { id: 'pink', label: 'h\u1ed3ng', searchPhrase: 'hong', keywords: ['mau hong', 'hong', 'pink'] },
    { id: 'gray', label: 'x\u00e1m', searchPhrase: 'xam', keywords: ['mau xam', 'xam', 'ghi', 'gray', 'grey'] },
    { id: 'brown', label: 'n\u00e2u', searchPhrase: 'nau', keywords: ['mau nau', 'nau', 'brown'] },
    { id: 'beige', label: 'be/kem', searchPhrase: 'kem', keywords: ['mau kem', 'kem', 'be', 'beige', 'cream'] },
    { id: 'orange', label: 'cam', searchPhrase: 'cam', keywords: ['mau cam', 'cam', 'orange'] },
    { id: 'red', label: '\u0111\u1ecf', searchPhrase: 'do', keywords: ['mau do', 'ao do', 'quan do', 'vay do', 'dam do', 'red'] },
    { id: 'purple', label: 't\u00edm', searchPhrase: 'tim', keywords: ['mau tim', 'ao tim', 'quan tim', 'vay tim', 'dam tim', 'purple'] }
];

const CHAT_STOP_WORDS = new Set([
    'shop', 'minh', 'toi', 'cho', 'voi', 'can', 'muon', 'tim', 'goi', 'y', 'giup',
    'tu', 'van', 'san', 'pham', 'loai', 'cua', 'nay', 'kia', 'dep', 'mac', 'mua',
    'mot', 'nhung', 'dang', 'roi', 'nhe', 'a', 'ah', 'ha', 'nua', 'tam', 'khoang',
    'duoi', 'tren', 'tu', 'den', 'ban', 'de', 'xuat', 'cac', 'trong', 'gia',
    'neu', 'ko', 'khong', 'du', 'thi', 'co', 'the', 'chiec', 'danh', 'item', 'top'
]);

const CHAT_GREETING_TOKENS = new Set([
    'xin', 'chao', 'hello', 'hi', 'hey', 'alo', 'shop', 'oi', 'ad', 'admin',
    'em', 'anh', 'chi', 'ban', 'nhe', 'nha', 'a', 'ah', 'ha'
]);

const CHAT_PRODUCT_LINK_PATTERN = /(?:https?:\/\/|www\.|\/products\/)/i;

function normalizeChatText(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .toLowerCase()
        .trim();
}

function formatChatCurrency(value) {
    return `${Number(value || 0).toLocaleString('vi-VN')}đ`;
}

function getChatProductPath(product) {
    return product?.slug ? `/products/${product.slug}` : '';
}

function dedupeChatProducts(products = []) {
    const seen = new Set();

    return products.filter((product) => {
        const key = product?.slug || product?.id;
        if (!key || seen.has(key)) {
            return false;
        }

        seen.add(key);
        return true;
    });
}

function buildChatProductContext(title, products = []) {
    if (!products.length) {
        return '';
    }

    return `\n\n${title}:\n${products.map((product) => {
        const price = formatChatCurrency(product.final_price || product.price);
        const originalPrice = Number(product.price || 0);
        const finalPrice = Number(product.final_price || product.price || 0);
        const priceStr = (finalPrice < originalPrice)
            ? `${formatChatCurrency(finalPrice)} (giam tu ${formatChatCurrency(originalPrice)})`
            : formatChatCurrency(finalPrice);
        const stock = Number(product.stock_quantity || 0);
        const colors = String(product.variant_colors || '').trim();
        const sizes = String(product.variant_sizes || '').trim();
        const reason = product.chat_reason ? ` | Phu hop: ${product.chat_reason}` : '';
        const colorStr = colors ? ` | Mau: ${colors}` : '';
        const sizeStr = sizes ? ` | Size: ${sizes}` : '';
        return `- ${product.name} | Gia: ${priceStr} | Ton kho: ${stock}${colorStr}${sizeStr}${reason} | Link: ${getChatProductPath(product)}`;
    }).join('\n')}`;
}

function buildChatKnowledgeContext(title, chunks = []) {
    if (!chunks.length) {
        return '';
    }

    return `\n\n${title}:\n${chunks.map((chunk) => {
        const heading = chunk?.title ? `${chunk.title}: ` : '';
        return `- ${heading}${chunk.content}`;
    }).join('\n')}`;
}

function buildChatSuggestionBlock(products = []) {
    if (!products.length) {
        return '';
    }

    return `G\u1ee3i \u00fd ph\u00f9 h\u1ee3p:\n${products.map((product) => {
        const price = formatChatCurrency(product.final_price || product.price);
        const reason = product.chat_reason ? `, ${product.chat_reason}` : '';
        return `- ${product.name} (${price}${reason}): ${getChatProductPath(product)}`;
    }).join('\n')}`;
}

function calculateChatDiscountPercent(product) {
    const basePrice = Number(product?.price || 0);
    const finalPrice = Number(product?.final_price || product?.price || 0);

    if (!basePrice || finalPrice >= basePrice) {
        return 0;
    }

    return Math.max(0, Math.round(((basePrice - finalPrice) / basePrice) * 100));
}

function serializeChatProductCards(products = []) {
    return products.map((product) => ({
        id: product.id,
        name: product.name,
        slug: product.slug,
        url: getChatProductPath(product),
        subtitle: product.category_name || 'WIND OF FALL',
        image: Product.getOptimizedCardImageUrl(product.card_image || product.primary_image),
        price: Number(product.price || 0),
        final_price: Number(product.final_price || product.price || 0),
        discount_percent: calculateChatDiscountPercent(product),
        reason: product.chat_reason || ''
    })).filter((product) => product.name && product.url);
}

function buildChatAttachmentMetadata(mediaItems = []) {
    return mediaItems.map((media, index) => ({
        mediaType: media.mediaType || media.media_type || 'image',
        mediaUrl: media.mediaUrl || media.media_url || '',
        publicId: media.publicId || media.public_id || null,
        mimeType: media.mimeType || media.mime_type || null,
        originalName: media.originalName || media.original_name || null,
        width: Number(media.width) || null,
        height: Number(media.height) || null,
        bytes: Number(media.bytes) || 0,
        format: media.format || null,
        displayOrder: Number.isInteger(Number(media.displayOrder ?? media.display_order))
            ? Number(media.displayOrder ?? media.display_order)
            : index
    })).filter((media) => media.mediaUrl);
}

function buildChatMessageType(messageText, metadata = {}) {
    const hasMessage = Boolean(normalizeMessage(messageText));
    const hasProducts = Array.isArray(metadata.products) && metadata.products.length > 0;
    const hasAttachments = Array.isArray(metadata.attachments) && metadata.attachments.length > 0;

    if (hasProducts) {
        return 'product_cards';
    }

    if (hasAttachments) {
        return 'media';
    }

    return hasMessage ? 'text' : 'media';
}

function buildChatMessageMetadata({ attachments = [], products = [] } = {}) {
    const normalizedAttachments = buildChatAttachmentMetadata(attachments);
    const normalizedProducts = serializeChatProductCards(products);

    if (!normalizedAttachments.length && !normalizedProducts.length) {
        return null;
    }

    return {
        attachments: normalizedAttachments,
        products: normalizedProducts
    };
}

function getFirstChatImageAttachment(mediaItems = []) {
    return (Array.isArray(mediaItems) ? mediaItems : []).find((media) => (media.mediaType || media.media_type) === 'image') || null;
}

function buildMediaAnalysisMessage(userMessage, imageAnalysis) {
    const baseMessage = normalizeMessage(userMessage);
    const analysisParts = [];

    if (imageAnalysis?.description) {
        analysisParts.push(`Mo ta tu anh: ${imageAnalysis.description}`);
    }

    if (imageAnalysis?.searchQuery) {
        analysisParts.push(`Tu khoa tim kiem: ${imageAnalysis.searchQuery}`);
    }

    if (!baseMessage && !analysisParts.length) {
        return '';
    }

    if (!analysisParts.length) {
        return baseMessage;
    }

    return [baseMessage, analysisParts.join('. ')].filter(Boolean).join('\n');
}

function buildMediaOnlyFallbackReply(mediaItems = []) {
    const hasImage = mediaItems.some((media) => (media.mediaType || media.media_type) === 'image');

    if (hasImage) {
        return 'Mình đã nhận ảnh của bạn. Bạn có thể nói thêm màu sắc, kiểu dáng hoặc ngân sách để mình lọc sản phẩm sát hơn.';
    }

    return 'Mình đã nhận media của bạn. Hiện mình đối sánh tốt nhất với ảnh sản phẩm, nên bạn có thể gửi thêm ảnh rõ món đồ hoặc mô tả ngắn để mình gợi ý chính xác hơn.';
}

function buildGreetingChatReply() {
    return {
        text: 'Xin chào! Mình là trợ lý AI của WIND OF FALL. Bạn muốn xem sản phẩm, hỏi size màu, hay cần hỗ trợ về đơn hàng để mình trả lời nhanh nhé?',
        messageType: 'text',
        metadata: null
    };
}

function isCapabilityQuestion(normalizedMessage) {
    if (!normalizedMessage) {
        return false;
    }

    return [
        'ban la ai',
        'ban la gi',
        'co the lam gi',
        'lam duoc gi',
        'ho tro duoc gi',
        'ho tro gi',
        'giup duoc gi',
        'chuc nang gi',
        'co the giup gi'
    ].some((phrase) => includesChatPhrase(normalizedMessage, phrase));
}

function buildCapabilityChatReply() {
    return {
        text: 'Mình là trợ lý AI của WIND OF FALL. Mình có thể gợi ý sản phẩm theo nhu cầu, màu, size, ngân sách; hỗ trợ tìm mẫu gần đúng từ ảnh; và trả lời các thông tin cơ bản như thanh toán COD/VNPay/MoMo hoặc giao hàng toàn quốc. Nếu bạn cần xử lý sâu hơn về đơn hàng hay tình huống đặc biệt thì admin sẽ hỗ trợ thêm.',
        messageType: 'text',
        metadata: null
    };
}

function isSimpleCatalogQuestion(normalizedMessage) {
    if (!normalizedMessage) {
        return false;
    }

    return /\bco\b.*\bkhong\b/.test(normalizedMessage)
        || includesChatPhrase(normalizedMessage, 'con khong')
        || includesChatPhrase(normalizedMessage, 'co mau nao')
        || includesChatPhrase(normalizedMessage, 'xem mau')
        || includesChatPhrase(normalizedMessage, 'co san pham nao');
}

function shouldUseLocalCatalogReply(normalizedMessage, intent) {
    if (!normalizedMessage || !intent) {
        return false;
    }

    const hasSupportIntent = CHAT_SUPPORT_KEYWORDS.some((keyword) => includesChatPhrase(normalizedMessage, keyword));
    if (hasSupportIntent) {
        return false;
    }

    if (!shouldChatSuggestProducts(intent) || !canChatDirectlySuggestProducts(intent)) {
        return false;
    }

    return isSimpleCatalogQuestion(normalizedMessage)
        || includesChatPhrase(normalizedMessage, 'tim')
        || includesChatPhrase(normalizedMessage, 'goi y')
        || includesChatPhrase(normalizedMessage, 'de xuat')
        || includesChatPhrase(normalizedMessage, 'tu van')
        || includesChatPhrase(normalizedMessage, 'xem');
}

function isChatImageSearchIntent(normalizedMessage) {
    if (!normalizedMessage) {
        return false;
    }

    const hasImageHint = CHAT_IMAGE_SEARCH_HINTS.some((phrase) => includesChatPhrase(normalizedMessage, phrase));
    if (!hasImageHint) {
        return false;
    }

    return CHAT_IMAGE_SEARCH_ACTIONS.some((phrase) => includesChatPhrase(normalizedMessage, phrase))
        || CHAT_PRODUCT_KEYWORDS.some((phrase) => includesChatPhrase(normalizedMessage, phrase));
}

function hasExplicitImageProductSearchAction(normalizedMessage) {
    if (!normalizedMessage) {
        return false;
    }

    return [
        'tim',
        'tim kiem',
        'tim san pham',
        'goi y',
        'de xuat',
        'tuong tu',
        'giong nay',
        'giong anh',
        'giong hinh',
        'giong mau nay',
        'mau tuong tu',
        'xem mau',
        'shop co',
        'con mau',
        'link',
        'mua',
        'dat hang'
    ].some((phrase) => includesChatPhrase(normalizedMessage, phrase))
        || /\bco\b.*\b(?:mau|san pham|ao|quan|dam|vay|hang|mon|cai)\b.*\b(?:khong|ko|k)\b/.test(normalizedMessage);
}

function isImageInformationOnlyRequest(normalizedMessage) {
    if (!normalizedMessage) {
        return false;
    }

    return [
        'biet gi',
        'san pham nay la gi',
        'day la gi',
        'la mau gi',
        'loai gi',
        'kieu gi',
        'form gi',
        'chat lieu gi',
        'mo ta',
        'thong tin',
        'nhan xet',
        'danh gia',
        'tu van ve san pham nay'
    ].some((phrase) => includesChatPhrase(normalizedMessage, phrase));
}

function shouldSuggestProductsForImageRequest(normalizedMessage, hasImageAttachment) {
    if (!hasImageAttachment) {
        return false;
    }

    if (!normalizedMessage) {
        return true;
    }

    const hasExplicitSearchAction = hasExplicitImageProductSearchAction(normalizedMessage);
    if (isImageInformationOnlyRequest(normalizedMessage) && !hasExplicitSearchAction) {
        return false;
    }

    return hasExplicitSearchAction;
}

function buildChatImageSearchQuickReply(normalizedMessage, uploadedMedia = []) {
    if (uploadedMedia.length > 0 || !isChatImageSearchIntent(normalizedMessage)) {
        return null;
    }

    return {
        text: 'Duoc nhe. Ban cu gui anh san pham ngay trong o chat, minh se dua tren hinh anh de tim cac mau tuong dong. Neu co them mo ta nhu mau sac, kieu dang hoac ngan sach thi ket qua se sat hon.',
        messageType: 'text',
        metadata: null
    };
}

function isGreetingOnlyMessage(normalizedMessage) {
    const cleaned = String(normalizedMessage || '')
        .replace(/[!?.,]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    if (!cleaned) {
        return false;
    }

    const tokens = cleaned.split(' ').filter(Boolean);
    return tokens.length > 0 && tokens.every((token) => CHAT_GREETING_TOKENS.has(token));
}

function escapeChatRegex(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function includesChatPhrase(text, phrase) {
    const haystack = normalizeChatText(text);
    const needle = normalizeChatText(phrase);

    if (!haystack || !needle) {
        return false;
    }

    if (needle.includes(' ')) {
        return haystack.includes(needle);
    }

    return new RegExp(`(^|[^a-z0-9])${escapeChatRegex(needle)}([^a-z0-9]|$)`).test(haystack);
}

function getAiRequestTimeoutMs() {
    return Math.max(3000, Number.parseInt(process.env.AI_FETCH_TIMEOUT_MS, 10) || 8000);
}

function detectChatRule(normalizedMessage, rules = []) {
    return rules.find((rule) => rule.keywords.some((keyword) => includesChatPhrase(normalizedMessage, keyword))) || null;
}

function detectChatCategories(normalizedMessage) {
    const matches = CHAT_CATEGORY_RULES.filter((rule) =>
        rule.keywords.some((keyword) => includesChatPhrase(normalizedMessage, keyword))
    );

    return matches.filter((rule) => {
        if (!rule.generic) {
            return true;
        }

        return !matches.some((item) => item.family === rule.family && item.id !== rule.id && !item.generic);
    });
}

function parseChatMoneyAmount(rawAmount, rawUnit) {
    if (!rawAmount) {
        return null;
    }

    const amountText = String(rawAmount).trim();
    let normalizedAmount = amountText;

    if (amountText.includes(',') && amountText.includes('.')) {
        normalizedAmount = amountText.replace(/\./g, '').replace(',', '.');
    } else if (amountText.includes(',')) {
        normalizedAmount = amountText.replace(',', '.');
    } else if (amountText.includes('.')) {
        const decimalLike = /^\d+\.\d{1,2}$/.test(amountText);
        normalizedAmount = decimalLike ? amountText : amountText.replace(/\./g, '');
    }

    const amount = Number.parseFloat(normalizedAmount);
    if (!Number.isFinite(amount)) {
        return null;
    }

    const unit = normalizeChatText(rawUnit);
    if (unit === 'm' || unit.includes('tr')) {
        return Math.round(amount * 1000000);
    }

    if (unit.includes('k') || unit.includes('nghin') || unit.includes('ngan')) {
        return Math.round(amount * 1000);
    }

    if (amount >= 1000) {
        return Math.round(amount);
    }

    // In chat budget shorthand, users often omit "k" for ranges like 300-500.
    if (!unit && amount >= 100 && amount < 1000) {
        return Math.round(amount * 1000);
    }

    return null;
}

function parseChatBudget(normalizedMessage) {
    if (!normalizedMessage) {
        return null;
    }

    const rangeMatch = normalizedMessage.match(/(\d+(?:[.,]\d+)?)\s*(trieu|tr|m|k|nghin|ngan)?\s*(?:->|–|-|den|toi|tới|đến)\s*(\d+(?:[.,]\d+)?)\s*(trieu|tr|m|k|nghin|ngan)?/);
    if (rangeMatch) {
        const first = parseChatMoneyAmount(rangeMatch[1], rangeMatch[2]);
        const second = parseChatMoneyAmount(rangeMatch[3], rangeMatch[4] || rangeMatch[2]);
        if (first && second) {
            return {
                kind: 'range',
                minPrice: Math.min(first, second),
                maxPrice: Math.max(first, second),
                targetPrice: Math.round((first + second) / 2),
                label: `${formatChatCurrency(Math.min(first, second))} - ${formatChatCurrency(Math.max(first, second))}`
            };
        }
    }

    const maxMatch = normalizedMessage.match(/(?:duoi|toi da|khong qua|re hon|nho hon|<=)\s*(\d+(?:[.,]\d+)?)\s*(trieu|tr|m|k|nghin|ngan)?/);
    if (maxMatch) {
        const maxPrice = parseChatMoneyAmount(maxMatch[1], maxMatch[2]);
        if (maxPrice) {
            return {
                kind: 'max',
                minPrice: null,
                maxPrice,
                targetPrice: maxPrice,
                label: `d\u01b0\u1edbi ${formatChatCurrency(maxPrice)}`
            };
        }
    }

    const minMatch = normalizedMessage.match(/(?:tren|tu|it nhat|>=)\s*(\d+(?:[.,]\d+)?)\s*(trieu|tr|m|k|nghin|ngan)?/);
    if (minMatch) {
        const minPrice = parseChatMoneyAmount(minMatch[1], minMatch[2]);
        if (minPrice) {
            return {
                kind: 'min',
                minPrice,
                maxPrice: null,
                targetPrice: minPrice,
                label: `t\u1eeb ${formatChatCurrency(minPrice)}`
            };
        }
    }

    const targetMatch = normalizedMessage.match(/(?:tam|khoang|gan|quanh)\s*(\d+(?:[.,]\d+)?)\s*(trieu|tr|m|k|nghin|ngan)?/);
    if (targetMatch) {
        const targetPrice = parseChatMoneyAmount(targetMatch[1], targetMatch[2]);
        if (targetPrice) {
            return {
                kind: 'target',
                minPrice: Math.round(targetPrice * 0.8),
                maxPrice: Math.round(targetPrice * 1.2),
                targetPrice,
                label: `t\u1ea7m ${formatChatCurrency(targetPrice)}`
            };
        }
    }

    return null;
}

function extractChatTerms(normalizedMessage) {
    return normalizedMessage
        .split(/\s+/)
        .map((term) => term.trim())
        .filter((term) =>
            term.length >= 2 &&
            !CHAT_STOP_WORDS.has(term) &&
            !/^\d/.test(term) &&
            !['tr', 'trieu', 'k', 'nghin', 'ngan'].includes(term)
        );
}

function detectChatColors(normalizedMessage) {
    if (!normalizedMessage) {
        return [];
    }

    return CHAT_COLOR_RULES.filter((color) =>
        color.keywords.some((keyword) => includesChatPhrase(normalizedMessage, keyword))
    );
}

function getChatRequestedProductLimit(userMessage, fallbackLimit = 6) {
    const normalizedMessage = normalizeChatText(userMessage);
    const requestPattern = /\b(?:goi y|de xuat|tu van|chon|liet ke|show|tim|tim kiem|xem|cho)\b/;
    const quantityPattern = /\b(\d{1,2})\s+(?:(?:chiec|cai|bo|mau|item|mon)\s+)?(?:san pham|ao|quan|dam|vay|set|combo|look)\b/;
    const match = normalizedMessage.match(quantityPattern);

    if (!match || !requestPattern.test(normalizedMessage)) {
        return fallbackLimit;
    }

    return Math.max(1, Math.min(10, Number.parseInt(match[1], 10) || fallbackLimit));
}

function getChatMatchedColors(product, intent) {
    if (!Array.isArray(intent?.colors) || !intent.colors.length) {
        return [];
    }

    const productColorText = normalizeChatText([
        product?.variant_colors,
        product?.name,
        product?.description
    ].filter(Boolean).join(' '));

    return intent.colors.filter((color) => includesChatPhrase(productColorText, color.searchPhrase));
}

function hasChatColorMatch(product, intent) {
    return getChatMatchedColors(product, intent).length > 0;
}

function buildChatSearchQueries(intent, userMessage) {
    const queries = [];
    const compactTokens = [];

    intent.categories.forEach((category) => compactTokens.push(category.searchPhrase));
    if (intent.gender) {
        compactTokens.push(intent.gender.searchPhrase);
    }
    intent.colors.forEach((color) => compactTokens.push(color.searchPhrase));
    if (intent.occasion) {
        compactTokens.push(intent.occasion.searchPhrase);
    }

    intent.focusTerms.slice(0, 4).forEach((term) => compactTokens.push(term));

    const compactQuery = Array.from(new Set(compactTokens.filter(Boolean))).join(' ').trim();
    if (compactQuery) {
        queries.push(compactQuery);
    }

    if (intent.categories[0] && intent.gender) {
        queries.push(`${intent.categories[0].searchPhrase} ${intent.gender.searchPhrase}`.trim());
    }

    if (intent.categories[0] && intent.colors[0]) {
        queries.push(`${intent.categories[0].searchPhrase} ${intent.colors[0].searchPhrase}`.trim());
    }

    if (typeof userMessage === 'string' && userMessage.trim()) {
        queries.push(userMessage.trim());
    }

    return Array.from(new Set(queries.filter(Boolean)));
}

function inferChatAudience(productText) {
    if (includesChatPhrase(productText, 'tre em') || includesChatPhrase(productText, 'be trai') || includesChatPhrase(productText, 'be gai')) {
        return 'kids';
    }

    if (includesChatPhrase(productText, 'nu')) {
        return 'female';
    }

    if (includesChatPhrase(productText, 'nam')) {
        return 'male';
    }

    return 'neutral';
}

function buildChatIntent(userMessage, options = {}) {
    const normalizedMessage = normalizeChatText(userMessage);
    const gender = detectChatRule(normalizedMessage, CHAT_GENDER_RULES);
    const occasion = detectChatRule(normalizedMessage, CHAT_OCCASION_RULES);
    const categories = detectChatCategories(normalizedMessage);
    const colors = detectChatColors(normalizedMessage);
    const budget = parseChatBudget(normalizedMessage);
    const focusTerms = extractChatTerms(normalizedMessage);
    const imageGuided = Boolean(options.forceImageGuided)
        || includesChatPhrase(normalizedMessage, 'mo ta tu anh')
        || includesChatPhrase(normalizedMessage, 'tu khoa tim kiem');

    const intent = {
        normalizedMessage,
        gender,
        occasion,
        categories,
        colors,
        budget,
        focusTerms,
        imageGuided
    };

    intent.searchQueries = buildChatSearchQueries(intent, userMessage);
    return intent;
}

function getLastChatIntentValue(intents, selector) {
    for (let index = intents.length - 1; index >= 0; index -= 1) {
        const value = selector(intents[index]);
        if (Array.isArray(value)) {
            if (value.length) {
                return value;
            }
            continue;
        }

        if (value) {
            return value;
        }
    }

    return null;
}

function mergeChatFocusTerms(primaryTerms = [], fallbackTerms = []) {
    return Array.from(new Set([...(primaryTerms || []), ...(fallbackTerms || [])])).slice(0, 8);
}

function buildChatIntentFromContext(messages = [], userMessage = '', options = {}) {
    const currentIntent = buildChatIntent(userMessage, options);
    const shouldCarryPriorGender = !options.forceImageGuided;
    const priorCustomerIntents = Array.isArray(messages)
        ? messages
            .filter((message) => message && message.sender_type === 'customer' && typeof message.message === 'string')
            .slice(-8)
            .map((message) => buildChatIntent(message.message))
        : [];

    const mergedIntent = {
        normalizedMessage: currentIntent.normalizedMessage,
        gender: currentIntent.gender || (shouldCarryPriorGender
            ? getLastChatIntentValue(priorCustomerIntents, (intent) => intent.gender)
            : null),
        occasion: currentIntent.occasion || getLastChatIntentValue(priorCustomerIntents, (intent) => intent.occasion),
        categories: currentIntent.categories.length
            ? currentIntent.categories
            : (getLastChatIntentValue(priorCustomerIntents, (intent) => intent.categories) || []),
        colors: currentIntent.colors.length
            ? currentIntent.colors
            : (getLastChatIntentValue(priorCustomerIntents, (intent) => intent.colors) || []),
        budget: currentIntent.budget || getLastChatIntentValue(priorCustomerIntents, (intent) => intent.budget),
        focusTerms: mergeChatFocusTerms(
            currentIntent.focusTerms,
            getLastChatIntentValue(priorCustomerIntents, (intent) => intent.focusTerms) || []
        ),
        imageGuided: currentIntent.imageGuided || Boolean(getLastChatIntentValue(priorCustomerIntents, (intent) => intent.imageGuided))
    };

    mergedIntent.searchQueries = buildChatSearchQueries(mergedIntent, userMessage);
    mergedIntent.currentIntent = currentIntent;
    return mergedIntent;
}

function hasChatContextualSuggestionSignals(intent) {
    let signalCount = 0;

    if (intent?.gender) {
        signalCount += 1;
    }

    if (intent?.occasion) {
        signalCount += 1;
    }

    if (intent?.budget) {
        signalCount += 1;
    }

    return signalCount >= 2;
}

function hasSpecificChatCategory(intent) {
    return Array.isArray(intent?.categories) && intent.categories.some((category) => !category.generic);
}

function hasGenericChatCategoryWithContext(intent) {
    if (!Array.isArray(intent?.categories) || !intent.categories.some((category) => category.generic)) {
        return false;
    }

    return Boolean(intent.gender)
        || Boolean(intent.occasion)
        || Boolean(intent.budget)
        || (Array.isArray(intent.colors) && intent.colors.length > 0);
}

function canChatDirectlySuggestProducts(intent) {
    return hasSpecificChatCategory(intent)
        || hasGenericChatCategoryWithContext(intent)
        || hasChatContextualSuggestionSignals(intent);
}

function buildChatIntentSummary(intent) {
    const parts = [];

    if (intent.gender) {
        parts.push(`gioi tinh/doi tuong: ${intent.gender.label}`);
    }
    if (intent.categories.length) {
        parts.push(`loai san pham: ${intent.categories.map((item) => item.label).join(', ')}`);
    }
    if (intent.colors.length) {
        parts.push(`mau uu tien: ${intent.colors.map((item) => item.label).join(', ')}`);
    }
    if (intent.occasion) {
        parts.push(`muc dich mac: ${intent.occasion.label}`);
    }
    if (intent.budget?.label) {
        parts.push(`ngan sach: ${intent.budget.label}`);
    }

    return parts.length ? `\n\nNhu cau khach hien tai:\n- ${parts.join('\n- ')}` : '';
}

function describeChatNeed(intent) {
    const parts = [];

    if (Array.isArray(intent?.categories) && intent.categories.length) {
        parts.push(intent.categories.map((item) => item.label).join(', '));
    }

    if (intent?.gender?.label) {
        parts.push(intent.gender.label);
    }

    if (Array.isArray(intent?.colors) && intent.colors.length) {
        parts.push(`màu ${intent.colors.map((item) => item.label).join(', ')}`);
    }

    if (intent?.occasion?.label) {
        parts.push(`mặc ${intent.occasion.label}`);
    }

    if (intent?.budget?.label) {
        parts.push(intent.budget.label);
    }

    return parts.length ? parts.join(' ') : 'nhu cầu của bạn';
}

function buildLocalCatalogReply(intent, suggestedProducts = []) {
    if (!Array.isArray(suggestedProducts) || !suggestedProducts.length) {
        return {
            text: `Mình chưa thấy mẫu thật sự khớp với ${describeChatNeed(intent)} trong catalog hiện tại. Bạn nói thêm form, chất liệu hoặc ngân sách để mình lọc sát hơn nhé.`,
            messageType: 'text',
            metadata: null
        };
    }

    const text = suggestedProducts.length === 1
        ? `Mình thấy hiện shop có 1 mẫu khá khớp với ${describeChatNeed(intent)}. Mình gửi bạn ngay bên dưới để xem nhanh nhé.`
        : `Mình đã lọc được ${suggestedProducts.length} mẫu khá khớp với ${describeChatNeed(intent)}. Mình gửi bạn ngay bên dưới để bạn so sánh nhanh nhé.`;

    return {
        text,
        messageType: buildChatMessageType(text, { products: suggestedProducts }),
        metadata: buildChatMessageMetadata({ products: suggestedProducts })
    };
}

function shouldUseFastImageProductFlow(normalizedMessage, hasImageAttachment) {
    if (!hasImageAttachment || !productVisualEmbeddingService.hasVisualEmbeddingCredentials()) {
        return false;
    }

    const hasSupportIntent = CHAT_SUPPORT_KEYWORDS.some((keyword) => includesChatPhrase(normalizedMessage, keyword));
    if (hasSupportIntent) {
        return false;
    }

    return shouldSuggestProductsForImageRequest(normalizedMessage, hasImageAttachment);
}

function describeImageSearchNeed(intent, imageAnalysis) {
    const description = String(imageAnalysis?.description || '').trim();
    if (description) {
        return description;
    }

    const intentNeed = describeChatNeed(intent);
    if (!intentNeed || normalizeChatText(intentNeed) === 'nhu cau cua ban') {
        return 'mẫu trong ảnh bạn gửi';
    }

    return intentNeed;
}

function buildLocalImageCatalogReply(intent, imageAnalysis, suggestedProducts = []) {
    const imageNeed = describeImageSearchNeed(intent, imageAnalysis);

    if (!Array.isArray(suggestedProducts) || !suggestedProducts.length) {
        const text = imageAnalysis?.description
            ? `Mình đã nhận ra đây là ${imageNeed.toLowerCase()}. Hiện shop chưa thấy mẫu thật sự gần trong catalog, nên mình chưa muốn gợi ý sai cho bạn. Bạn có thể gửi ảnh rõ hơn hoặc nói thêm màu, form dáng hay chất liệu nhé.`
            : 'Mình đã nhận ảnh và thử đối chiếu với catalog hiện tại nhưng chưa thấy mẫu thật sự gần. Bạn có thể gửi ảnh rõ hơn hoặc nói thêm loại đồ, màu sắc, form dáng để mình lọc sát hơn nhé.';

        return {
            text,
            messageType: 'text',
            metadata: null
        };
    }

    const text = imageAnalysis?.matchSummary
        || (suggestedProducts.length === 1
            ? `Dựa trên ảnh bạn gửi, mình thấy có 1 mẫu khá gần với ${imageNeed}. Mình gửi bạn ngay bên dưới để xem nhanh nhé.`
            : `Dựa trên ảnh bạn gửi, mình đã lọc được ${suggestedProducts.length} mẫu khá gần với ${imageNeed}. Mình gửi bạn ngay bên dưới để bạn so sánh nhanh nhé.`);

    return {
        text,
        messageType: buildChatMessageType(text, { products: suggestedProducts }),
        metadata: buildChatMessageMetadata({ products: suggestedProducts })
    };
}

async function fetchChatProducts(params = {}) {
    if (typeof Product.findAll === 'function') {
        return Product.findAll(params).catch(() => []);
    }
    if (typeof Product.getActiveChatCatalog === 'function') {
        return Product.getActiveChatCatalog().catch(() => []);
    }
    return [];
}

async function collectChatCandidateProducts(intent, userMessage, options = {}) {
    const desiredLimit = Number.parseInt(options.limit, 10) || 6;
    const fetchLimit = Math.max(30, desiredLimit * 5);

    const chatSearchBase = { accent_sensitive: false };
    const budgetParams = intent.budget
        ? {
            min_price: intent.budget.minPrice || undefined,
            max_price: intent.budget.maxPrice || undefined,
            use_final_price: true
        }
        : {};

    const searchQueries = intent.searchQueries.slice(0, 3);
    const specificQuery = searchQueries[0] || '';
    const broaderQueries = searchQueries.slice(1);

    // Query cụ thể nhất trước (vd "ao nu tre vai")
    const specificProducts = specificQuery
        ? await fetchChatProducts({
            search: specificQuery,
            ...chatSearchBase,
            ...budgetParams,
            sort_by: 'sold_count',
            sort_order: 'DESC',
            limit: fetchLimit
        }).catch(() => [])
        : [];

    // Chỉ query rộng hơn nếu query cụ thể không đủ kết quả
    let broaderProducts = [];
    if (specificProducts.length < desiredLimit * 2 && broaderQueries.length) {
        const broaderTasks = broaderQueries.map((query) =>
            fetchChatProducts({
                search: query,
                ...chatSearchBase,
                ...budgetParams,
                sort_by: 'sold_count',
                sort_order: 'DESC',
                limit: fetchLimit
            }).catch(() => [])
        );
        const broaderBuckets = await Promise.all(broaderTasks);
        broaderProducts = broaderBuckets.flat();
    }

    // Fallback không lọc giá khi budget hẹp quá
    let nobudgetProducts = [];
    const allProducts = dedupeChatProducts([...specificProducts, ...broaderProducts]);
    if (allProducts.length < desiredLimit && intent.budget) {
        nobudgetProducts = await fetchChatProducts({
            search: specificQuery || String(userMessage || '').trim(),
            ...chatSearchBase,
            sort_by: 'sold_count',
            sort_order: 'DESC',
            limit: fetchLimit
        }).catch(() => []);
    }

    return dedupeChatProducts([
        ...specificProducts,
        ...broaderProducts,
        ...nobudgetProducts
    ]);
}

function getChatProductText(product, options = {}) {
    const fields = [
        product?.name,
        product?.variant_colors,
        product?.variant_sizes,
        product?.category_name,
        product?.category_slug,
        product?.sku
    ];

    if (!options.strictCategory) {
        fields.splice(1, 0, product?.description);
    }

    return normalizeChatText(fields.filter(Boolean).join(' '));
}

function getChatCategoryKeywords(category, options = {}) {
    if (!options.strict || category.generic) {
        return category.keywords;
    }

    return Array.from(new Set([
        category.searchPhrase,
        ...category.keywords.filter((keyword) => keyword.includes(' ') || keyword.length >= 6)
    ]));
}

function getChatMatchedCategories(product, intent, options = {}) {
    const productText = getChatProductText(product, {
        strictCategory: Boolean(options.strict)
    });
    return intent.categories.filter((category) =>
        getChatCategoryKeywords(category, options).some((keyword) => includesChatPhrase(productText, keyword))
    );
}

function hasChatStrictCategoryIntent(intent) {
    return Array.isArray(intent?.categories) && intent.categories.some((category) => !category.generic);
}

function hasChatStrictCategoryMatch(product, intent) {
    return getChatMatchedCategories(product, intent, { strict: true }).some((category) => !category.generic);
}

function scoreChatCandidate(product, intent) {
    const productText = getChatProductText(product);
    const finalPrice = Number(product.final_price || product.price || 0);
    const soldCount = Number(product.sold_count || 0);
    const stock = Number(product.stock_quantity || 0);
    const reasons = [];
    let score = Math.min(12, soldCount / 10);

    if (stock > 0) {
        score += 8;
    } else {
        score -= 60;
    }

    const matchedCategory = getChatMatchedCategories(product, intent)[0] || null;
    if (matchedCategory) {
        score += 28;
        reasons.push(`h\u1ee3p ki\u1ec3u ${matchedCategory.label}`);
    } else if (intent.categories.length) {
        score -= intent.imageGuided && hasChatStrictCategoryIntent(intent) ? 40 : 12;
    }

    if (intent.gender) {
        const audience = inferChatAudience(productText);
        if (audience === intent.gender.id || (intent.gender.id === 'kids' && audience === 'kids')) {
            score += 18;
            reasons.push(`\u0111\u00fang nh\u00f3m ${intent.gender.label}`);
        } else if (audience !== 'neutral') {
            score -= 14;
        }
    }

    if (intent.occasion) {
        const officeCategoryMatch = intent.occasion.id === 'office' && matchedCategory && ['shirt-office', 'kaki', 'dress', 'skirt'].includes(matchedCategory.id);
        const casualCategoryMatch = intent.occasion.id === 'casual' && matchedCategory && ['shirt-tee', 'hoodie', 'jeans', 'pants'].includes(matchedCategory.id);
        const occasionMatched =
            officeCategoryMatch ||
            casualCategoryMatch ||
            intent.occasion.keywords.some((keyword) => includesChatPhrase(productText, keyword));
        if (occasionMatched) {
            score += 10;
            reasons.push(`h\u1ee3p ${intent.occasion.label}`);
        }
    }

    const matchedColors = getChatMatchedColors(product, intent);
    if (matchedColors.length) {
        score += 24;
        reasons.push(`c\u00f3 m\u00e0u ${matchedColors.map((color) => color.label).join(', ')}`);
    } else if (intent.colors.length) {
        score -= 28;
    }

    if (intent.budget && finalPrice > 0) {
        if (intent.budget.minPrice && intent.budget.maxPrice && finalPrice >= intent.budget.minPrice && finalPrice <= intent.budget.maxPrice) {
            score += 20;
            reasons.push(`trong ${intent.budget.label}`);
        } else if (intent.budget.maxPrice && !intent.budget.minPrice && finalPrice <= intent.budget.maxPrice) {
            score += 20;
            reasons.push(`trong ${intent.budget.label}`);
        } else if (intent.budget.minPrice && !intent.budget.maxPrice && finalPrice >= intent.budget.minPrice) {
            score += 12;
            reasons.push(`${intent.budget.label}`);
        } else if (intent.budget.targetPrice) {
            const ratio = Math.abs(finalPrice - intent.budget.targetPrice) / intent.budget.targetPrice;
            if (ratio <= 0.18) {
                score += 16;
                reasons.push(`g\u1ea7n ${intent.budget.label}`);
            } else if (ratio <= 0.35) {
                score += 6;
            } else {
                score -= Math.min(18, Math.round(ratio * 20));
            }
        }
    }

    const totalFocusTerms = intent.focusTerms.length;
    const termMatches = intent.focusTerms.reduce((count, term) => (
        includesChatPhrase(productText, term) ? count + 1 : count
    ), 0);
    const nameText = normalizeChatText((product?.name || '') + ' ' + (product?.category_name || ''));
    const nameTermMatches = intent.focusTerms.reduce((count, term) => (
        includesChatPhrase(nameText, term) ? count + 1 : count
    ), 0);
    score += nameTermMatches * 15;
    score += Math.min((termMatches - nameTermMatches) * 3, 12);
    if (totalFocusTerms > 0 && nameTermMatches === 0) {
        score -= 30;
    }

    if (product.sale_type) {
        score += 4;
    }

    return {
        score,
        reason: Array.from(new Set(reasons)).slice(0, 2).join(', ')
    };
}

function shouldChatSuggestProducts(intentOrMessage, messages = []) {
    const intent = typeof intentOrMessage === 'string'
        ? buildChatIntentFromContext(messages, intentOrMessage)
        : intentOrMessage;
    if (!intent.normalizedMessage) {
        return false;
    }

    if (isGreetingOnlyMessage(intent.normalizedMessage)) {
        return false;
    }

    const hasProductKeyword =
        intent.categories.length > 0 ||
        Boolean(intent.gender) ||
        Boolean(intent.occasion) ||
        Boolean(intent.budget) ||
        CHAT_PRODUCT_KEYWORDS.some((keyword) => includesChatPhrase(intent.normalizedMessage, keyword));
    const hasSupportKeyword = CHAT_SUPPORT_KEYWORDS.some((keyword) => includesChatPhrase(intent.normalizedMessage, keyword));

    if (hasSupportKeyword && !hasProductKeyword) {
        return false;
    }

    if (!hasProductKeyword) {
        return false;
    }

    return true;
}

function getChatAudienceMatch(product, intent) {
    if (!intent.gender) {
        return true;
    }

    const audience = inferChatAudience([
        product.name,
        product.description,
        product.category_name,
        product.category_slug,
        product.sku
    ].filter(Boolean).join(' '));

    if (audience === 'neutral') {
        return true;
    }

    return audience === intent.gender.id || (intent.gender.id === 'kids' && audience === 'kids');
}

function matchesChatColors(product, intent) {
    if (!Array.isArray(intent?.colors) || !intent.colors.length) {
        return true;
    }

    return hasChatColorMatch(product, intent);
}

function matchesChatBudget(product, intent) {
    if (!intent?.budget) {
        return true;
    }

    const finalPrice = Number(product.final_price || product.price || 0);
    if (finalPrice <= 0) {
        return false;
    }

    const { minPrice, maxPrice, targetPrice, kind } = intent.budget;

    if (kind === 'range' && minPrice && maxPrice) {
        return finalPrice >= minPrice && finalPrice <= maxPrice;
    }

    if (kind === 'max' && maxPrice) {
        return finalPrice <= maxPrice;
    }

    if (kind === 'min' && minPrice) {
        return finalPrice >= minPrice;
    }

    if (kind === 'target' && targetPrice) {
        const minTarget = Math.round(targetPrice * 0.8);
        const maxTarget = Math.round(targetPrice * 1.2);
        return finalPrice >= minTarget && finalPrice <= maxTarget;
    }

    return true;
}

function fuseVisualAndTextImageProducts(visualProducts, textProducts, intent, maxItems) {
    const cap = Math.max(Number(maxItems) || 6, 1);
    const tScores = new Map();
    textProducts.forEach((p, i) => {
        const denom = Math.max(textProducts.length, 1);
        tScores.set(p.id, 1 - (i / denom) * 0.9);
    });
    const vMap = new Map(visualProducts.map((p) => [p.id, p]));
    const ids = new Set([...vMap.keys(), ...textProducts.map((p) => p.id)]);

    const merged = [];
    ids.forEach((id) => {
        const vp = vMap.get(id);
        const tp = textProducts.find((p) => p.id === id);
        const product = vp || tp;
        if (!product) {
            return;
        }

        const v = vp ? Math.max(0, Math.min(1, Number(vp.visual_similarity || 0))) : 0;
        const t = tScores.has(id) ? tScores.get(id) : 0;
        let combined;
        if (v > 0 && t > 0) {
            combined = 0.55 * v + 0.45 * t;
        } else if (v > 0) {
            combined = v * 0.98;
        } else {
            combined = t * 0.72;
        }

        const chat_score = 40 + combined * 58;
        const ranking = scoreChatCandidate(product, intent);
        const chat_reason = v > 0.34
            ? 'gần với hình ảnh và tìm kiếm'
            : v > 0
                ? 'tương đồng hình ảnh'
                : ranking.reason;

        merged.push({
            ...product,
            chat_score,
            chat_reason
        });
    });

    return merged.sort((left, right) => right.chat_score - left.chat_score).slice(0, cap * 2);
}

function selectChatSuggestedProducts(products = [], intent, options = {}) {
    const maxItems = Number.parseInt(options.limit, 10) || 6;
    const ignoreBudget = Boolean(options.ignoreBudget);
    const usePresetScores = Boolean(options.usePresetScores);
    const rankedProducts = dedupeChatProducts(products)
        .map((product) => {
            if (usePresetScores && typeof product.chat_score === 'number') {
                return {
                    ...product,
                    chat_reason: product.chat_reason || 'goi y da ket hop'
                };
            }
            const ranking = scoreChatCandidate(product, intent);
            return {
                ...product,
                chat_reason: ranking.reason,
                chat_score: ranking.score
            };
        })
        .sort((left, right) => right.chat_score - left.chat_score);

    if (!rankedProducts.length) {
        return [];
    }

    let candidates = rankedProducts.filter((product) => Number(product.stock_quantity || 0) > 0);
    if (!candidates.length) {
        candidates = rankedProducts;
    }

    if (intent?.gender) {
        candidates = candidates.filter((product) => getChatAudienceMatch(product, intent));
        if (!candidates.length) {
            return [];
        }
    }

    if (hasChatStrictCategoryIntent(intent)) {
        candidates = candidates.filter((product) => hasChatStrictCategoryMatch(product, intent));
        if (!candidates.length) {
            return [];
        }
    }

    if (intent?.colors?.length) {
        candidates = candidates.filter((product) => matchesChatColors(product, intent));
        if (!candidates.length) {
            return [];
        }
    }

    if (intent?.focusTerms?.length > 0 && !options.skipFocusTermFilter) {
        const focusMatched = candidates.filter((product) => {
            const nameText = normalizeChatText((product?.name || '') + ' ' + (product?.category_name || ''));
            return intent.focusTerms.some((term) => includesChatPhrase(nameText, term));
        });
        if (focusMatched.length >= Math.min(maxItems, 2)) {
            candidates = focusMatched;
        }
    }

    if (!ignoreBudget && intent?.budget) {
        candidates = candidates.filter((product) => matchesChatBudget(product, intent));
        if (!candidates.length) {
            return [];
        }
    }

    return candidates.slice(0, maxItems);
}

async function getChatSuggestedProducts(userMessage, messages = [], options = {}) {
    const intent = buildChatIntentFromContext(messages, userMessage);
    const desiredLimit = Number.parseInt(options.limit, 10) || 6;

    if (!shouldChatSuggestProducts(intent) || !canChatDirectlySuggestProducts(intent)) {
        return [];
    }

    try {
        const candidates = await collectChatCandidateProducts(intent, userMessage, { limit: desiredLimit });
        return selectChatSuggestedProducts(candidates, intent, { limit: desiredLimit });
    } catch (error) {
        console.error('Chat suggestion lookup error:', error);
        return [];
    }
}

async function buildEnhancedChatSystemPrompt(messages, userMessage, flowOptions = {}) {
    let featuredContext = '';
    const forceImageGuided = Boolean(flowOptions.visualImageUrl);
    const allowImageProductSuggestions = forceImageGuided
        ? Boolean(flowOptions.allowImageProductSuggestions)
        : true;
    const intent = buildChatIntentFromContext(messages, userMessage, { forceImageGuided });
    const desiredProductLimit = getChatRequestedProductLimit(userMessage, 6);
    const hasSupportIntent = CHAT_SUPPORT_KEYWORDS.some((keyword) => includesChatPhrase(intent.normalizedMessage, keyword));
    const looksLikeImageProductSearch = !normalizeMessage(userMessage)
        || includesChatPhrase(intent.normalizedMessage, 'giong nay')
        || includesChatPhrase(intent.normalizedMessage, 'giong anh')
        || includesChatPhrase(intent.normalizedMessage, 'giong hinh')
        || includesChatPhrase(intent.normalizedMessage, 'giong mau nay')
        || includesChatPhrase(intent.normalizedMessage, 'san pham')
        || CHAT_PRODUCT_KEYWORDS.some((keyword) => includesChatPhrase(intent.normalizedMessage, keyword));
    const hasProductIntent = forceImageGuided && !allowImageProductSuggestions
        ? false
        : shouldChatSuggestProducts(intent)
            || (forceImageGuided && looksLikeImageProductSearch && !hasSupportIntent);
    const canDirectlySuggest = hasProductIntent
        && (canChatDirectlySuggestProducts(intent)
            || (intent.imageGuided && Boolean(flowOptions.visualImageUrl) && allowImageProductSuggestions));
    const visualImageUrl = flowOptions.visualImageUrl || null;
    let imageReferenceProducts = [];

    let visualFromEmbeddings = [];
    if (
        intent.imageGuided
        && canDirectlySuggest
        && visualImageUrl
        && productVisualEmbeddingService.hasVisualEmbeddingCredentials()
    ) {
        visualFromEmbeddings = await productVisualEmbeddingService
            .searchSimilarProductsByImageUrl(visualImageUrl, desiredProductLimit * 3)
            .catch((err) => {
                console.error('Visual embedding search error:', err.message || err);
                return [];
            });
    }

    const ragContext = (intent.imageGuided && visualFromEmbeddings.length)
        ? { products: [], knowledge: [] }
        : await retrieveChatRagContext(userMessage, {
            productLimit: desiredProductLimit,
            knowledgeLimit: 4
        }).catch((error) => {
            console.error('Chat RAG retrieval error:', error);
            return { products: [], knowledge: [] };
        });
    const ragSuggestedProducts = canDirectlySuggest
        ? selectChatSuggestedProducts(ragContext.products || [], intent, { limit: desiredProductLimit })
        : [];
    const searchSuggestedProducts = canDirectlySuggest
        ? await getChatSuggestedProducts(userMessage, messages, { limit: desiredProductLimit })
        : [];

    if (intent.imageGuided && canDirectlySuggest) {
        if (visualFromEmbeddings.length) {
            imageReferenceProducts = selectChatSuggestedProducts(visualFromEmbeddings, intent, {
                limit: 2,
                ignoreBudget: true,
                skipFocusTermFilter: true
            });
        } else {
            const imageCandidateProducts = dedupeChatProducts([
                ...(ragContext.products || []),
                ...(await collectChatCandidateProducts(intent, userMessage, { limit: desiredProductLimit }).catch(() => []))
            ]);

            imageReferenceProducts = selectChatSuggestedProducts(imageCandidateProducts, intent, {
                limit: 2,
                ignoreBudget: true
            });
        }
    }

    let suggestedProducts;
    if (intent.imageGuided && canDirectlySuggest && visualFromEmbeddings.length) {
        const textPool = dedupeChatProducts([
            ...(ragContext.products || []),
            ...ragSuggestedProducts,
            ...searchSuggestedProducts,
            ...(await collectChatCandidateProducts(intent, userMessage, { limit: desiredProductLimit }).catch(() => []))
        ]);
        const fused = fuseVisualAndTextImageProducts(
            visualFromEmbeddings,
            textPool,
            intent,
            desiredProductLimit
        );
        suggestedProducts = selectChatSuggestedProducts(fused, intent, {
            limit: desiredProductLimit,
            ignoreBudget: true,
            usePresetScores: true,
            skipFocusTermFilter: true
        });
    } else if (intent.imageGuided) {
        suggestedProducts = dedupeChatProducts([
            ...imageReferenceProducts,
            ...ragSuggestedProducts,
            ...searchSuggestedProducts
        ]).slice(0, desiredProductLimit);
    } else {
        suggestedProducts = selectChatSuggestedProducts(
            dedupeChatProducts([
                ...ragSuggestedProducts,
                ...searchSuggestedProducts
            ]),
            intent,
            { limit: desiredProductLimit }
        );
    }
    const shouldAskClarifyingQuestion = hasProductIntent && !canDirectlySuggest;

    if (!forceImageGuided && !hasProductIntent && !shouldAskClarifyingQuestion) {
        try {
            const bestSellers = await Product.getBestSellers(4);
            featuredContext = buildChatProductContext(
                'San pham noi bat hien co',
                dedupeChatProducts(bestSellers).slice(0, 4)
            );
        } catch (error) {
            console.error('Chat product context error:', error);
        }
    }

    const suggestedContext = buildChatProductContext(
        'San pham nen goi y cho nhu cau hien tai',
        suggestedProducts
    );
    const knowledgeContext = buildChatKnowledgeContext(
        'Nguon thong tin uu tien de tra loi',
        ragContext.knowledge || []
    );

    const prompt = `Ban la tro ly ban hang AI cua cua hang thoi trang "WIND OF FALL".
Nhiem vu: tu van san pham, ho tro mua hang va giai dap cau hoi co ban ve don hang.

Quy tac:
- Tra loi bang tieng Viet, than thien, ngan gon, toi da 4 cau chinh
- Khong bua thong tin ve gia, ton kho, chinh sach hay khuyen mai
- Chi tu van dua tren thong tin co trong ngu canh
- Neu gioi thieu san pham cu the, chi dung dung ten san pham co trong ngu canh
- Khong can liet ke link raw hay bullet link, he thong se tu render card san pham khi co goi y
- Khi da co muc "San pham nen goi y cho nhu cau hien tai", chi duoc phep nhac ten cac san pham trong danh sach do
- Neu khach hoi co ho tro tim san pham bang hinh anh hay khong, khang dinh la co va moi khach gui anh truc tiep trong khung chat
- Neu trong noi dung co cum "Mo ta tu anh" hoac "Tu khoa tim kiem", nghia la he thong da phan tich anh xong; khong duoc yeu cau khach gui anh lai
- Khi khach chi hoi thong tin, mo ta, nhan xet ve anh san pham, chi tu van bang text dua tren mo ta anh; khong noi da loc duoc san pham va khong tu goi y mau tuong tu
- Voi tim kiem bang anh, chi nen goi y cac san pham cung loai hoac rat gan; neu catalog khong co mau gan, noi ro la shop chua co mau phu hop thay vi dua ra san pham khong lien quan
- Khong mac dinh gioi tinh cua khach la nguoi se mac; neu khach chua noi ro mua cho ai, tu van trung lap hoac hoi lai 1 cau ngan
- Neu khach moi noi chung chung ma chua noi ro loai san pham hoac nhu cau, khong goi y san pham hay link ngay; hay hoi 1 cau lam ro ngan gon ve kieu do, phong cach, doi tuong mac hoac ngan sach
- Neu khach can ho tro sau hon, noi ro admin se ho tro them

Thong tin cua hang:
- Chuyen thoi trang nam nu
- Ho tro thanh toan: COD, VNPay, MoMo
- Giao hang toan quoc${knowledgeContext}${buildChatIntentSummary(intent)}${featuredContext}${suggestedContext}`;

    return {
        prompt,
        suggestedProducts,
        imageReferenceProducts,
        intent,
        hasProductIntent
    };
}

async function readJsonResponseSafely(response, label) {
    if (typeof response?.text !== 'function') {
        const data = typeof response?.json === 'function' ? await response.json() : null;
        return {
            data,
            rawText: data ? JSON.stringify(data) : ''
        };
    }

    const rawText = await response.text();

    if (!rawText) {
        return {
            data: null,
            rawText: ''
        };
    }

    try {
        return {
            data: JSON.parse(rawText),
            rawText
        };
    } catch (error) {
        console.error(`${label} invalid JSON response:`, response.status, rawText.slice(0, 300));
        return {
            data: null,
            rawText
        };
    }
}

async function fetchWithTimeout(url, options = {}, timeoutMs = getAiRequestTimeoutMs()) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
        controller.abort();
    }, timeoutMs);

    timeoutId.unref?.();

    try {
        return await fetch(url, {
            ...options,
            signal: controller.signal
        });
    } catch (error) {
        if (error?.name === 'AbortError') {
            throw new Error(`AI request timed out after ${timeoutMs}ms`);
        }

        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
}

async function callEnhancedOpenAI(systemPrompt, messages, userMessage) {
    const apiKey = process.env.OPENAI_API_KEY;
    const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
    const chatMessages = [{ role: 'system', content: systemPrompt }];
    const recentMessages = messages.slice(-10);

    recentMessages.forEach((message) => {
        if (message.sender_type === 'customer') {
            chatMessages.push({ role: 'user', content: message.message });
            return;
        }

        if (message.sender_type === 'bot' || message.sender_type === 'admin') {
            chatMessages.push({ role: 'assistant', content: message.message });
        }
    });

    chatMessages.push({ role: 'user', content: userMessage });

    let response;

    try {
        response = await fetchWithTimeout(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
                messages: chatMessages,
                max_tokens: 420,
                temperature: 0.55
            })
        });
    } catch (error) {
        console.error('Enhanced OpenAI API request failed:', error.message || error);
        return null;
    }

    const { data, rawText } = await readJsonResponseSafely(response, 'Enhanced OpenAI API');
    if (!response.ok) {
        console.error('Enhanced OpenAI API error:', response.status, rawText || JSON.stringify(data));
        return null;
    }

    if (!data) {
        console.error('Enhanced OpenAI API returned empty response body.');
        return null;
    }

    return data.choices?.[0]?.message?.content || null;
}

async function callEnhancedGemini(systemPrompt, messages, userMessage) {
    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
    const contents = [];
    const recentMessages = messages.slice(-10);

    recentMessages.forEach((message) => {
        if (message.sender_type === 'customer') {
            contents.push({ role: 'user', parts: [{ text: message.message }] });
            return;
        }

        if (message.sender_type === 'bot' || message.sender_type === 'admin') {
            contents.push({ role: 'model', parts: [{ text: message.message }] });
        }
    });

    contents.push({ role: 'user', parts: [{ text: userMessage }] });

    let response;

    try {
        response = await fetchWithTimeout(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    system_instruction: { parts: [{ text: systemPrompt }] },
                    contents,
                    generationConfig: {
                        maxOutputTokens: 420,
                        temperature: 0.55
                    }
                })
            }
        );
    } catch (error) {
        console.error('Enhanced Gemini API request failed:', error.message || error);
        return null;
    }

    const { data, rawText } = await readJsonResponseSafely(response, 'Enhanced Gemini API');
    if (!response.ok) {
        console.error('Enhanced Gemini API error:', response.status, rawText || JSON.stringify(data));
        return null;
    }

    if (!data) {
        console.error('Enhanced Gemini API returned empty response body.');
        return null;
    }

    return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
}

function finalizeChatReply(reply, suggestedProducts = [], options = {}) {
    const baseReply = normalizeMessage(reply);
    const fallbackReply = options.fallbackReply
        || 'Xin lỗi, tôi chưa thể xử lý yêu cầu này lúc này. Admin sẽ hỗ trợ bạn thêm.';
    const allowImageProductSuggestions = options.allowImageProductSuggestions !== false;

    const normalizedReply = normalizeChatText(baseReply);
    const shouldOverrideImageReply = allowImageProductSuggestions && options.imageAnalysis && (
        !baseReply ||
        !suggestedProducts.length ||
        includesChatPhrase(normalizedReply, 'ho tro tim san pham bang hinh anh') ||
        includesChatPhrase(normalizedReply, 'gui hinh anh') ||
        includesChatPhrase(normalizedReply, 'gui anh truc tiep')
    );
    const imageReplyClaimsNoMatch = allowImageProductSuggestions && options.imageAnalysis && suggestedProducts.length && (
        includesChatPhrase(normalizedReply, 'chua co mau') ||
        includesChatPhrase(normalizedReply, 'khong co mau') ||
        includesChatPhrase(normalizedReply, 'chua co san pham') ||
        includesChatPhrase(normalizedReply, 'khong co san pham') ||
        includesChatPhrase(normalizedReply, 'khong tim thay')
    );

    if (shouldOverrideImageReply) {
        if (suggestedProducts.length) {
            return options.imageAnalysis.matchSummary
                || 'Dua tren anh ban gui, minh da loc cac mau gan nhat hien co ngay ben duoi de ban de so sanh.';
        }

        if (options.imageAnalysis?.description) {
            return `Dua tren anh ban gui, minh nhan ra day la ${options.imageAnalysis.description.toLowerCase()}. Hien shop chua co mau that su gan trong catalog, nen minh khong muon goi y sai cho ban.`;
        }
    }

    if (imageReplyClaimsNoMatch) {
        return options.imageAnalysis.matchSummary
            || 'Dua tren anh ban gui, minh da loc cac mau gan nhat hien co ngay ben duoi de ban de so sanh.';
    }

    if (!baseReply) {
        if (options.imageAnalysis?.matchSummary && suggestedProducts.length) {
            return options.imageAnalysis.matchSummary;
        }

        if (suggestedProducts.length) {
            return `Mình đã chọn được ${suggestedProducts.length} sản phẩm phù hợp để bạn tham khảo ngay bên dưới.`;
        }

        return fallbackReply;
    }

    return baseReply;
}

function getFirstChatImageUrlFromAttachments(attachments = []) {
    const list = Array.isArray(attachments) ? attachments : [];
    const img = list.find((item) => (item.mediaType || item.media_type) === 'image');
    return img?.mediaUrl || img?.media_url || null;
}

async function callEnhancedAI(messages, userMessage, options = {}) {
    const provider = process.env.AI_PROVIDER || 'openai';
    const hasOpenAI = Boolean(process.env.OPENAI_API_KEY);
    const hasGemini = Boolean(process.env.GEMINI_API_KEY);
    const visualImageUrl = getFirstChatImageUrlFromAttachments(options.attachments);
    const {
        prompt,
        suggestedProducts,
        imageReferenceProducts,
        intent,
        hasProductIntent
    } = await buildEnhancedChatSystemPrompt(
        messages,
        userMessage,
        {
            visualImageUrl,
            allowImageProductSuggestions: options.allowImageProductSuggestions
        }
    );
    const fallbackReply = options.fallbackReply
        || (options.attachments?.length ? buildMediaOnlyFallbackReply(options.attachments) : null)
        || 'Xin lỗi, tôi chưa thể xử lý yêu cầu này lúc này. Admin sẽ hỗ trợ bạn thêm.';

    const buildResult = (reply) => {
        const text = finalizeChatReply(reply, suggestedProducts, {
            imageAnalysis: options.imageAnalysis,
            imageReferenceProducts,
            allowImageProductSuggestions: options.allowImageProductSuggestions,
            fallbackReply
        });

        return {
            text,
            suggestedProducts,
            messageType: buildChatMessageType(text, { products: suggestedProducts }),
            metadata: buildChatMessageMetadata({ products: suggestedProducts })
        };
    };

    if (visualImageUrl && hasProductIntent && options.allowImageProductSuggestions) {
        return buildLocalImageCatalogReply(intent, options.imageAnalysis, suggestedProducts);
    }

    if (!hasOpenAI && !hasGemini) {
        return buildResult('Xin lỗi, hệ thống AI đang tạm bảo trì. Admin sẽ hỗ trợ bạn sớm nhất có thể.');
    }

    try {
        if (provider === 'gemini' && hasGemini) {
            const geminiResult = await callEnhancedGemini(prompt, messages, userMessage);
            if (geminiResult) {
                return buildResult(geminiResult);
            }

            if (hasOpenAI) {
                const fallback = await callEnhancedOpenAI(prompt, messages, userMessage);
                if (fallback) {
                    return buildResult(fallback);
                }
            }
        } else if (hasOpenAI) {
            const openAIResult = await callEnhancedOpenAI(prompt, messages, userMessage);
            if (openAIResult) {
                return buildResult(openAIResult);
            }

            if (hasGemini) {
                const fallback = await callEnhancedGemini(prompt, messages, userMessage);
                if (fallback) {
                    return buildResult(fallback);
                }
            }
        }

        return buildResult('');
    } catch (error) {
        console.error('Enhanced AI API error:', error);
        return buildResult('Xin lỗi, hệ thống đang bận. Admin sẽ hỗ trợ bạn thêm trong ít phút nữa.');
    }
}

async function getSystemPrompt() {
    let productContext = '';

    try {
        const bestSellers = await Product.getBestSellers(5);
        if (bestSellers && bestSellers.length > 0) {
            productContext = '\n\nDanh sách sản phẩm hiện có:\n' + bestSellers
                .map((product) => `- ${product.name}: ${Number(product.price).toLocaleString('vi-VN')}đ (Còn ${product.stock_quantity} sản phẩm)`)
                .join('\n');
        }
    } catch (error) {
        console.error('Lỗi lấy dữ liệu sản phẩm cho AI chat:', error);
    }

    return `Bạn là trợ lý bán hàng AI của cửa hàng thời trang "WIND OF FALL".
Nhiệm vụ: tư vấn sản phẩm, hỗ trợ mua hàng và giải đáp các câu hỏi cơ bản về đơn hàng.

Quy tắc:
- Trả lời bằng tiếng Việt, thân thiện, ngắn gọn, tối đa 3-4 câu
- Không bịa thông tin về giá, tồn kho, chính sách hay khuyến mãi
- Nếu khách cần hỗ trợ sâu hơn, hãy nói rõ rằng admin sẽ hỗ trợ thêm
- Chỉ tư vấn dựa trên thông tin có trong ngữ cảnh

Thông tin cửa hàng:
- Chuyên thời trang nam nữ
- Hỗ trợ thanh toán: COD, VNPay, MoMo
- Giao hàng toàn quốc
- Website: windoffall3k32k9.online${productContext}`;
}

async function callOpenAI(systemPrompt, messages, userMessage) {
    const apiKey = process.env.OPENAI_API_KEY;
    const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';

    const chatMessages = [{ role: 'system', content: systemPrompt }];
    const recentMessages = messages.slice(-10);

    recentMessages.forEach((message) => {
        if (message.sender_type === 'customer') {
            chatMessages.push({ role: 'user', content: message.message });
            return;
        }

        if (message.sender_type === 'bot' || message.sender_type === 'admin') {
            chatMessages.push({ role: 'assistant', content: message.message });
        }
    });

    chatMessages.push({ role: 'user', content: userMessage });

    let response;

    try {
        response = await fetchWithTimeout(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
                messages: chatMessages,
                max_tokens: 300,
                temperature: 0.7
            })
        });
    } catch (error) {
        console.error('OpenAI API request failed:', error.message || error);
        return null;
    }

    const { data, rawText } = await readJsonResponseSafely(response, 'OpenAI API');
    if (!response.ok) {
        console.error('OpenAI API error:', response.status, rawText || JSON.stringify(data));
        return null;
    }

    if (!data) {
        console.error('OpenAI API returned empty response body.');
        return null;
    }

    return data.choices?.[0]?.message?.content || null;
}

async function callGemini(systemPrompt, messages, userMessage) {
    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
    const contents = [];
    const recentMessages = messages.slice(-10);

    recentMessages.forEach((message) => {
        if (message.sender_type === 'customer') {
            contents.push({ role: 'user', parts: [{ text: message.message }] });
            return;
        }

        if (message.sender_type === 'bot' || message.sender_type === 'admin') {
            contents.push({ role: 'model', parts: [{ text: message.message }] });
        }
    });

    contents.push({ role: 'user', parts: [{ text: userMessage }] });

    let response;

    try {
        response = await fetchWithTimeout(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    system_instruction: { parts: [{ text: systemPrompt }] },
                    contents,
                    generationConfig: {
                        maxOutputTokens: 300,
                        temperature: 0.7
                    }
                })
            }
        );
    } catch (error) {
        console.error('Gemini API request failed:', error.message || error);
        return null;
    }

    const { data, rawText } = await readJsonResponseSafely(response, 'Gemini API');
    if (!response.ok) {
        console.error('Gemini API error:', response.status, rawText || JSON.stringify(data));
        return null;
    }

    if (!data) {
        console.error('Gemini API returned empty response body.');
        return null;
    }

    return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
}

async function callAI(messages, userMessage) {
    const provider = process.env.AI_PROVIDER || 'openai';
    const hasOpenAI = Boolean(process.env.OPENAI_API_KEY);
    const hasGemini = Boolean(process.env.GEMINI_API_KEY);

    if (!hasOpenAI && !hasGemini) {
        return 'Xin lỗi, hệ thống AI đang tạm bảo trì. Admin sẽ hỗ trợ bạn sớm nhất có thể.';
    }

    try {
        const systemPrompt = await getSystemPrompt();

        if (provider === 'gemini' && hasGemini) {
            const geminiResult = await callGemini(systemPrompt, messages, userMessage);
            if (geminiResult) {
                return geminiResult;
            }

            if (hasOpenAI) {
                const fallback = await callOpenAI(systemPrompt, messages, userMessage);
                if (fallback) {
                    return fallback;
                }
            }
        } else if (hasOpenAI) {
            const openAIResult = await callOpenAI(systemPrompt, messages, userMessage);
            if (openAIResult) {
                return openAIResult;
            }

            if (hasGemini) {
                const fallback = await callGemini(systemPrompt, messages, userMessage);
                if (fallback) {
                    return fallback;
                }
            }
        }

        return 'Xin lỗi, tôi chưa thể xử lý yêu cầu này lúc này. Admin sẽ hỗ trợ bạn thêm.';
    } catch (error) {
        console.error('AI API error:', error);
        return 'Xin lỗi, hệ thống đang bận. Admin sẽ hỗ trợ bạn thêm trong ít phút nữa.';
    }
}

function normalizeMessage(input) {
    return typeof input === 'string' ? input.trim() : '';
}

function resolveGuestName(req) {
    if (req.user?.full_name) {
        return req.user.full_name;
    }

    if (req.user?.email) {
        return req.user.email;
    }

    return 'Khách';
}

async function buildCustomerAiContext(message, uploadedMedia = []) {
    const normalizedMessage = normalizeMessage(message);
    const normalizedChatMessage = normalizeChatText(normalizedMessage);
    const firstImage = getFirstChatImageAttachment(uploadedMedia);
    const allowImageProductSuggestions = shouldSuggestProductsForImageRequest(normalizedChatMessage, Boolean(firstImage));
    const shouldSkipVisionAnalysis = shouldUseFastImageProductFlow(normalizedChatMessage, Boolean(firstImage));
    const imageAnalysis = (firstImage && !shouldSkipVisionAnalysis)
        ? await describeProductFromImage(firstImage, normalizedMessage)
        : null;
    const effectiveMessage = normalizeMessage(buildMediaAnalysisMessage(normalizedMessage, imageAnalysis))
        || (firstImage ? 'tim san pham tu anh' : '');

    return {
        imageAnalysis,
        allowImageProductSuggestions,
        effectiveMessage,
        fallbackReply: uploadedMedia.length > 0
            ? buildMediaOnlyFallbackReply(uploadedMedia)
            : null
    };
}

exports.sendMessage = async (req, res) => {
    try {
        const message = normalizeMessage(req.body.message);
        const normalizedMessage = normalizeChatText(message);
        const uploadedMedia = Array.isArray(req.uploadedChatMedia) ? req.uploadedChatMedia : [];

        if (!message && !uploadedMedia.length) {
            return res.status(400).json({ success: false, message: 'Tin nhắn hoặc media không được để trống' });
        }

        const userId = req.user ? req.user.id : null;
        const sessionId = req.sessionID;
        const guestName = resolveGuestName(req);
        const customerMessageMetadata = buildChatMessageMetadata({ attachments: uploadedMedia });
        const customerMessageType = buildChatMessageType(message, { attachments: uploadedMedia });

        const conversation = await Chat.findOrCreateConversation(userId, sessionId, guestName);
        const previousMessages = await Chat.getMessages(conversation.id, 20);
        const customerMessage = await Chat.addMessage(
            conversation.id,
            'customer',
            userId,
            message,
            {
                messageType: customerMessageType,
                metadata: customerMessageMetadata
            }
        );

        if (conversation.handling_mode === 'manual') {
            const hasAdminMessage = previousMessages.some((item) => item.sender_type === 'admin');

            return res.json({
                success: true,
                conversationId: conversation.id,
                customerMessage,
                manualMode: true,
                notice: hasAdminMessage
                    ? null
                    : 'Tin nhắn của bạn đã được chuyển cho admin. Vui lòng chờ phản hồi.'
            });
        }

        const localGreetingReply = (!uploadedMedia.length && isGreetingOnlyMessage(normalizedMessage))
            ? buildGreetingChatReply()
            : null;
        const localCapabilityReply = (!uploadedMedia.length && !localGreetingReply && isCapabilityQuestion(normalizedMessage))
            ? buildCapabilityChatReply()
            : null;
        const localInstantReply = localGreetingReply || localCapabilityReply;
        const aiContext = localInstantReply
            ? null
            : await buildCustomerAiContext(message, uploadedMedia);
        const quickReply = localInstantReply
            ? null
            : buildChatImageSearchQuickReply(normalizedMessage, uploadedMedia);
        const localCatalogReply = (!uploadedMedia.length
            && !localInstantReply
            && !quickReply
            && aiContext?.effectiveMessage)
            ? await (async () => {
                const localIntent = buildChatIntentFromContext(previousMessages, aiContext.effectiveMessage);
                if (!shouldUseLocalCatalogReply(normalizedMessage, localIntent)) {
                    return null;
                }

                const desiredLimit = getChatRequestedProductLimit(aiContext.effectiveMessage, 6);
                const catalogProducts = await getChatSuggestedProducts(aiContext.effectiveMessage, previousMessages, {
                    limit: desiredLimit
                }).catch((error) => {
                    console.error('Local catalog reply lookup error:', error);
                    return [];
                });
                let suggestedProducts = selectChatSuggestedProducts(
                    dedupeChatProducts(catalogProducts),
                    localIntent,
                    { limit: desiredLimit }
                );

                if (suggestedProducts.length < desiredLimit) {
                    const ragContext = await retrieveChatRagContext(aiContext.effectiveMessage, {
                        productLimit: desiredLimit,
                        knowledgeLimit: 0
                    }).catch((error) => {
                        console.error('Local catalog reply RAG error:', error);
                        return { products: [], knowledge: [] };
                    });

                    suggestedProducts = selectChatSuggestedProducts(
                        dedupeChatProducts([
                            ...catalogProducts,
                            ...(ragContext.products || [])
                        ]),
                        localIntent,
                        { limit: desiredLimit }
                    );
                }

                return buildLocalCatalogReply(localIntent, suggestedProducts);
            })()
            : null;
        const aiResponse = localInstantReply || quickReply || localCatalogReply || (aiContext && aiContext.effectiveMessage
            ? await callEnhancedAI(previousMessages, aiContext.effectiveMessage, {
                attachments: uploadedMedia,
                imageAnalysis: aiContext.imageAnalysis,
                allowImageProductSuggestions: aiContext.allowImageProductSuggestions,
                fallbackReply: aiContext.fallbackReply
            })
            : {
                text: aiContext.fallbackReply || 'Mình đã nhận media của bạn. Bạn mô tả thêm giúp mình để mình gợi ý sản phẩm sát hơn nhé.',
                messageType: 'text',
                metadata: null
            });
        const botMessage = await Chat.addMessage(
            conversation.id,
            'bot',
            null,
            aiResponse.text,
            {
                messageType: aiResponse.messageType,
                metadata: aiResponse.metadata
            }
        );

        return res.json({
            success: true,
            conversationId: conversation.id,
            customerMessage,
            botMessage,
            manualMode: false
        });
    } catch (error) {
        console.error('Chat send error:', error);
        return res.status(500).json({ success: false, message: 'Lỗi gửi tin nhắn' });
    }
};

exports.getMessages = async (req, res) => {
    try {
        const userId = req.user ? req.user.id : null;
        const sessionId = req.sessionID;
        const conversation = await Chat.getActiveConversationForCustomer(userId, sessionId);

        if (!conversation) {
            return res.json({
                success: true,
                messages: [],
                conversation: null,
                unreadCount: 0
            });
        }

        const messages = await Chat.getMessages(conversation.id, 100);
        await Chat.markAsRead(conversation.id, 'customer');

        return res.json({
            success: true,
            messages,
            conversation: {
                id: conversation.id,
                status: conversation.status,
                handling_mode: conversation.handling_mode
            },
            unreadCount: 0
        });
    } catch (error) {
        console.error('Chat getMessages error:', error);
        return res.status(500).json({ success: false, message: 'Lỗi tải tin nhắn' });
    }
};

exports.getUnreadCount = async (req, res) => {
    try {
        const userId = req.user ? req.user.id : null;
        const sessionId = req.sessionID;
        const count = await Chat.getCustomerUnreadCount(userId, sessionId);

        return res.json({ success: true, count });
    } catch (error) {
        console.error('Chat unreadCount error:', error);
        return res.status(500).json({ success: false, count: 0 });
    }
};

exports.adminChatPage = async (req, res) => {
    try {
        const { conversations, total } = await Chat.getAllConversations(1, 50);
        const unreadCount = await Chat.getUnreadCount();

        return res.render('admin/chat', {
            currentPage: 'chat',
            conversations,
            total,
            unreadCount,
            user: req.user
        });
    } catch (error) {
        console.error('Admin chat page error:', error);
        return res.status(500).render('error', {
            message: 'Lỗi tải trang chat',
            user: req.user
        });
    }
};

exports.adminGetMessages = async (req, res) => {
    try {
        const conversationId = req.params.id;
        const conversation = await Chat.getConversationById(conversationId);

        if (!conversation) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy cuộc trò chuyện' });
        }

        const messages = await Chat.getMessages(conversationId, 100);
        await Chat.markAsRead(conversationId, 'admin');

        return res.json({ success: true, messages, conversation });
    } catch (error) {
        console.error('Admin getMessages error:', error);
        return res.status(500).json({ success: false, message: 'Lỗi tải tin nhắn' });
    }
};

exports.adminReply = async (req, res) => {
    try {
        const conversationId = req.params.id;
        const message = normalizeMessage(req.body.message);
        const uploadedMedia = Array.isArray(req.uploadedChatMedia) ? req.uploadedChatMedia : [];

        if (!message && !uploadedMedia.length) {
            return res.status(400).json({ success: false, message: 'Tin nhắn hoặc media không được để trống' });
        }

        const conversation = await Chat.getConversationById(conversationId);
        if (!conversation) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy cuộc trò chuyện' });
        }

        if (conversation.status === 'closed') {
            await Chat.reopenConversation(conversationId);
        }

        await Chat.setHandlingMode(conversationId, 'manual');
        const adminMessage = await Chat.addMessage(
            conversationId,
            'admin',
            req.user.id,
            message,
            {
                messageType: buildChatMessageType(message, { attachments: uploadedMedia }),
                metadata: buildChatMessageMetadata({ attachments: uploadedMedia })
            }
        );
        const updatedConversation = await Chat.getConversationById(conversationId);

        return res.json({
            success: true,
            message: adminMessage,
            conversation: updatedConversation
        });
    } catch (error) {
        console.error('Admin reply error:', error);
        return res.status(500).json({ success: false, message: 'Lỗi gửi tin nhắn' });
    }
};

exports.adminCloseConversation = async (req, res) => {
    try {
        const conversation = await Chat.getConversationById(req.params.id);
        if (!conversation) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy cuộc trò chuyện' });
        }

        await Chat.closeConversation(req.params.id);
        return res.json({ success: true, message: 'Đã đóng cuộc trò chuyện' });
    } catch (error) {
        console.error('Admin close conversation error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.adminReopenConversation = async (req, res) => {
    try {
        const conversation = await Chat.getConversationById(req.params.id);
        if (!conversation) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy cuộc trò chuyện' });
        }

        await Chat.reopenConversation(req.params.id);
        return res.json({ success: true, message: 'Đã mở lại cuộc trò chuyện' });
    } catch (error) {
        console.error('Admin reopen conversation error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.adminSetHandlingMode = async (req, res) => {
    try {
        const mode = req.body.mode === 'manual' ? 'manual' : req.body.mode === 'ai' ? 'ai' : null;
        if (!mode) {
            return res.status(400).json({ success: false, message: 'Chế độ xử lý không hợp lệ' });
        }

        const conversation = await Chat.getConversationById(req.params.id);
        if (!conversation) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy cuộc trò chuyện' });
        }

        const updatedConversation = await Chat.setHandlingMode(req.params.id, mode);

        return res.json({
            success: true,
            message: mode === 'manual' ? 'Admin đã tiếp quản cuộc trò chuyện' : 'Đã bật lại chế độ AI tự động',
            conversation: updatedConversation
        });
    } catch (error) {
        console.error('Admin set handling mode error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

exports.adminUnreadCount = async (req, res) => {
    try {
        const count = await Chat.getUnreadCount();
        return res.json({ success: true, count });
    } catch (error) {
        console.error('Admin unread count error:', error);
        return res.status(500).json({ success: false, count: 0 });
    }
};

exports.adminGetConversations = async (req, res) => {
    try {
        const { conversations, total } = await Chat.getAllConversations(1, 50);
        const unreadCount = await Chat.getUnreadCount();

        return res.json({
            success: true,
            conversations,
            total,
            unreadCount
        });
    } catch (error) {
        console.error('Admin get conversations error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};
