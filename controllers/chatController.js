const Chat = require('../models/Chat');
const Product = require('../models/Product');

const CHAT_PRODUCT_KEYWORDS = [
    'ao', 'ao thun', 'ao so mi', 'ao polo', 'quan', 'quan jean', 'jeans', 'kaki',
    'dam', 'vay', 'chan vay', 'hoodie', 'jacket', 'outfit', 'phoi do',
    'thoi trang', 'mac di lam', 'di lam', 'cong so', 'di choi', 'size', 'mau',
    'goi y', 'tu van', 'phu hop', 'tim san pham', 'do nam', 'do nu',
    'nam', 'nu', 'tre em', 'be trai', 'be gai'
];

const CHAT_SUPPORT_KEYWORDS = [
    'don hang', 'ma don', 'van chuyen', 'giao hang', 'ship', 'thanh toan',
    'doi tra', 'hoan tien', 'bao hanh', 'tai khoan', 'dang nhap', 'dang ky',
    'voucher', 'ma giam', 'khuyen mai', 'loi he thong'
];

const CHAT_GENDER_RULES = [
    { id: 'kids', label: 'tr\u1ebb em', searchPhrase: 'tre em', keywords: ['tre em', 'em be', 'be trai', 'be gai', 'kids'] },
    { id: 'male', label: 'nam', searchPhrase: 'nam', keywords: ['do nam', 'thoi trang nam', 'nam', 'men', 'male'] },
    { id: 'female', label: 'n\u1eef', searchPhrase: 'nu', keywords: ['do nu', 'thoi trang nu', 'nu', 'women', 'female'] }
];

const CHAT_OCCASION_RULES = [
    { id: 'office', label: '\u0111i l\u00e0m', searchPhrase: 'cong so', keywords: ['di lam', 'cong so', 'van phong', 'lich su', 'hop', 'meeting'] },
    { id: 'casual', label: '\u0111i ch\u01a1i', searchPhrase: 'di choi', keywords: ['di choi', 'dao pho', 'hang ngay', 'casual'] },
    { id: 'party', label: 'd\u1ef1 ti\u1ec7c', searchPhrase: 'du tiec', keywords: ['du tiec', 'party', 'su kien', 'dam cuoi', 'cuoi hoi'] },
    { id: 'sport', label: 'th\u1ec3 thao', searchPhrase: 'the thao', keywords: ['the thao', 'tap gym', 'chay bo', 'workout'] }
];

