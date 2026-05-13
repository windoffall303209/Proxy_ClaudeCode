// Điều phối tương tác trình duyệt cho chat định dạng nâng cao tin nhắn, tách khỏi template EJS.
(function initChatRichMessage(global) {
    const CHAT_LINK_PATTERN = /((?:https?:\/\/|www\.)[^\s<]+|\/(?:products|cart|checkout|chat|auth|admin|orders)[^\s<]*)/gi;

    // Chuẩn hóa chat link.
    function normalizeChatLink(rawValue) {
        if (!rawValue) {
            return null;
        }

        let value = rawValue;
        let trailing = '';

        while (/[),.!?:;]$/.test(value)) {
            trailing = value.slice(-1) + trailing;
            value = value.slice(0, -1);
        }

        if (!value) {
            return null;
        }

        const href = value.startsWith('www.') ? `https://${value}` : value;
        return { href, text: value, trailing };
    }

    // Xử lý append linked text.
    function appendLinkedText(container, text) {
        const value = typeof text === 'string' ? text : '';
        const lines = value.split(/\r?\n/);

        lines.forEach((line, lineIndex) => {
            let lastIndex = 0;

            line.replace(CHAT_LINK_PATTERN, (match, _group, offset) => {
                if (offset > lastIndex) {
                    container.appendChild(document.createTextNode(line.slice(lastIndex, offset)));
                }

                const normalized = normalizeChatLink(match);
                if (!normalized) {
                    container.appendChild(document.createTextNode(match));
                } else {
                    const link = document.createElement('a');
                    link.href = normalized.href;
                    link.textContent = normalized.text;
                    link.target = normalized.href.startsWith('/') ? '_self' : '_blank';
                    if (link.target === '_blank') {
                        link.rel = 'noopener noreferrer';
                    }
                    container.appendChild(link);

                    if (normalized.trailing) {
                        container.appendChild(document.createTextNode(normalized.trailing));
                    }
                }

                lastIndex = offset + match.length;
                return match;
            });

            if (lastIndex < line.length) {
                container.appendChild(document.createTextNode(line.slice(lastIndex)));
            }

            if (lineIndex < lines.length - 1) {
                container.appendChild(document.createElement('br'));
            }
        });
    }

    // Phân tích tin nhắn metadata.
    function parseMessageMetadata(rawValue) {
        if (!rawValue) {
            return null;
        }

        if (typeof rawValue === 'object') {
            return rawValue;
        }

        try {
            return JSON.parse(rawValue);
        } catch (error) {
            return null;
        }
    }

    // Định dạng currency.
    function formatCurrency(value) {
        return `${Number(value || 0).toLocaleString('vi-VN')} đ`;
    }

    // Tạo media element.
    function createMediaElement(attachment) {
        const mediaType = attachment?.mediaType || attachment?.media_type || 'image';
        const mediaUrl = attachment?.mediaUrl || attachment?.media_url || '';
        if (!mediaUrl) {
            return null;
        }

        const item = document.createElement('div');
        item.className = `chat-rich-media__item chat-rich-media__item--${mediaType}`;

        if (mediaType === 'video') {
            const video = document.createElement('video');
            video.className = 'chat-rich-media__video';
            video.src = mediaUrl;
            video.controls = true;
            video.preload = 'metadata';
            item.appendChild(video);
        } else {
            const image = document.createElement('img');
            image.className = 'chat-rich-media__image';
            image.src = mediaUrl;
            image.alt = attachment?.originalName || 'Chat media';
            image.loading = 'lazy';
            item.appendChild(image);
        }

        return item;
    }

    // Tạo sản phẩm card.
    function createProductCard(product) {
        const url = product?.url || (product?.slug ? `/products/${product.slug}` : '');
        if (!url || !product?.name) {
            return null;
        }

        const card = document.createElement('a');
        card.className = 'chat-product-card';
        card.href = url;

        if (product.image) {
            const media = document.createElement('div');
            media.className = 'chat-product-card__media';

            const image = document.createElement('img');
            image.className = 'chat-product-card__image';
            image.src = product.image;
            image.alt = product.name;
            image.loading = 'lazy';
            media.appendChild(image);
            card.appendChild(media);
        }

        const body = document.createElement('div');
        body.className = 'chat-product-card__body';

        const title = document.createElement('div');
        title.className = 'chat-product-card__title';
        title.textContent = product.name;
        body.appendChild(title);

        const subtitle = document.createElement('div');
        subtitle.className = 'chat-product-card__subtitle';
        subtitle.textContent = product.subtitle || 'WIND OF FALL';
        body.appendChild(subtitle);

        const priceRow = document.createElement('div');
        priceRow.className = 'chat-product-card__price-row';

        const currentPrice = document.createElement('span');
        currentPrice.className = 'chat-product-card__price';
        currentPrice.textContent = formatCurrency(product.final_price || product.price);
        priceRow.appendChild(currentPrice);

        if (Number(product.price || 0) > Number(product.final_price || 0)) {
            const oldPrice = document.createElement('span');
            oldPrice.className = 'chat-product-card__old-price';
            oldPrice.textContent = formatCurrency(product.price);
            priceRow.appendChild(oldPrice);
        }

        if (Number(product.discount_percent || 0) > 0) {
            const discount = document.createElement('span');
            discount.className = 'chat-product-card__discount';
            discount.textContent = `-${product.discount_percent}%`;
            priceRow.appendChild(discount);
        }

        body.appendChild(priceRow);

        if (product.reason) {
            const reason = document.createElement('div');
            reason.className = 'chat-product-card__reason';
            reason.textContent = product.reason;
            body.appendChild(reason);
        }

        card.appendChild(body);
        return card;
    }

    // Hiển thị tin nhắn content.
    function renderMessageContent(container, message) {
        if (!container) {
            return;
        }

        container.innerHTML = '';

        const metadata = parseMessageMetadata(message?.message_metadata);
        const text = typeof message?.message === 'string' ? message.message.trim() : '';
        const attachments = Array.isArray(metadata?.attachments) ? metadata.attachments : [];
        const products = Array.isArray(metadata?.products) ? metadata.products : [];

        if (text) {
            const textBlock = document.createElement('div');
            textBlock.className = 'chat-rich-text';
            appendLinkedText(textBlock, text);
            container.appendChild(textBlock);
        }

        if (attachments.length > 0) {
            const mediaGrid = document.createElement('div');
            mediaGrid.className = 'chat-rich-media';
            attachments.forEach((attachment) => {
                const mediaElement = createMediaElement(attachment);
                if (mediaElement) {
                    mediaGrid.appendChild(mediaElement);
                }
            });

            if (mediaGrid.childNodes.length > 0) {
                container.appendChild(mediaGrid);
            }
        }

        if (products.length > 0) {
            const productList = document.createElement('div');
            productList.className = 'chat-product-list';
            products.forEach((product) => {
                const productCard = createProductCard(product);
                if (productCard) {
                    productList.appendChild(productCard);
                }
            });

            if (productList.childNodes.length > 0) {
                container.appendChild(productList);
            }
        }
    }

    global.ChatRichMessage = {
        appendLinkedText,
        parseMessageMetadata,
        renderMessageContent
    };
})(window);
