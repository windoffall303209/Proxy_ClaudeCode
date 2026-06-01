const { execFile } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Terminal } = require('@xterm/headless');
const { SerializeAddon } = require('@xterm/addon-serialize');
const { getGeminiCliRuntimeEnv } = require('./runtimeApiKeyService');

const DEFAULT_TIMEOUT_MS = 120000;
const DEFAULT_MODEL = 'gemini-2.5-flash-lite';
const DEFAULT_MCP_SERVER = 'wind-of-fall-shop';
const PROJECT_ROOT = path.resolve(__dirname, '..');
const WEB_SESSION_DIR = path.join(PROJECT_ROOT, '.gemini', 'web-chat-sessions');
const PTY_IDLE_TTL_MS = 15 * 60 * 1000;
const PTY_READY_TIMEOUT_MS = 45000;
const WEB_CLI_BOOTSTRAP_PROMPT = [
    'Từ bây giờ hãy đóng vai trò như phiên Gemini CLI shop WIND OF FALL đang chạy trực tiếp cho web chat local.',
    'Trả lời bằng tiếng Việt tự nhiên. Nếu khách gọi/chào kiểu "e ku", "ê ku", "alo", "shop oi" thì xem là lời gọi bình thường, đừng tìm sản phẩm.',
    'Khi cần dữ liệu shop, hãy dùng MCP wind-of-fall-shop như trong Gemini CLI. Không tự bịa sản phẩm, không tự bịa URL /products/slug.',
    'Với câu hỏi tư vấn phong cách, mùa hè, đi chơi, đi du lịch, phối đồ, bắt buộc đưa 3-4 lựa chọn để khách so sánh; không chỉ trả về 1 sản phẩm trừ khi khách yêu cầu đúng 1 mẫu.',
    'Với các câu hỏi tư vấn mua mặc/đi chơi/du lịch, nếu có thể hãy gọi MCP shop để lấy 3-4 sản phẩm thật phù hợp trong catalog, rồi giải thích ngắn lý do phù hợp cho từng lựa chọn.',
    'Nếu nhắc sản phẩm cụ thể của shop, chỉ dùng tên/link/slug đã lấy từ MCP shop. Khi liệt kê sản phẩm cụ thể, trình bày markdown rõ ràng, đánh số xuống dòng, mỗi sản phẩm có tên dạng hyperlink markdown [Tên sản phẩm](http://localhost:3000/products/slug) và giá nếu có.',
    'Nếu chỉ đang tư vấn phong cách chung và chưa lấy được sản phẩm thật từ MCP, không đặt hyperlink và không tạo URL.',
    'Không hiện URL trần trong câu trả lời và không viết dòng riêng kiểu "Xem chi tiết tại: http://..."; URL phải nằm sau tên sản phẩm trong markdown link.',
    'Nếu khách nói "thêm nữa" thì tiếp tục danh sách đang nói, chọn sản phẩm khác chưa liệt kê và đánh số tiếp theo, không bắt đầu lại từ 1.',
    'Nếu khách hỏi "sản phẩm thứ 2/3/4" hoặc "mẫu 3" thì dựa vào danh sách đã gợi ý trong chính phiên này.',
    'Không dùng todo list, WriteTodos, hay các trạng thái kế hoạch nội bộ khi trả lời khách.',
    'Nếu đã hiểu, chỉ trả lời đúng 2 từ: Đã hiểu'
].join('\n');
const persistentSessions = new Map();
const SHOP_MCP_TOOLS = [
    'read_file',
    'read_many_files',
    'mcp_wind-of-fall-shop_search_products',
    'mcp_wind-of-fall-shop_list_products',
    'mcp_wind-of-fall-shop_get_product_detail',
    'mcp_wind-of-fall-shop_list_categories',
    'mcp_wind-of-fall-shop_get_storefront_info',
    'mcp_wind-of-fall-shop_search_store_knowledge',
    'mcp_wind-of-fall-shop_track_order'
];

function getGeminiCommand() {
    if (process.env.GEMINI_CLI_COMMAND) {
        return {
            executable: process.env.GEMINI_CLI_COMMAND,
            prefixArgs: []
        };
    }

    if (process.platform === 'win32') {
        return {
            executable: process.execPath,
            prefixArgs: [
                path.join(process.env.APPDATA || '', 'npm', 'node_modules', '@google', 'gemini-cli', 'bundle', 'gemini.js')
            ]
        };
    }

    return {
        executable: 'gemini',
        prefixArgs: []
    };
}

