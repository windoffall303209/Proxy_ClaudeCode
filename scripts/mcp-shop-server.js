#!/usr/bin/env node

process.env.SKIP_DB_CONNECTION_PROBE = 'true';

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const z = require('zod/v4');

const pool = require('../config/database');
const Product = require('../models/Product');
const Category = require('../models/Category');
const StorefrontSetting = require('../models/StorefrontSetting');
const chatRagKnowledge = require('../config/chatRagKnowledge');

const DEFAULT_BASE_URL = process.env.APP_BASE_URL || process.env.PUBLIC_BASE_URL || 'http://localhost:3000';

function clampInt(value, fallback, min, max) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isInteger(parsed)) {
        return fallback;
    }
    return Math.min(max, Math.max(min, parsed));
}

function compactText(value, maxLength = 600) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (text.length <= maxLength) {
        return text;
    }
    return `${text.slice(0, maxLength - 3).trim()}...`;
}

function normalizeText(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\u0111/g, 'd')
        .replace(/\u0110/g, 'D')
        .toLowerCase()
        .trim();
}

function productUrl(product) {
    if (!product?.slug) {
        return null;
    }
    return `${DEFAULT_BASE_URL.replace(/\/$/, '')}/products/${product.slug}`;
}

function formatVnd(value) {
    const number = Number(value || 0);
    return `${number.toLocaleString('vi-VN')} VND`;
}

