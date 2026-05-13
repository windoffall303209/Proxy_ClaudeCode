// Điều phối tương tác trình duyệt cho đổi trả yêu cầu, tách khỏi template EJS.
document.addEventListener('DOMContentLoaded', () => {
    const form = document.querySelector('[data-return-form]');
    const input = document.querySelector('[data-return-media-input]');
    const preview = document.querySelector('[data-return-media-preview]');
    const notice = document.querySelector('[data-return-media-notice]');
    const reasonInput = form?.querySelector('[name="reason"]');
    const submitButton = form?.querySelector('button[type="submit"]');

    if (!form || !input || !preview) {
        return;
    }

    // Xử lý show notice.
    const showNotice = (message) => {
        if (!notice) {
            return;
        }

        notice.textContent = message || '';
        notice.hidden = !message;
    };

    // Xử lý set submitting.
    const setSubmitting = (isSubmitting) => {
        if (!submitButton) {
            return;
        }

        submitButton.disabled = isSubmitting;
        submitButton.textContent = isSubmitting ? 'Đang gửi...' : 'Gửi yêu cầu hoàn hàng';
    };

    if (typeof DataTransfer === 'undefined') {
        form.addEventListener('submit', (event) => {
            const reason = (reasonInput?.value || '').trim();
            if (reason.length < 10) {
                event.preventDefault();
                showNotice('Vui lòng nhập lý do hoàn hàng tối thiểu 10 ký tự.');
                reasonInput?.focus();
                return;
            }

            setSubmitting(true);
        });
        return;
    }

    const maxImages = Number.parseInt(input.dataset.maxImages, 10) || 6;
    const maxVideos = Number.parseInt(input.dataset.maxVideos, 10) || 1;
    const selectedFiles = [];
    const objectUrls = new Map();

    // Lấy tệp key.
    const getFileKey = (file) => `${file.name}-${file.size}-${file.lastModified}`;
    // Lấy media type.
    const getMediaType = (file) => {
        if (file.type.startsWith('image/')) {
            return 'image';
        }

        if (['video/mp4', 'video/webm', 'video/quicktime'].includes(file.type)) {
            return 'video';
        }

        return null;
    };

    // Đồng bộ input tệp.
    const syncInputFiles = () => {
        const transfer = new DataTransfer();
        selectedFiles.forEach((file) => transfer.items.add(file));
        input.files = transfer.files;
        input.required = selectedFiles.length === 0;
    };

    // Xử lý revoke removed urls.
    const revokeRemovedUrls = () => {
        const activeKeys = new Set(selectedFiles.map(getFileKey));
        objectUrls.forEach((url, key) => {
            if (!activeKeys.has(key)) {
                URL.revokeObjectURL(url);
                objectUrls.delete(key);
            }
        });
    };

    // Hiển thị preview.
    const renderPreview = () => {
        revokeRemovedUrls();
        preview.innerHTML = '';

        if (selectedFiles.length === 0) {
            preview.classList.remove('has-files');
            return;
        }

        preview.classList.add('has-files');
        selectedFiles.forEach((file, index) => {
            const key = getFileKey(file);
            const mediaType = getMediaType(file);
            let url = objectUrls.get(key);

            if (!url) {
                url = URL.createObjectURL(file);
                objectUrls.set(key, url);
            }

            const item = document.createElement('div');
            item.className = 'return-media-preview__item';
            item.title = file.name;

            const media = mediaType === 'video'
                ? document.createElement('video')
                : document.createElement('img');
            media.src = url;
            if (mediaType === 'video') {
                media.muted = true;
                media.playsInline = true;
                media.preload = 'metadata';
            } else {
                media.alt = file.name;
            }

            const badge = document.createElement('span');
            badge.className = 'return-media-preview__badge';
            badge.textContent = mediaType === 'video' ? 'Video' : 'Ảnh';

            const removeButton = document.createElement('button');
            removeButton.type = 'button';
            removeButton.className = 'return-media-preview__remove';
            removeButton.setAttribute('aria-label', `Xóa ${file.name}`);
            removeButton.textContent = '×';
            removeButton.addEventListener('click', () => {
                selectedFiles.splice(index, 1);
                syncInputFiles();
                renderPreview();
                showNotice('');
            });

            item.append(media, badge, removeButton);
            preview.appendChild(item);
        });
    };

    // Thêm tệp.
    const addFiles = (files) => {
        let message = '';
        const existingKeys = new Set(selectedFiles.map(getFileKey));

        files.forEach((file) => {
            const mediaType = getMediaType(file);
            if (!mediaType) {
                message = 'Chỉ hỗ trợ ảnh và video MP4/WebM/MOV.';
                return;
            }

            if (existingKeys.has(getFileKey(file))) {
                return;
            }

            const imageCount = selectedFiles.filter((item) => getMediaType(item) === 'image').length;
            const videoCount = selectedFiles.filter((item) => getMediaType(item) === 'video').length;

            if (mediaType === 'image' && imageCount >= maxImages) {
                message = `Chỉ được chọn tối đa ${maxImages} ảnh.`;
                return;
            }

            if (mediaType === 'video' && videoCount >= maxVideos) {
                message = `Chỉ được chọn tối đa ${maxVideos} video.`;
                return;
            }

            selectedFiles.push(file);
            existingKeys.add(getFileKey(file));
        });

        syncInputFiles();
        renderPreview();
        showNotice(message);
    };
    input.addEventListener('change', () => {
        addFiles(Array.from(input.files || []));
    });
    form.addEventListener('submit', (event) => {
        const reason = (reasonInput?.value || '').trim();
        if (reason.length < 10) {
            event.preventDefault();
            showNotice('Vui lòng nhập lý do hoàn hàng tối thiểu 10 ký tự.');
            reasonInput?.focus();
            return;
        }

        if (selectedFiles.length === 0) {
            event.preventDefault();
            showNotice('Vui lòng chọn ít nhất một ảnh hoặc video minh chứng.');
            input.focus();
            return;
        }

        setSubmitting(true);
    });
});