function getTimeoutMs() {
    const parsed = Number.parseInt(process.env.GEMINI_CLI_TIMEOUT_MS, 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
}

function shouldUsePersistentPty() {
    return String(process.env.GEMINI_CLI_PERSISTENT || 'true').trim().toLowerCase() !== 'false';
}

function getNodePty() {
    const nodePtyPath = path.join(
        process.env.APPDATA || '',
        'npm',
        'node_modules',
        '@google',
        'gemini-cli',
        'node_modules',
        'node-pty'
    );
    return require(nodePtyPath);
}

function buildStableUuid(seed) {
    const hex = crypto.createHash('sha256').update(String(seed || 'default')).digest('hex').slice(0, 32).split('');
    hex[12] = '4';
    hex[16] = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
    return `${hex.slice(0, 8).join('')}-${hex.slice(8, 12).join('')}-${hex.slice(12, 16).join('')}-${hex.slice(16, 20).join('')}-${hex.slice(20, 32).join('')}`;
}

function getWebSessionState(sessionKey) {
    if (!sessionKey) {
        return null;
    }

    const sessionId = buildStableUuid(`wind-of-fall-web-chat:${sessionKey}`);
    return {
        sessionId,
        markerPath: path.join(WEB_SESSION_DIR, `${sessionId}.json`)
    };
}

function hasWebSessionMarker(sessionState) {
    return Boolean(sessionState?.markerPath && fs.existsSync(sessionState.markerPath));
}

function markWebSession(sessionState) {
    if (!sessionState?.markerPath) {
        return;
    }

    fs.mkdirSync(path.dirname(sessionState.markerPath), { recursive: true });
    fs.writeFileSync(sessionState.markerPath, JSON.stringify({
        sessionId: sessionState.sessionId,
        updatedAt: new Date().toISOString()
    }, null, 2));
}

function stripAnsi(value = '') {
    return String(value || '').replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '');
}

function cleanGeminiOutput(value = '') {
    return stripAnsi(value)
        .split(/\r?\n/)
        .filter((line) => {
            const normalized = line.trim();
            if (!normalized) return true;
            if (normalized.startsWith('YOLO mode is enabled')) return false;
            if (normalized.startsWith('Warning:')) return false;
            if (normalized.includes('Approval mode overridden')) return false;
            if (normalized.includes('Ripgrep is not available')) return false;
            return true;
        })
        .join('\n')
        .trim();
}

function normalizeTerminalOutput(value = '') {
    return stripAnsi(String(value || '').replace(/\u001b\][^\u0007]*(?:\u0007|\u001b\\)/g, ''));
}