function parseCommaList(value) {
    return String(value || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
}

function toProductSummary(product, options = {}) {
    const includeDetail = Boolean(options.includeDetail);
    const finalPrice = Number(product.final_price || product.display_price || product.price || 0);
    const summary = {
        id: product.id,
        name: product.name,
        slug: product.slug,
        category: product.category_name || null,
        price: Number(product.price || 0),
        final_price: finalPrice,
        price_text: formatVnd(finalPrice),
        stock_quantity: Number(product.stock_quantity || 0),
        sold_count: Number(product.sold_count || 0),
        rating: Number(product.average_rating || 0),
        review_count: Number(product.review_count || 0),
        colors: parseCommaList(product.variant_colors),
        sizes: parseCommaList(product.variant_sizes),
        image_url: product.card_image || product.primary_image || null,
        url: productUrl(product)
    };

    if (includeDetail) {
        summary.sku = product.sku || null;
        summary.description = compactText(product.description, 1600);
        summary.images = Array.isArray(product.images)
            ? product.images.slice(0, 8).map((image) => image.image_url).filter(Boolean)
            : [];
        summary.variants = Array.isArray(product.variants)
            ? product.variants.slice(0, 24).map((variant) => ({
                id: variant.id,
                size: variant.size || null,
                color: variant.color || null,
                stock_quantity: Number(variant.stock_quantity || 0),
                additional_price: Number(variant.additional_price || 0),
                sku: variant.sku || null,
                image_url: variant.variant_image_url || null
            }))
            : [];
    }

    return summary;
}

function jsonResult(data) {
    return {
        content: [
            {
                type: 'text',
                text: JSON.stringify(data, null, 2)
            }
        ],
        structuredContent: data
    };
}

function scoreKnowledge(query, document) {
    const terms = normalizeText(query)
        .split(/[^a-z0-9]+/)
        .filter((term) => term.length >= 2);
    const haystack = normalizeText(`${document.title} ${document.content}`);

    if (!terms.length) {
        return 0;
    }

    return terms.reduce((score, term) => score + (haystack.includes(term) ? 1 : 0), 0);
}

async function getPublicSettings() {
    const settings = await StorefrontSetting.getAll();
    return {
        site_name: settings.site_name,
        site_tagline: settings.site_tagline,
        contact_hotline: settings.contact_hotline,
        contact_email: settings.contact_email,
        contact_address: settings.contact_address,
        opening_hours: settings.opening_hours,
        payment_methods: {
            cod: Boolean(settings.payment_cod_enabled),
            vnpay: Boolean(settings.payment_vnpay_enabled),
            momo: Boolean(settings.payment_momo_enabled)
        },
        free_shipping_min_amount: Number(settings.free_shipping_min_amount || 0),
        shipping_fee_amount: Number(settings.shipping_fee_amount || 0),
        return_window_days: Number(settings.return_window_days || 0),
        base_url: DEFAULT_BASE_URL
    };
}

async function findOrderForPublicTracking(orderCode, phone) {
    const normalizedCode = String(orderCode || '').trim();
    const normalizedPhone = String(phone || '').replace(/\D/g, '');

    if (!normalizedCode || normalizedPhone.length < 4) {
        return null;
    }

    const [orders] = await pool.execute(
        `SELECT o.id, o.order_code, o.status, o.payment_status, o.payment_method,
                o.final_amount, o.created_at, o.updated_at,
                s.carrier, s.tracking_code, s.tracking_url, s.current_status AS shipment_status,
                s.current_location_text, s.estimated_delivery_at, s.last_event_at
         FROM orders o
         LEFT JOIN shipments s ON s.order_id = o.id
         WHERE o.order_code = ?
           AND REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(o.shipping_phone, ''), ' ', ''), '.', ''), '-', ''), '(', ''), ')', '') LIKE ?
         LIMIT 1`,
        [normalizedCode, `%${normalizedPhone.slice(-6)}`]
    );

    const order = orders[0];
    if (!order) {
        return null;
    }

    const [items] = await pool.execute(
        `SELECT oi.product_name, oi.quantity, oi.price, oi.subtotal,
                p.slug AS product_slug, pv.size AS variant_size, pv.color AS variant_color
         FROM order_items oi
         LEFT JOIN products p ON p.id = oi.product_id
         LEFT JOIN product_variants pv ON pv.id = oi.variant_id
         WHERE oi.order_id = ?
         ORDER BY oi.id ASC`,
        [order.id]
    );

    const [events] = await pool.execute(
        `SELECT status, title, description, location_text, event_time
         FROM order_tracking_events
         WHERE order_id = ?
         ORDER BY event_time DESC, id DESC
         LIMIT 8`,
        [order.id]
    );

    return {
        order_code: order.order_code,
        status: order.status,
        payment_status: order.payment_status,
        payment_method: order.payment_method,
        total: Number(order.final_amount || 0),
        total_text: formatVnd(order.final_amount),
        created_at: order.created_at,
        updated_at: order.updated_at,
        shipment: {
            carrier: order.carrier || null,
            tracking_code: order.tracking_code || null,
            tracking_url: order.tracking_url || null,
            status: order.shipment_status || order.status,
            current_location_text: order.current_location_text || null,
            estimated_delivery_at: order.estimated_delivery_at || null,
            last_event_at: order.last_event_at || null
        },
        items: items.map((item) => ({
            product_name: item.product_name,
            quantity: Number(item.quantity || 0),
            price: Number(item.price || 0),
            subtotal: Number(item.subtotal || 0),
            variant_size: item.variant_size || null,
            variant_color: item.variant_color || null,
            url: item.product_slug ? `${DEFAULT_BASE_URL.replace(/\/$/, '')}/products/${item.product_slug}` : null
        })),
        tracking_events: events
    };
}

const server = new McpServer({
    name: 'wind-of-fall-shop',
    version: '1.0.0'
});

server.registerTool('search_products', {
    description: 'Search active WIND OF FALL products by customer query, style, category, color, size, or SKU.',
    inputSchema: {
        query: z.string().min(1).describe('Customer search query, for example "ao polo nam den size M".'),
        limit: z.number().int().min(1).max(20).optional().default(8)
    }
}, async ({ query, limit }) => {
    const safeLimit = clampInt(limit, 8, 1, 20);
    const products = await Product.search(query, safeLimit);
    return jsonResult({
        query,
        count: products.length,
        products: products.map((product) => toProductSummary(product))
    });
});

server.registerTool('list_products', {
    description: 'List active products by curated mode: best sellers, newest, featured, sale, or all.',
    inputSchema: {
        mode: z.enum(['best_sellers', 'newest', 'featured', 'sale', 'all']).optional().default('best_sellers'),
        limit: z.number().int().min(1).max(20).optional().default(8)
    }
}, async ({ mode, limit }) => {
    const safeLimit = clampInt(limit, 8, 1, 20);
    let products;

    if (mode === 'newest') {
        products = await Product.getNewProducts(safeLimit);
    } else if (mode === 'featured') {
        products = await Product.getFeaturedProducts(safeLimit);
    } else if (mode === 'sale') {
        products = await Product.findAll({
            on_sale: true,
            use_final_price: true,
            prioritize_in_stock: true,
            limit: safeLimit
        });
    } else if (mode === 'all') {
        products = await Product.findAll({
            prioritize_in_stock: true,
            limit: safeLimit
        });
    } else {
        products = await Product.getBestSellers(safeLimit);
    }

    return jsonResult({
        mode,
        count: products.length,
        products: products.map((product) => toProductSummary(product))
    });
});

server.registerTool('get_product_detail', {
    description: 'Get full public detail for one active product by id or slug.',
    inputSchema: {
        product_id: z.number().int().positive().optional(),
        slug: z.string().min(1).optional()
    }
}, async ({ product_id: productId, slug }) => {
    if (!productId && !slug) {
        throw new Error('Provide either product_id or slug.');
    }

    const product = productId
        ? await Product.findById(productId, { incrementView: false })
        : await Product.findBySlug(slug, { incrementView: false });

    if (!product) {
        return jsonResult({ found: false, product: null });
    }

    return jsonResult({
        found: true,
        product: toProductSummary(product, { includeDetail: true })
    });
});

server.registerTool('list_categories', {
    description: 'List active storefront categories with product counts.',
    inputSchema: {}
}, async () => {
    const categories = await Category.findAll();
    return jsonResult({
        count: categories.length,
        categories: categories.map((category) => ({
            id: category.id,
            name: category.name,
            slug: category.slug,
            parent_id: category.parent_id || null,
            depth: Number(category.tree_depth || 0),
            product_count: Number(category.product_count || 0),
            url: category.slug ? `${DEFAULT_BASE_URL.replace(/\/$/, '')}/products/category/${category.slug}` : null
        }))
    });
});

server.registerTool('get_storefront_info', {
    description: 'Get public store identity, contact, payment, shipping, and return policy context.',
    inputSchema: {}
}, async () => {
    const settings = await getPublicSettings();
    return jsonResult({
        settings,
        knowledge: chatRagKnowledge.map((document) => ({
            source_key: document.sourceKey,
            title: document.title,
            content: document.content
        }))
    });
});

server.registerTool('search_store_knowledge', {
    description: 'Search static store policy and support knowledge without calling any AI API.',
    inputSchema: {
        query: z.string().min(1),
        limit: z.number().int().min(1).max(10).optional().default(4)
    }
}, async ({ query, limit }) => {
    const safeLimit = clampInt(limit, 4, 1, 10);
    const matches = chatRagKnowledge
        .map((document) => ({
            source_key: document.sourceKey,
            title: document.title,
            content: document.content,
            score: scoreKnowledge(query, document)
        }))
        .filter((document) => document.score > 0)
        .sort((left, right) => right.score - left.score)
        .slice(0, safeLimit);

    return jsonResult({
        query,
        count: matches.length,
        matches
    });
});

server.registerTool('track_order', {
    description: 'Track a customer order by order code and the customer phone number. Returns limited public tracking data only.',
    inputSchema: {
        order_code: z.string().min(3),
        phone: z.string().min(4).describe('Customer phone number or at least the last 6 digits.')
    }
}, async ({ order_code: orderCode, phone }) => {
    const order = await findOrderForPublicTracking(orderCode, phone);
    return jsonResult({
        found: Boolean(order),
        order
    });
});

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('WIND OF FALL MCP server running on stdio');
}

main().catch((error) => {
    console.error('MCP server error:', error);
    process.exit(1);
});