const CHAT_CATEGORY_RULES = [
    { id: 'shirt', family: 'top', generic: true, label: '\u00e1o', searchPhrase: 'ao', keywords: ['ao'] },
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

const CHAT_STOP_WORDS = new Set([
    'shop', 'minh', 'toi', 'cho', 'voi', 'can', 'muon', 'tim', 'goi', 'y', 'giup',
    'tu', 'van', 'san', 'pham', 'loai', 'cua', 'nay', 'kia', 'dep', 'mac', 'mua',
    'mot', 'nhung', 'dang', 'roi', 'nhe', 'a', 'ah', 'ha', 'nua', 'tam', 'khoang',
    'duoi', 'tren', 'tu', 'den'
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
        const stock = Number(product.stock_quantity || 0);
        const reason = product.chat_reason ? ` | Phu hop: ${product.chat_reason}` : '';
        return `- ${product.name} | Gia: ${price} | Ton kho: ${stock}${reason} | Link: ${getChatProductPath(product)}`;
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

    return null;
}

function parseChatBudget(normalizedMessage) {
    if (!normalizedMessage) {
        return null;
    }

    const rangeMatch = normalizedMessage.match(/(\d+(?:[.,]\d+)?)\s*(trieu|tr|m|k|nghin|ngan)?\s*(?:-|den|toi)\s*(\d+(?:[.,]\d+)?)\s*(trieu|tr|m|k|nghin|ngan)?/);
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

function buildChatSearchQueries(intent, userMessage) {
    const queries = [];
    const compactTokens = [];

    intent.categories.forEach((category) => compactTokens.push(category.searchPhrase));
    if (intent.gender) {
        compactTokens.push(intent.gender.searchPhrase);
    }
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

function buildChatIntent(userMessage) {
    const normalizedMessage = normalizeChatText(userMessage);
    const gender = detectChatRule(normalizedMessage, CHAT_GENDER_RULES);
    const occasion = detectChatRule(normalizedMessage, CHAT_OCCASION_RULES);
    const categories = detectChatCategories(normalizedMessage);
    const budget = parseChatBudget(normalizedMessage);
    const focusTerms = extractChatTerms(normalizedMessage);

    const intent = {
        normalizedMessage,
        gender,
        occasion,
        categories,
        budget,
        focusTerms
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

function buildChatIntentFromContext(messages = [], userMessage = '') {
    const currentIntent = buildChatIntent(userMessage);
    const priorCustomerIntents = Array.isArray(messages)
        ? messages
            .filter((message) => message && message.sender_type === 'customer' && typeof message.message === 'string')
            .slice(-8)
            .map((message) => buildChatIntent(message.message))
        : [];

    const mergedIntent = {
        normalizedMessage: currentIntent.normalizedMessage,
        gender: currentIntent.gender || getLastChatIntentValue(priorCustomerIntents, (intent) => intent.gender),
        occasion: currentIntent.occasion || getLastChatIntentValue(priorCustomerIntents, (intent) => intent.occasion),
        categories: currentIntent.categories.length
            ? currentIntent.categories
            : (getLastChatIntentValue(priorCustomerIntents, (intent) => intent.categories) || []),
        budget: currentIntent.budget || getLastChatIntentValue(priorCustomerIntents, (intent) => intent.budget),
        focusTerms: mergeChatFocusTerms(
            currentIntent.focusTerms,
            getLastChatIntentValue(priorCustomerIntents, (intent) => intent.focusTerms) || []
        )
    };

    mergedIntent.searchQueries = buildChatSearchQueries(mergedIntent, userMessage);
    mergedIntent.currentIntent = currentIntent;
    return mergedIntent;
}

function canChatDirectlySuggestProducts(intent) {
    return Array.isArray(intent?.categories) && intent.categories.length > 0;
}

function buildChatIntentSummary(intent) {
    const parts = [];

    if (intent.gender) {
        parts.push(`gioi tinh/doi tuong: ${intent.gender.label}`);
    }
    if (intent.categories.length) {
        parts.push(`loai san pham: ${intent.categories.map((item) => item.label).join(', ')}`);
    }
    if (intent.occasion) {
        parts.push(`muc dich mac: ${intent.occasion.label}`);
    }
    if (intent.budget?.label) {
        parts.push(`ngan sach: ${intent.budget.label}`);
    }

    return parts.length ? `\n\nNhu cau khach hien tai:\n- ${parts.join('\n- ')}` : '';
}

async function collectChatCandidateProducts(intent, userMessage) {
    const searchQueries = intent.searchQueries.slice(0, 3);
    const searchTasks = searchQueries.map((query) =>
        Product.findAll({
            search: query,
            sort_by: 'sold_count',
            sort_order: 'DESC',
            limit: 12
        }).catch(() => [])
    );

    const [searchBuckets, bestSellers, featuredProducts] = await Promise.all([
        Promise.all(searchTasks),
        Product.getBestSellers(10).catch(() => []),
        Product.getFeaturedProducts(8).catch(() => [])
    ]);

    let fuzzyProducts = [];
    if (searchBuckets.flat().length < 5) {
        const fuzzyBuckets = await Promise.all(
            searchQueries.slice(0, 2).map((query) => Product.search(query || userMessage, 8).catch(() => []))
        );
        fuzzyProducts = fuzzyBuckets.flat();
    }

    return dedupeChatProducts([
        ...searchBuckets.flat(),
        ...fuzzyProducts,
        ...featuredProducts,
        ...bestSellers
    ]);
}

function scoreChatCandidate(product, intent) {
    const productText = normalizeChatText([
        product.name,
        product.description,
        product.category_name,
        product.category_slug,
        product.sku
    ].filter(Boolean).join(' '));
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

    const matchedCategory = intent.categories.find((category) =>
        category.keywords.some((keyword) => includesChatPhrase(productText, keyword))
    );
    if (matchedCategory) {
        score += 28;
        reasons.push(`h\u1ee3p ki\u1ec3u ${matchedCategory.label}`);
    } else if (intent.categories.length) {
        score -= 12;
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

    const termMatches = intent.focusTerms.reduce((count, term) => (
        includesChatPhrase(productText, term) ? count + 1 : count
    ), 0);
    score += Math.min(termMatches * 4, 16);

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

    return canChatDirectlySuggestProducts(intent);
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

async function getChatSuggestedProducts(userMessage, messages = []) {
    const intent = buildChatIntentFromContext(messages, userMessage);

    if (!shouldChatSuggestProducts(intent) || !canChatDirectlySuggestProducts(intent)) {
        return [];
    }

    try {
        const candidates = await collectChatCandidateProducts(intent, userMessage);
        const rankedProducts = candidates
            .map((product) => {
                const ranking = scoreChatCandidate(product, intent);
                return {
                    ...product,
                    chat_reason: ranking.reason,
                    chat_score: ranking.score
                };
            })
            .sort((left, right) => right.chat_score - left.chat_score);

        const stockProducts = rankedProducts.filter((product) => Number(product.stock_quantity || 0) > 0);
        const genderSafeProducts = stockProducts.filter((product) => getChatAudienceMatch(product, intent));
        const fallbackGenderSafeProducts = rankedProducts.filter((product) => getChatAudienceMatch(product, intent));

        if (genderSafeProducts.length) {
            return genderSafeProducts.slice(0, 3);
        }

        if (fallbackGenderSafeProducts.length) {
            return fallbackGenderSafeProducts.slice(0, 3);
        }

        return (stockProducts.length ? stockProducts : rankedProducts).slice(0, 3);
    } catch (error) {
        console.error('Chat suggestion lookup error:', error);
        return [];
    }
}

async function buildEnhancedChatSystemPrompt(messages, userMessage) {
    let featuredContext = '';
    const intent = buildChatIntentFromContext(messages, userMessage);
    const suggestedProducts = await getChatSuggestedProducts(userMessage, messages);
    const shouldAskClarifyingQuestion = !canChatDirectlySuggestProducts(intent);

    if (!shouldAskClarifyingQuestion) {
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

    const prompt = `Ban la tro ly ban hang AI cua cua hang thoi trang "WIND OF FALL".
Nhiem vu: tu van san pham, ho tro mua hang va giai dap cau hoi co ban ve don hang.

Quy tac:
- Tra loi bang tieng Viet, than thien, ngan gon, toi da 4 cau chinh truoc khi liet ke link
- Khong bua thong tin ve gia, ton kho, chinh sach hay khuyen mai
- Chi tu van dua tren thong tin co trong ngu canh
- Neu gioi thieu san pham cu the, chi dung dung ten san pham va dung link co trong ngu canh
- Khi can gui link cho khach, uu tien dung duong dan noi bo dang /products/slug
- Neu khach moi noi chung chung ma chua noi ro loai san pham, khong goi y san pham hay link ngay; hay hoi 1 cau lam ro ngan gon ve kieu do, phong cach hoac ngan sach
- Neu khach can ho tro sau hon, noi ro admin se ho tro them

Thong tin cua hang:
- Chuyen thoi trang nam nu
- Ho tro thanh toan: COD, VNPay, MoMo
- Giao hang toan quoc${buildChatIntentSummary(intent)}${featuredContext}${suggestedContext}`;

    return {
        prompt,
        suggestedProducts
    };
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

    const response = await fetch(`${baseUrl}/chat/completions`, {
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

    const data = await response.json();
    if (!response.ok) {
        console.error('Enhanced OpenAI API error:', response.status, JSON.stringify(data));
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

    const response = await fetch(
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

    const data = await response.json();
    if (!response.ok) {
        console.error('Enhanced Gemini API error:', response.status, JSON.stringify(data));
        return null;
    }

    return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
}

function attachChatSuggestedLinks(reply, suggestedProducts = []) {
    const baseReply = normalizeMessage(reply);

    if (!baseReply) {
        return suggestedProducts.length
            ? buildChatSuggestionBlock(suggestedProducts)
            : 'Xin l\u1ed7i, t\u00f4i ch\u01b0a th\u1ec3 x\u1eed l\u00fd y\u00eau c\u1ea7u n\u00e0y l\u00fac n\u00e0y. Admin s\u1ebd h\u1ed7 tr\u1ee3 b\u1ea1n th\u00eam.';
    }

    if (!suggestedProducts.length || CHAT_PRODUCT_LINK_PATTERN.test(baseReply)) {
        return baseReply;
    }

    return `${baseReply}\n\n${buildChatSuggestionBlock(suggestedProducts)}`;
}

async function callEnhancedAI(messages, userMessage) {
    const provider = process.env.AI_PROVIDER || 'openai';
    const hasOpenAI = Boolean(process.env.OPENAI_API_KEY);
    const hasGemini = Boolean(process.env.GEMINI_API_KEY);
    const { prompt, suggestedProducts } = await buildEnhancedChatSystemPrompt(messages, userMessage);

    if (!hasOpenAI && !hasGemini) {
        return attachChatSuggestedLinks(
            'Xin l\u1ed7i, h\u1ec7 th\u1ed1ng AI \u0111ang t\u1ea1m b\u1ea3o tr\u00ec. Admin s\u1ebd h\u1ed7 tr\u1ee3 b\u1ea1n s\u1edbm nh\u1ea5t c\u00f3 th\u1ec3.',
            suggestedProducts
        );
    }

    try {
        if (provider === 'gemini' && hasGemini) {
            const geminiResult = await callEnhancedGemini(prompt, messages, userMessage);
            if (geminiResult) {
                return attachChatSuggestedLinks(geminiResult, suggestedProducts);
            }

            if (hasOpenAI) {
                const fallback = await callEnhancedOpenAI(prompt, messages, userMessage);
                if (fallback) {
                    return attachChatSuggestedLinks(fallback, suggestedProducts);
                }
            }
        } else if (hasOpenAI) {
            const openAIResult = await callEnhancedOpenAI(prompt, messages, userMessage);
            if (openAIResult) {
                return attachChatSuggestedLinks(openAIResult, suggestedProducts);
            }

            if (hasGemini) {
                const fallback = await callEnhancedGemini(prompt, messages, userMessage);
                if (fallback) {
                    return attachChatSuggestedLinks(fallback, suggestedProducts);
                }
            }
        }

        return attachChatSuggestedLinks(
            'Xin l\u1ed7i, t\u00f4i ch\u01b0a th\u1ec3 x\u1eed l\u00fd y\u00eau c\u1ea7u n\u00e0y l\u00fac n\u00e0y. Admin s\u1ebd h\u1ed7 tr\u1ee3 b\u1ea1n th\u00eam.',
            suggestedProducts
        );
    } catch (error) {
        console.error('Enhanced AI API error:', error);
        return attachChatSuggestedLinks(
            'Xin l\u1ed7i, h\u1ec7 th\u1ed1ng \u0111ang b\u1eadn. Admin s\u1ebd h\u1ed7 tr\u1ee3 b\u1ea1n th\u00eam trong \u00edt ph\u00fat n\u1eefa.',
            suggestedProducts
        );
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

    const response = await fetch(`${baseUrl}/chat/completions`, {
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

    const data = await response.json();
    if (!response.ok) {
        console.error('OpenAI API error:', response.status, JSON.stringify(data));
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

    const response = await fetch(
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

    const data = await response.json();
    if (!response.ok) {
        console.error('Gemini API error:', response.status, JSON.stringify(data));
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

exports.sendMessage = async (req, res) => {
    try {
        const message = normalizeMessage(req.body.message);
        if (!message) {
            return res.status(400).json({ success: false, message: 'Tin nhắn không được để trống' });
        }

        const userId = req.user ? req.user.id : null;
        const sessionId = req.sessionID;
        const guestName = resolveGuestName(req);

        const conversation = await Chat.findOrCreateConversation(userId, sessionId, guestName);
        const previousMessages = await Chat.getMessages(conversation.id, 20);
        const customerMessage = await Chat.addMessage(conversation.id, 'customer', userId, message);

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

        const aiResponse = await callEnhancedAI(previousMessages, message);
        const botMessage = await Chat.addMessage(conversation.id, 'bot', null, aiResponse);

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

        if (!message) {
            return res.status(400).json({ success: false, message: 'Tin nhắn không được để trống' });
        }

        const conversation = await Chat.getConversationById(conversationId);
        if (!conversation) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy cuộc trò chuyện' });
        }

        if (conversation.status === 'closed') {
            await Chat.reopenConversation(conversationId);
        }

        await Chat.setHandlingMode(conversationId, 'manual');
        const adminMessage = await Chat.addMessage(conversationId, 'admin', req.user.id, message);
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