function cleanInteractiveOutput(value = '') {
    return normalizeTerminalOutput(value)
        .split(/\r?\n/)
        .map((line) => line.replace(/\s+$/g, ''))
        .filter((line) => {
            const normalized = line.trim();
            if (!normalized) return true;
            if (normalized.startsWith('workspace ')) return false;
            if (normalized.startsWith('~\\Documents\\')) return false;
            if (normalized.startsWith('no sandbox')) return false;
            if (normalized.startsWith('testchatbot')) return false;
            if (normalized.startsWith('gemini-')) return false;
            if (/^\d+%\s+used$/i.test(normalized)) return false;
            if (/^(?:0;)?[◇✦]\s+/.test(normalized)) return false;
            if (/^(?:0;)?Ready\s*\(/i.test(normalized)) return false;
            if (normalized.startsWith('? for shortcuts')) return false;
            if (normalized.startsWith('YOLO')) return false;
            if (normalized.startsWith('responding ')) return false;
            if (normalized.startsWith('quota')) return false;
            if (normalized.startsWith('Todo list ')) return false;
            if (normalized.startsWith('Success: WriteTodos')) return false;
            if (normalized.includes('Type your message')) return false;
            if (normalized.includes('Waiting for authentication')) return false;
            if (normalized.includes('screen reader-friendly view')) return false;
            return true;
        })
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function extractTerminalModelReply(turnOutput = '') {
    const clean = normalizeTerminalOutput(turnOutput).replace(/\r/g, '\n');
    const replyPattern = /(?:^|\n|\s)✦\s+(?!Working|Ready)([\s\S]*?)(?=(?:[─▄▀]{10,}|(?:0;)?◇\s+Ready|workspace \(|$))/g;
    let match;
    let reply = '';

    while ((match = replyPattern.exec(clean)) !== null) {
        const candidate = String(match[1] || '').trim();
        if (candidate) {
            reply = candidate;
        }
    }

    return reply
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function getTerminalReplyMarkerIndex(value = '') {
    const clean = normalizeTerminalOutput(value).replace(/\r/g, '\n');
    const markerPattern = /(?:^|\n|\s)✦\s+(?!Working|Ready)(?=\S)/g;
    let match;
    let markerIndex = -1;

    while ((match = markerPattern.exec(clean)) !== null) {
        markerIndex = match.index + match[0].lastIndexOf('✦');
    }

    return markerIndex;
}

function stripMcpToolBlocks(value = '') {
    const lines = String(value || '').split(/\r?\n/);
    const output = [];
    let skippingToolBlock = false;
    let seenJson = false;
    let braceDepth = 0;

    lines.forEach((line) => {
        const normalized = line.trim();

        if (!skippingToolBlock && normalized.startsWith('⊶ ')) {
            skippingToolBlock = true;
            seenJson = false;
            braceDepth = 0;
            return;
        }

        if (skippingToolBlock) {
            const opens = (line.match(/[{\[]/g) || []).length;
            const closes = (line.match(/[}\]]/g) || []).length;

            if (seenJson || normalized.startsWith('{') || normalized.startsWith('[')) {
                seenJson = true;
                braceDepth += opens - closes;
                if (braceDepth <= 0 && (normalized.endsWith('}') || normalized.endsWith(']'))) {
                    skippingToolBlock = false;
                }
                return;
            }

            if (!normalized) {
                skippingToolBlock = false;
            }
            return;
        }

        output.push(line);
    });

    return output.join('\n');
}

function stabilizeProgressiveText(value = '') {
    const lines = stripMcpToolBlocks(value)
        .split(/\r?\n/)
        .map((line) => line.replace(/\s+$/g, ''));
    const keep = [];

    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        const normalized = line.trim();

        if (!normalized) {
            if (keep.length && keep[keep.length - 1] !== '') {
                keep.push('');
            }
            continue;
        }

        if (normalized === '*' || normalized === '-') {
            continue;
        }
        if (/^\d+\.$/.test(normalized)) {
            continue;
        }
        const boldMarkerCount = (normalized.match(/\*\*/g) || []).length;
        if (boldMarkerCount % 2 === 1) {
            continue;
        }
        const openParenCount = (normalized.match(/\(/g) || []).length;
        const closeParenCount = (normalized.match(/\)/g) || []).length;
        const openBracketCount = (normalized.match(/\[/g) || []).length;
        const closeBracketCount = (normalized.match(/\]/g) || []).length;
        if (openParenCount > closeParenCount || openBracketCount > closeBracketCount) {
            continue;
        }
        if (normalized.startsWith('Todo list ') || normalized.startsWith('Success: WriteTodos')) {
            continue;
        }

        let hasBetterLaterLine = false;
        for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
            const later = lines[cursor].trim();
            if (!later) {
                continue;
            }

            const numberedLine = normalized.match(/^(\d+)\.\s+/);
            const laterNumberedLine = later.match(/^(\d+)\.\s+/);
            if (numberedLine && laterNumberedLine && numberedLine[1] === laterNumberedLine[1]) {
                hasBetterLaterLine = true;
                break;
            }

            if (later === normalized) {
                hasBetterLaterLine = true;
                break;
            }

            if (normalized.length >= 6 && later.length > normalized.length && later.startsWith(normalized)) {
                hasBetterLaterLine = true;
                break;
            }
        }

        if (!hasBetterLaterLine) {
            keep.push(line);
        }
    }

    return keep
        .join('\n')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/^(?:Chào bạn,?|Dạ,?|Gửi bạn|Gửi|Đây là|Dưới đây là)[^\n.!?:：]{0,80}\n\n(?=\d+\.\s+)/i, '')
        .trim();
}

function formatProductNameLinks(value = '') {
    return String(value || '')
        .split(/\r?\n/)
        .map((line) => {
            const urlMatch = line.match(/(?:https?:\/\/localhost:3000)?\/products\/[A-Za-z0-9-]+/i);
            if (!urlMatch || /\[[^\]]+\]\((?:https?:\/\/localhost:3000)?\/products\/[A-Za-z0-9-]+\)/i.test(line)) {
                return line;
            }
            if (!/^\s*(?:[-*]\s*)?(?:\d+\.\s*)?[^:\n]{3,120}\s+-\s+/.test(line)) {
                return line.replace(new RegExp(`\\s*\\(?${urlMatch[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)?`, 'g'), '');
            }

            const url = urlMatch[0].startsWith('/products/')
                ? `http://localhost:3000${urlMatch[0]}`
                : urlMatch[0];
            const leadingMatch = line.match(/^(\s*(?:[-*]\s*)?(?:\d+\.\s*)?)(.*)$/);
            const leading = leadingMatch?.[1] || '';
            const body = leadingMatch?.[2] || line.trim();
            const beforeUrl = body.slice(0, body.indexOf(urlMatch[0])).trim();
            const name = beforeUrl
                .replace(/\s*[-–—]\s*(?:xem\s+(?:chi\s+ti[eế]t|s[aả]n\s+ph[aẩ]m)|chi\s+ti[eế]t|link|url)\s*:?\s*$/i, '')
                .split(/\s+-\s+/)[0]
                .trim();

            if (!name || name.length < 3) {
                return line.replace(urlMatch[0], url);
            }

            const remainder = body
                .slice(name.length)
                .replace(urlMatch[0], '')
                .replace(/\s*[-–—]?\s*(?:xem\s+(?:chi\s+ti[eế]t|s[aả]n\s+ph[aẩ]m)|chi\s+ti[eế]t|link|url)\s*:?\s*/ig, ' ')
                .replace(/\s*\(\s*\)\s*/g, ' ')
                .replace(/\s+-\s*$/g, '')
                .replace(/\s{2,}/g, ' ')
                .trim();

            return `${leading}[${name}](${url})${remainder ? ` ${remainder}` : ''}`;
        })
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function extractInteractiveModelReply(turnOutput = '') {
    const terminalReply = extractTerminalModelReply(turnOutput);
    if (terminalReply) {
        return formatProductNameLinks(terminalReply);
    }

    const clean = cleanInteractiveOutput(turnOutput);
    const marker = 'Model:';
    const markerIndex = clean.lastIndexOf(marker);
    if (markerIndex < 0) {
        return '';
    }

    let text = clean.slice(markerIndex + marker.length);
    const stopPatterns = [
        /\nUser:\s*[\s\S]*$/i,
        /\n\d+%\s+used[\s\S]*$/i,
        /\n(?:0;)?[◇✦]\s+[\s\S]*$/i,
        /\n(?:0;)?Ready\s*\([\s\S]*$/i,
        /\n◇\s+Ready[\s\S]*$/i,
        /\n✦\s+Working[\s\S]*$/i
    ];
    stopPatterns.forEach((pattern) => {
        text = text.replace(pattern, '');
    });
    return formatProductNameLinks(stabilizeProgressiveText(text));
}

class GeminiCliPtySession {
    constructor(sessionKey) {
        this.sessionKey = sessionKey || 'default';
        this.pty = null;
        this.terminal = null;
        this.serializeAddon = null;
        this.buffer = '';
        this.turnBuffer = '';
        this.ready = false;
        this.bootstrapped = false;
        this.queue = Promise.resolve();
        this.lastUsedAt = Date.now();
        this.readyWaiters = [];
        this.runtimeEnv = {};
        this.runtimeEnvSignature = '';
    }

    setRuntimeEnv(runtimeEnv = {}) {
        const nextEnv = runtimeEnv && typeof runtimeEnv === 'object' ? runtimeEnv : {};
        const nextSignature = JSON.stringify(nextEnv);

        if (this.runtimeEnvSignature && this.runtimeEnvSignature !== nextSignature) {
            this.dispose();
            this.buffer = '';
            this.turnBuffer = '';
            this.ready = false;
            this.bootstrapped = false;
        }

        this.runtimeEnv = nextEnv;
        this.runtimeEnvSignature = nextSignature;
    }

    start() {
        if (this.pty) {
            return;
        }

        const pty = getNodePty();
        const command = getGeminiCommand();
        const model = process.env.GEMINI_CLI_MODEL || DEFAULT_MODEL;
        const mcpServer = process.env.GEMINI_CLI_MCP_SERVER || DEFAULT_MCP_SERVER;
        const args = [
            ...command.prefixArgs,
            '--skip-trust',
            '-m',
            model,
            '--allowed-mcp-server-names',
            mcpServer,
            ...SHOP_MCP_TOOLS.flatMap((toolName) => ['--allowed-tools', toolName]),
            '--approval-mode',
            'yolo'
        ];

        this.terminal = new Terminal({ cols: 160, rows: 120, allowProposedApi: true });
        this.serializeAddon = new SerializeAddon();
        this.terminal.loadAddon(this.serializeAddon);

        this.pty = pty.spawn(command.executable, args, {
            cwd: PROJECT_ROOT,
            cols: 160,
            rows: 120,
            env: {
                ...process.env,
                ...this.runtimeEnv,
                GEMINI_CLI_TRUST_WORKSPACE: 'true'
            }
        });

        this.pty.onData((chunk) => this.handleData(chunk));
        this.pty.onExit(() => {
            this.pty = null;
            this.ready = false;
            this.rejectReadyWaiters(new Error('Gemini CLI PTY exited'));
        });
    }

    handleData(chunk) {
        this.buffer += chunk;
        this.turnBuffer += chunk;
        this.terminal?.write(chunk);
        const clean = stripAnsi(this.buffer);
        if (!this.ready && clean.includes('Type your message')) {
            this.ready = true;
            this.resolveReadyWaiters();
        }
    }

    waitUntilReady(timeoutMs = PTY_READY_TIMEOUT_MS) {
        this.start();
        if (this.ready) {
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Timed out waiting for Gemini CLI PTY to become ready'));
            }, timeoutMs);

            this.readyWaiters.push({
                resolve: () => {
                    clearTimeout(timeout);
                    resolve();
                },
                reject: (error) => {
                    clearTimeout(timeout);
                    reject(error);
                }
            });
        });
    }

    resolveReadyWaiters() {
        const waiters = this.readyWaiters.splice(0);
        waiters.forEach((waiter) => waiter.resolve());
    }

    rejectReadyWaiters(error) {
        const waiters = this.readyWaiters.splice(0);
        waiters.forEach((waiter) => waiter.reject(error));
    }

    ask(message) {
        this.queue = this.queue.then(() => this.askInternal(message), () => this.askInternal(message));
        return this.queue;
    }

    async askInternal(message) {
        this.lastUsedAt = Date.now();
        await this.waitUntilReady();
        await new Promise((resolve) => setTimeout(resolve, 800));

        if (!this.bootstrapped) {
            this.bootstrapped = true;
            await this.sendTurn(WEB_CLI_BOOTSTRAP_PROMPT);
            await new Promise((resolve) => setTimeout(resolve, 300));
        }

        return this.sendTurn(message);
    }

    async sendTurn(message) {
        this.turnBuffer = '';
        this.terminal?.clear();
        this.pty.write(String(message || '').replace(/\r?\n/g, '\n'));
        await new Promise((resolve) => setTimeout(resolve, 300));
        this.pty.write('\r');
        await new Promise((resolve) => setTimeout(resolve, 300));
        this.pty.write('\n');
        return this.waitForReply();
    }

    waitForReply() {
        const timeoutMs = getTimeoutMs();
        const startedAt = Date.now();

        return new Promise((resolve, reject) => {
            const interval = setInterval(() => {
                const clean = stripAnsi(this.turnBuffer);
                const modelIndex = clean.lastIndexOf('Model:');
                const terminalReplyIndex = getTerminalReplyMarkerIndex(this.getScreenText());
                const replyIndex = Math.max(modelIndex, terminalReplyIndex);
                const hasReply = replyIndex >= 0;
                const afterReply = hasReply ? clean.slice(replyIndex) : '';
                const hasScreenReaderModel = modelIndex >= 0 && modelIndex >= terminalReplyIndex;
                const isReadyAgain = hasReply && (
                    (hasScreenReaderModel && afterReply.includes('Type your message'))
                    || /(?:0;)?◇\s+Ready/.test(afterReply)
                    || /\bReady\s*\(/.test(afterReply)
                );
                if (hasReply && isReadyAgain) {
                    clearInterval(interval);
                    setTimeout(() => {
                        const screenText = this.getScreenText();
                        const reply = extractInteractiveModelReply(screenText) || extractInteractiveModelReply(this.turnBuffer);
                        resolve(reply || cleanInteractiveOutput(screenText || this.turnBuffer));
                    }, 1500);
                    return;
                }

                if (Date.now() - startedAt > timeoutMs) {
                    clearInterval(interval);
                    const tail = cleanInteractiveOutput(this.turnBuffer).slice(-1200);
                    reject(new Error(`Timed out waiting for Gemini CLI PTY reply. Tail: ${tail}`));
                }
            }, 500);
        });
    }

    dispose() {
        if (this.pty) {
            this.pty.kill();
            this.pty = null;
        }
        this.terminal?.dispose();
        this.terminal = null;
        this.serializeAddon = null;
    }

    getScreenText() {
        try {
            return this.serializeAddon?.serialize() || '';
        } catch (error) {
            return '';
        }
    }
}

function getPersistentSession(sessionKey) {
    const key = String(sessionKey || 'default');
    const existing = persistentSessions.get(key);
    if (existing) {
        return existing;
    }

    const session = new GeminiCliPtySession(key);
    persistentSessions.set(key, session);
    return session;
}

setInterval(() => {
    const now = Date.now();
    for (const [key, session] of persistentSessions.entries()) {
        if (now - session.lastUsedAt > PTY_IDLE_TTL_MS) {
            session.dispose();
            persistentSessions.delete(key);
        }
    }
}, 60 * 1000).unref?.();

function getRecentChatLines(messages = []) {
    return (Array.isArray(messages) ? messages : [])
        .slice(-20)
        .map((message) => {
            const role = message.sender_type === 'customer'
                ? 'Khach'
                : (message.sender_type === 'admin' ? 'Admin' : 'Tro ly');
            const content = String(message.message || '').trim();
            return content ? `${role}:\n${content}` : '';
        })
        .filter(Boolean);
}

function getMessageMetadata(message) {
    const metadata = message?.message_metadata;
    if (!metadata) {
        return null;
    }

    if (typeof metadata === 'object') {
        return metadata;
    }

    try {
        return JSON.parse(metadata);
    } catch (error) {
        return null;
    }
}

function getRecentProductContextLines(messages = []) {
    const list = Array.isArray(messages) ? messages : [];
    const productsById = new Map();
    const productsBySlug = new Map();
    const cumulativeProducts = [];

    for (let cursor = 0; cursor < list.length; cursor += 1) {
        const metadata = getMessageMetadata(list[cursor]);
        const products = Array.isArray(metadata?.products) ? metadata.products : [];
        products.forEach((product) => {
            const id = Number.parseInt(product?.id, 10);
            const slug = String(product?.slug || '').trim();
            const knownById = Number.isInteger(id) && productsById.has(id);
            const knownBySlug = slug && productsBySlug.has(slug);

            if (knownById || knownBySlug || !product?.name) {
                return;
            }

            cumulativeProducts.push(product);
            if (Number.isInteger(id)) {
                productsById.set(id, product);
            }
            if (slug) {
                productsBySlug.set(slug, product);
            }
        });
    }

    return cumulativeProducts
        .slice(0, 20)
        .map((product, index) => {
            const url = product.url || (product.slug ? `/products/${product.slug}` : '');
            const price = Number(product.final_price || product.price || 0);
            const priceText = price ? `${price.toLocaleString('vi-VN')} VND` : '';
            return `${index + 1}. ${product.name}${priceText ? ` - ${priceText}` : ''}${url ? ` - ${url}` : ''}`;
        })
        .filter(Boolean);
}

function getAttachmentPromptLines(attachments = []) {
    return (Array.isArray(attachments) ? attachments : [])
        .filter((attachment) => (attachment.mediaType || attachment.media_type) === 'image')
        .map((attachment, index) => {
            const localPath = attachment.localPath || attachment.local_path || '';
            const url = attachment.mediaUrl || attachment.media_url || '';
            if (localPath) {
                return `@${localPath}`;
            }
            if (url) {
                return `Anh ${index + 1} URL: ${url}`;
            }
            return '';
        })
        .filter(Boolean);
}

function getAttachmentDirectories(attachments = []) {
    return Array.from(new Set((Array.isArray(attachments) ? attachments : [])
        .map((attachment) => attachment.localPath || attachment.local_path || '')
        .filter(Boolean)
        .map((filePath) => path.dirname(filePath))));
}

function buildPrompt(systemPrompt, messages, userMessage, options = {}) {
    const recentLines = getRecentChatLines(messages);
    const recentProductLines = getRecentProductContextLines(messages);
    const attachmentLines = getAttachmentPromptLines(options.attachments);
    const normalizedUserMessage = userMessage || (attachmentLines.length ? 'Khach gui anh va can tu van san pham.' : '');
    const productCount = recentProductLines.length;
    const nextProductNumber = productCount + 1;

    return [
        attachmentLines.length ? attachmentLines.join('\n') : '',
        'Hãy tiếp tục cuộc hội thoại này như một phiên Gemini CLI đang chạy với MCP shop WIND OF FALL.',
        'Giữ cách trả lời tự nhiên, chi tiết và định dạng markdown/bullet như Gemini CLI.',
        'Chỉ gọi MCP khi bạn thấy cần dữ liệu shop. Nếu khách chỉ gọi/chào hỏi/nói đệm thì trả lời tự nhiên.',
        `Nếu khách muốn "thêm nữa", đánh số tiếp từ ${nextProductNumber} nếu đang nói về danh sách sản phẩm đã gợi ý.`,
        'Nếu khách hỏi sản phẩm theo số thứ tự, ưu tiên danh sách tích lũy bên dưới.',
        recentProductLines.length ? `Danh sách sản phẩm đã gợi ý trong toàn bộ cuộc hội thoại theo thứ tự tích lũy:\n${recentProductLines.join('\n')}` : '',
        systemPrompt ? `Thông tin bổ sung nếu cần:\n${systemPrompt}` : '',
        recentLines.length ? `Transcript gần đây:\n${recentLines.join('\n\n')}` : '',
        `Khách:\n${normalizedUserMessage}`
    ].filter(Boolean).join('\n\n');

    if (attachmentLines.length) {
        return [
            attachmentLines.join('\n'),
            `Yêu cầu của khách: "${normalizedUserMessage}".`,
            'Bạn là Gemini CLI đang chạy trong web chat local của shop WIND OF FALL. Hãy trả lời như trong phiên Gemini CLI, giữ nguyên ngữ cảnh hội thoại bên dưới.',
            'Hãy xem các ảnh trên và trả lời bằng tiếng Việt, ngắn gọn.',
            'Nếu khách muốn tìm sản phẩm từ ảnh, có thể dùng MCP shop để tìm mẫu gần nhất sau khi nhận diện ảnh.',
            recentProductLines.length ? `Danh sách sản phẩm đã gợi ý trong toàn bộ cuộc hội thoại theo thứ tự tích lũy:\n${recentProductLines.join('\n')}` : '',
            'Không nói về việc bạn đang chạy qua Gemini CLI hay MCP.',
            recentLines.length ? `Lịch sử gần đây:\n${recentLines.join('\n')}` : ''
        ].filter(Boolean).join('\n');
    }

    return [
        'Bạn là Gemini CLI đang chạy trong web chat local của shop WIND OF FALL. Hãy trả lời như trong phiên Gemini CLI, giữ nguyên ngữ cảnh hội thoại bên dưới.',
        `Yêu cầu mới của khách: "${normalizedUserMessage}".`,
        'Chỉ dùng tool MCP khi thật sự cần dữ liệu shop, sản phẩm, chính sách, hoặc đơn hàng. Nếu khách chỉ gọi/chào hỏi/nói đệm như "e ku", "ê ku", "alo", "shop oi" thì trả lời tự nhiên, không tìm sản phẩm.',
        'Nếu đây là yêu cầu tìm sản phẩm, dùng tool mcp_wind-of-fall-shop_search_products hoặc tool shop phù hợp với đúng query của khách.',
        `Đã có ${productCount} sản phẩm trong danh sách tích lũy. Nếu khách nói "thêm", "thêm nữa", "tìm thêm 1 sản phẩm nữa" thì tìm sản phẩm khác chưa có trong danh sách và đánh số tiếp từ ${nextProductNumber}, không bắt đầu lại từ 1.`,
        'Nếu khách hỏi "sản phẩm thứ 2", "còn sản phẩm thứ 2 thì sao", "mẫu thứ 3", "sản phẩm thứ 4" thì ưu tiên danh sách sản phẩm đã gợi ý theo thứ tự tích lũy, không tìm mới.',
        'Trả lời bằng tiếng Việt, dùng dữ liệu từ tool khi có gọi tool.',
        'Khi liệt kê danh sách sản phẩm, bắt buộc xuống dòng rõ ràng theo dạng danh sách đánh số; mỗi sản phẩm gồm tên, giá nếu có, và dòng link chi tiết riêng.',
        'Không nói về việc bạn đang chạy qua Gemini CLI hay MCP.',
        recentLines.length ? `Lịch sử gần đây:\n${recentLines.join('\n')}` : '',
        recentProductLines.length ? `Danh sách sản phẩm đã gợi ý trong toàn bộ cuộc hội thoại theo thứ tự tích lũy:\n${recentProductLines.join('\n')}` : '',
        systemPrompt ? `Thông tin bổ sung nếu cần:\n${systemPrompt}` : '',
        'Quy tắc bổ sung cho web chat: khi liệt kê hoặc gợi ý sản phẩm cụ thể, luôn kèm URL chi tiết /products/... hoặc http://localhost:3000/products/... trong câu trả lời để frontend có thể render link/card.'
    ].filter(Boolean).join('\n');
}

function buildInteractiveUserMessage(userMessage, options = {}) {
    const attachmentLines = getAttachmentPromptLines(options.attachments);
    return [
        ...attachmentLines,
        String(userMessage || '').trim()
    ].filter(Boolean).join('\n');
}

async function callGeminiCliAgent(systemPrompt, messages, userMessage, options = {}) {
    const runtimeEnv = await getGeminiCliRuntimeEnv();

    if (shouldUsePersistentPty() && options.sessionKey) {
        const interactiveMessage = buildInteractiveUserMessage(userMessage, options);
        const session = getPersistentSession(options.sessionKey);
        session.setRuntimeEnv(runtimeEnv);
        return session.ask(interactiveMessage).catch((error) => {
            console.error('Gemini CLI persistent PTY error:', error.message || error);
            return null;
        });
    }

    const command = getGeminiCommand();
    const model = process.env.GEMINI_CLI_MODEL || DEFAULT_MODEL;
    const mcpServer = process.env.GEMINI_CLI_MCP_SERVER || DEFAULT_MCP_SERVER;
    const timeoutMs = getTimeoutMs();
    const prompt = buildPrompt(systemPrompt, messages, userMessage, options);
    const attachmentDirectories = getAttachmentDirectories(options.attachments);
    const sessionState = getWebSessionState(options.sessionKey);
    const hasSession = hasWebSessionMarker(sessionState);
    let args = [
        '--skip-trust',
        '-m',
        model,
        '--allowed-mcp-server-names',
        mcpServer,
        ...SHOP_MCP_TOOLS.flatMap((toolName) => ['--allowed-tools', toolName]),
        '--approval-mode',
        'yolo',
        '--prompt',
        prompt,
        '--output-format',
        'text'
    ];

    if (sessionState?.sessionId) {
        args.push(hasSession ? '--resume' : '--session-id', sessionState.sessionId);
    }

    if (attachmentDirectories.length) {
        args.push('--include-directories', attachmentDirectories.join(','));
    }

    const executable = command.executable;
    args = [...command.prefixArgs, ...args];

    return new Promise((resolve) => {
        execFile(executable, args, {
            cwd: PROJECT_ROOT,
            timeout: timeoutMs,
            maxBuffer: 1024 * 1024 * 4,
            windowsHide: true,
            env: {
                ...process.env,
                ...runtimeEnv,
                GEMINI_CLI_TRUST_WORKSPACE: 'true'
            }
        }, (error, stdout, stderr) => {
            const output = cleanGeminiOutput(stdout);
            const errorOutput = cleanGeminiOutput(stderr);

            if (error) {
                console.error('Gemini CLI agent error:', error.message, errorOutput);
                resolve(null);
                return;
            }

            markWebSession(sessionState);
            resolve(output || null);
        });
    });
}

module.exports = {
    callGeminiCliAgent
};
