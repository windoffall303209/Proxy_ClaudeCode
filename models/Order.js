const crypto = require('crypto');
const pool = require('../config/database');

const ORDER_STATUSES = ['pending', 'confirmed', 'processing', 'shipping', 'delivered', 'cancelled'];
const TRACKING_SOURCES = new Set(['system', 'admin', 'carrier']);

const STATUS_EVENT_PRESETS = {
    pending: {
        title: 'Đơn hàng đã được tạo',
        description: 'Hệ thống đã ghi nhận đơn hàng và đang chờ xác nhận.'
    },
    confirmed: {
        title: 'Đơn hàng đã được xác nhận',
        description: 'Đơn hàng đã được xác nhận và đang được chuẩn bị bàn giao vận chuyển.'
    },
    processing: {
        title: 'Đơn hàng đang được xử lý',
        description: 'Kho hàng đang đóng gói và chuẩn bị xuất kho.'
    },
    shipping: {
        title: 'Đơn hàng đang được giao',
        description: 'Đơn hàng đã rời kho và đang trên đường giao đến người nhận.'
    },
    delivered: {
        title: 'Đơn hàng đã giao thành công',
        description: 'Người nhận đã nhận được đơn hàng.'
    },
    cancelled: {
        title: 'Đơn hàng đã bị hủy',
        description: 'Đơn hàng đã được hủy theo cập nhật mới nhất.'
    }
};

const SAFE_STATUS_EVENT_PRESETS = {
    pending: {
        title: '\u0110\u01a1n h\u00e0ng \u0111\u00e3 \u0111\u01b0\u1ee3c t\u1ea1o',
        description: 'H\u1ec7 th\u1ed1ng \u0111\u00e3 ghi nh\u1eadn \u0111\u01a1n h\u00e0ng v\u00e0 \u0111ang ch\u1edd x\u00e1c nh\u1eadn.'
    },
    confirmed: {
        title: '\u0110\u01a1n h\u00e0ng \u0111\u00e3 \u0111\u01b0\u1ee3c x\u00e1c nh\u1eadn',
        description: '\u0110\u01a1n h\u00e0ng \u0111\u00e3 \u0111\u01b0\u1ee3c x\u00e1c nh\u1eadn v\u00e0 \u0111ang \u0111\u01b0\u1ee3c chu\u1ea9n b\u1ecb b\u00e0n giao v\u1eadn chuy\u1ec3n.'
    },
    processing: {
        title: '\u0110\u01a1n h\u00e0ng \u0111ang \u0111\u01b0\u1ee3c x\u1eed l\u00fd',
        description: 'Kho h\u00e0ng \u0111ang \u0111\u00f3ng g\u00f3i v\u00e0 chu\u1ea9n b\u1ecb xu\u1ea5t kho.'
    },
    shipping: {
        title: '\u0110\u01a1n h\u00e0ng \u0111ang \u0111\u01b0\u1ee3c giao',
        description: '\u0110\u01a1n h\u00e0ng \u0111\u00e3 r\u1eddi kho v\u00e0 \u0111ang tr\u00ean \u0111\u01b0\u1eddng giao \u0111\u1ebfn ng\u01b0\u1eddi nh\u1eadn.'
    },
    delivered: {
        title: '\u0110\u01a1n h\u00e0ng \u0111\u00e3 giao th\u00e0nh c\u00f4ng',
        description: 'Ng\u01b0\u1eddi nh\u1eadn \u0111\u00e3 nh\u1eadn \u0111\u01b0\u1ee3c \u0111\u01a1n h\u00e0ng.'
    },
    cancelled: {
        title: '\u0110\u01a1n h\u00e0ng \u0111\u00e3 b\u1ecb h\u1ee7y',
        description: '\u0110\u01a1n h\u00e0ng \u0111\u00e3 \u0111\u01b0\u1ee3c h\u1ee7y theo c\u1eadp nh\u1eadt m\u1edbi nh\u1ea5t.'
    }
};

class Order {
    static generateOrderCode() {
        return `ORD${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    }

    static scopeCartData(cartData, selectedCartItemIds = null) {
        const items = Array.isArray(cartData?.items) ? cartData.items : [];

        if (selectedCartItemIds === null || selectedCartItemIds === undefined) {
            return {
                ...cartData,
                items,
                subtotal: items.reduce((sum, item) => sum + Number(item.subtotal || 0), 0),
                itemCount: items.reduce((sum, item) => sum + (Number.parseInt(item.quantity, 10) || 0), 0)
            };
        }

        const selectedIdSet = new Set(
            (Array.isArray(selectedCartItemIds) ? selectedCartItemIds : [])
                .map((id) => Number.parseInt(id, 10))
                .filter((id) => Number.isInteger(id) && id > 0)
        );
        const scopedItems = items.filter((item) => selectedIdSet.has(Number.parseInt(item.id, 10)));

        return {
            ...cartData,
            items: scopedItems,
            subtotal: scopedItems.reduce((sum, item) => sum + Number(item.subtotal || 0), 0),
            itemCount: scopedItems.reduce((sum, item) => sum + (Number.parseInt(item.quantity, 10) || 0), 0)
        };
    }

    static calculateShippingFee(subtotal) {
        return Number(subtotal) >= 500000 ? 0 : 30000;
    }

    static hasOwn(object, key) {
        return Object.prototype.hasOwnProperty.call(object, key);
    }

    static normalizeStatus(status) {
        const normalized = String(status || '').trim().toLowerCase();
        if (normalized === 'shipped') {
            return 'shipping';
        }
        return normalized;
    }

    static assertValidStatus(status) {
        const normalizedStatus = this.normalizeStatus(status);

        if (!ORDER_STATUSES.includes(normalizedStatus)) {
            throw new Error('Order status is invalid');
        }

        return normalizedStatus;
    }

    static normalizeTrackingSource(source) {
        const normalized = String(source || 'admin').trim().toLowerCase();
        return TRACKING_SOURCES.has(normalized) ? normalized : 'admin';
    }

    static getStatusEventPreset(status) {
        return SAFE_STATUS_EVENT_PRESETS[this.normalizeStatus(status)] || {
            title: 'Cập nhật đơn hàng',
            description: 'Thông tin đơn hàng đã được cập nhật.'
        };
    }

    static async assertAddressOwnership(connection, userId, addressId) {
        const [addresses] = await connection.execute(
            `SELECT id, full_name, phone, address_line, ward, district, city
             FROM addresses
             WHERE id = ? AND user_id = ?
             LIMIT 1
             FOR UPDATE`,
            [addressId, userId]
        );

        if (addresses.length === 0) {
            throw new Error('Address not found');
        }

        return addresses[0];
    }

    static async assertProductStock(connection, productId, quantity) {
        const [products] = await connection.execute(
            'SELECT id, is_active, stock_quantity FROM products WHERE id = ? LIMIT 1 FOR UPDATE',
            [productId]
        );

        const product = products[0];
        if (!product || product.is_active === false || product.is_active === 0) {
            throw new Error('Product is not available');
        }

        if (Number(product.stock_quantity) < quantity) {
            throw new Error('Insufficient product stock');
        }
    }

    static async assertVariantStock(connection, productId, variantId, quantity) {
        const [variants] = await connection.execute(
            'SELECT id, product_id, stock_quantity FROM product_variants WHERE id = ? LIMIT 1 FOR UPDATE',
            [variantId]
        );

        const variant = variants[0];
        if (!variant || Number(variant.product_id) !== Number(productId)) {
            throw new Error('Variant is not available for this product');
        }

        if (Number(variant.stock_quantity) < quantity) {
            throw new Error('Insufficient variant stock');
        }
    }

    static async validateOrderItemAvailability(connection, item) {
        const quantity = Number.parseInt(item.quantity, 10);

        if (!Number.isInteger(quantity) || quantity <= 0) {
            throw new Error('Cart contains invalid quantity');
        }

        await this.assertProductStock(connection, item.product_id, quantity);

        if (item.variant_id !== null && item.variant_id !== undefined) {
            await this.assertVariantStock(connection, item.product_id, item.variant_id, quantity);
        }
    }

    static async upsertShipment(connection, orderId, shipmentData = {}) {
        const normalizedData = { ...shipmentData };

        if (this.hasOwn(normalizedData, 'current_status') && normalizedData.current_status !== null) {
            normalizedData.current_status = this.assertValidStatus(normalizedData.current_status);
        }

        const [shipments] = await connection.execute(
            'SELECT * FROM shipments WHERE order_id = ? LIMIT 1 FOR UPDATE',
            [orderId]
        );

        if (shipments.length === 0) {
            const initialShipment = {
                carrier: this.hasOwn(normalizedData, 'carrier') ? normalizedData.carrier : null,
                tracking_code: this.hasOwn(normalizedData, 'tracking_code') ? normalizedData.tracking_code : null,
                tracking_url: this.hasOwn(normalizedData, 'tracking_url') ? normalizedData.tracking_url : null,
                current_status: this.hasOwn(normalizedData, 'current_status') && normalizedData.current_status
                    ? normalizedData.current_status
                    : 'pending',
                current_location_text: this.hasOwn(normalizedData, 'current_location_text')
                    ? normalizedData.current_location_text
                    : null,
                current_lat: this.hasOwn(normalizedData, 'current_lat') ? normalizedData.current_lat : null,
                current_lng: this.hasOwn(normalizedData, 'current_lng') ? normalizedData.current_lng : null,
                estimated_delivery_at: this.hasOwn(normalizedData, 'estimated_delivery_at')
                    ? normalizedData.estimated_delivery_at
                    : null,
                last_event_at: this.hasOwn(normalizedData, 'last_event_at') ? normalizedData.last_event_at : null
            };

            const [result] = await connection.execute(
                `INSERT INTO shipments (
                    order_id, carrier, tracking_code, tracking_url, current_status,
                    current_location_text, current_lat, current_lng, estimated_delivery_at, last_event_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    orderId,
                    initialShipment.carrier,
                    initialShipment.tracking_code,
                    initialShipment.tracking_url,
                    initialShipment.current_status,
                    initialShipment.current_location_text,
                    initialShipment.current_lat,
                    initialShipment.current_lng,
                    initialShipment.estimated_delivery_at,
                    initialShipment.last_event_at
                ]
            );

            const [createdRows] = await connection.execute(
                'SELECT * FROM shipments WHERE id = ? LIMIT 1',
                [result.insertId]
            );

            return createdRows[0] || null;
        }

        const shipment = shipments[0];
        const updates = [];
        const params = [];

        ['carrier', 'tracking_code', 'tracking_url', 'current_status', 'current_location_text', 'current_lat', 'current_lng', 'estimated_delivery_at', 'last_event_at']
            .forEach((field) => {
                if (this.hasOwn(normalizedData, field)) {
                    updates.push(`${field} = ?`);
                    params.push(normalizedData[field]);
                }
            });

        if (updates.length > 0) {
            params.push(shipment.id);
            await connection.execute(
                `UPDATE shipments SET ${updates.join(', ')} WHERE id = ?`,
                params
            );
        }

        const [updatedRows] = await connection.execute(
            'SELECT * FROM shipments WHERE id = ? LIMIT 1',
            [shipment.id]
        );

        return updatedRows[0] || shipment;
    }

    static async createTrackingEvent(connection, orderId, eventData = {}) {
        const normalizedStatus = this.assertValidStatus(eventData.status || 'pending');
        const eventPreset = this.getStatusEventPreset(normalizedStatus);
        const eventTime = eventData.event_time || new Date();

        await connection.execute(
            `INSERT INTO order_tracking_events (
                order_id, shipment_id, status, title, description,
                location_text, lat, lng, event_time, source, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                orderId,
                eventData.shipment_id || null,
                normalizedStatus,
                eventData.title || eventPreset.title,
                eventData.description || eventPreset.description,
                this.hasOwn(eventData, 'location_text') ? eventData.location_text : null,
                this.hasOwn(eventData, 'lat') ? eventData.lat : null,
                this.hasOwn(eventData, 'lng') ? eventData.lng : null,
                eventTime,
                this.normalizeTrackingSource(eventData.source),
                eventData.created_by || null
            ]
        );
    }

    static async initializeTracking(connection, orderId, status = 'pending') {
        const normalizedStatus = this.assertValidStatus(status);
        const shipment = await this.upsertShipment(connection, orderId, {
            current_status: normalizedStatus,
            last_event_at: new Date()
        });

        await this.createTrackingEvent(connection, orderId, {
            shipment_id: shipment?.id || null,
            status: normalizedStatus,
            source: 'system'
        });
    }

    static async attachTrackingData(order) {
        const [shipments] = await pool.execute(
            'SELECT * FROM shipments WHERE order_id = ? LIMIT 1',
            [order.id]
        );
        order.shipment = shipments[0] || null;

        const [events] = await pool.execute(
            `SELECT ote.*, u.full_name AS created_by_name
             FROM order_tracking_events ote
             LEFT JOIN users u ON ote.created_by = u.id
             WHERE ote.order_id = ?
             ORDER BY ote.event_time DESC, ote.id DESC`,
            [order.id]
        );
        order.tracking_events = events;

        return order;
    }

    static async create(userId, addressId, paymentMethod, notes = null, shippingFeeFromUI = null, discountAmount = 0, voucherCode = null, voucherId = null, selectedCartItemIds = null) {
        const connection = await pool.getConnection();

        try {
            await connection.beginTransaction();
            const addressSnapshot = await this.assertAddressOwnership(connection, userId, addressId);

            const Cart = require('./Cart');
            const [carts] = await connection.execute(
                'SELECT id FROM cart WHERE user_id = ?',
                [userId]
            );

            if (carts.length === 0) {
                throw new Error('Cart not found');
            }

            const cartId = carts[0].id;
            const cartData = this.scopeCartData(
                await Cart.calculateTotal(cartId),
                selectedCartItemIds
            );

            if (cartData.items.length === 0) {
                throw new Error('Cart is empty');
            }

            const orderCode = this.generateOrderCode();
            const shippingFee = this.calculateShippingFee(cartData.subtotal);
            const finalAmount = Math.max(0, cartData.subtotal + shippingFee - discountAmount);

            const [orderResult] = await connection.execute(
                `INSERT INTO orders (
                    user_id, address_id, shipping_name, shipping_phone, shipping_address_line,
                    shipping_ward, shipping_district, shipping_city, voucher_id, order_code,
                    total_amount, discount_amount, shipping_fee, final_amount, payment_method, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    userId,
                    addressId,
                    addressSnapshot.full_name,
                    addressSnapshot.phone,
                    addressSnapshot.address_line,
                    addressSnapshot.ward || null,
                    addressSnapshot.district || null,
                    addressSnapshot.city,
                    voucherId,
                    orderCode,
                    cartData.subtotal,
                    discountAmount,
                    shippingFee,
                    finalAmount,
                    paymentMethod,
                    notes
                ]
            );

            const orderId = orderResult.insertId;

            for (const item of cartData.items) {
                await this.validateOrderItemAvailability(connection, item);

                const saleDiscount = item.product_price - item.unit_price;

                await connection.execute(
                    `INSERT INTO order_items (
                        order_id, product_id, variant_id, product_name, product_image,
                        price, sale_applied, quantity, subtotal
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        orderId,
                        item.product_id,
                        item.variant_id ?? null,
                        item.product_name,
                        item.product_image,
                        item.product_price,
                        saleDiscount,
                        item.quantity,
                        item.subtotal
                    ]
                );

                await connection.execute(
                    'UPDATE products SET stock_quantity = stock_quantity - ?, sold_count = sold_count + ? WHERE id = ?',
                    [item.quantity, item.quantity, item.product_id]
                );

                if (item.variant_id) {
                    await connection.execute(
                        'UPDATE product_variants SET stock_quantity = stock_quantity - ? WHERE id = ?',
                        [item.quantity, item.variant_id]
                    );
                }
            }

            if (voucherId && discountAmount > 0) {
                await connection.execute(
                    'INSERT INTO voucher_usage (voucher_id, user_id, order_id, discount_amount) VALUES (?, ?, ?, ?)',
                    [voucherId, userId, orderId, discountAmount]
                );

                await connection.execute(
                    'UPDATE vouchers SET used_count = used_count + 1 WHERE id = ?',
                    [voucherId]
                );
            }

            const itemIdsToDelete = cartData.items
                .map((item) => Number.parseInt(item.id, 10))
                .filter((id) => Number.isInteger(id) && id > 0);

            if (itemIdsToDelete.length > 0) {
                const placeholders = itemIdsToDelete.map(() => '?').join(', ');
                await connection.execute(
                    `DELETE FROM cart_items WHERE cart_id = ? AND id IN (${placeholders})`,
                    [cartId, ...itemIdsToDelete]
                );
            }

            await this.initializeTracking(connection, orderId, 'pending');
            await connection.commit();

            return { id: orderId, order_code: orderCode, final_amount: finalAmount };
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    static async createFromProduct(userId, addressId, product, quantity, paymentMethod, notes = null, variantId = null, discountAmount = 0, voucherId = null) {
        const connection = await pool.getConnection();

        try {
            await connection.beginTransaction();
            const addressSnapshot = await this.assertAddressOwnership(connection, userId, addressId);

            const quantityNumber = Number.parseInt(quantity, 10);
            if (!Number.isInteger(quantityNumber) || quantityNumber <= 0) {
                throw new Error('Quantity is invalid');
            }

            await this.assertProductStock(connection, product.id, quantityNumber);
            if (variantId !== null && variantId !== undefined) {
                await this.assertVariantStock(connection, product.id, variantId, quantityNumber);
            }

            const orderCode = this.generateOrderCode();
            const price = product.final_price || product.price;
            const subtotal = price * quantityNumber;
            const shippingFee = this.calculateShippingFee(subtotal);
            const finalAmount = Math.max(0, subtotal + shippingFee - discountAmount);

            const [orderResult] = await connection.execute(
                `INSERT INTO orders (
                    user_id, address_id, shipping_name, shipping_phone, shipping_address_line,
                    shipping_ward, shipping_district, shipping_city, voucher_id, order_code,
                    total_amount, discount_amount, shipping_fee, final_amount, payment_method, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    userId,
                    addressId,
                    addressSnapshot.full_name,
                    addressSnapshot.phone,
                    addressSnapshot.address_line,
                    addressSnapshot.ward || null,
                    addressSnapshot.district || null,
                    addressSnapshot.city,
                    voucherId,
                    orderCode,
                    subtotal,
                    discountAmount,
                    shippingFee,
                    finalAmount,
                    paymentMethod,
                    notes
                ]
            );

            const orderId = orderResult.insertId;
            const productImage = product.images && product.images.length > 0 ? product.images[0].image_url : null;
            const saleDiscount = product.price - price;

            await connection.execute(
                `INSERT INTO order_items (
                    order_id, product_id, variant_id, product_name, product_image,
                    price, sale_applied, quantity, subtotal
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    orderId,
                    product.id,
                    variantId ?? null,
                    product.name,
                    productImage,
                    product.price,
                    saleDiscount,
                    quantityNumber,
                    subtotal
                ]
            );

            await connection.execute(
                'UPDATE products SET stock_quantity = stock_quantity - ?, sold_count = sold_count + ? WHERE id = ?',
                [quantityNumber, quantityNumber, product.id]
            );

            if (variantId) {
                await connection.execute(
                    'UPDATE product_variants SET stock_quantity = stock_quantity - ? WHERE id = ?',
                    [quantityNumber, variantId]
                );
            }

            if (voucherId && discountAmount > 0) {
                await connection.execute(
                    'INSERT INTO voucher_usage (voucher_id, user_id, order_id, discount_amount) VALUES (?, ?, ?, ?)',
                    [voucherId, userId, orderId, discountAmount]
                );

                await connection.execute(
                    'UPDATE vouchers SET used_count = used_count + 1 WHERE id = ?',
                    [voucherId]
                );
            }

            await this.initializeTracking(connection, orderId, 'pending');
            await connection.commit();

            return { id: orderId, order_code: orderCode, final_amount: finalAmount };
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    static async findById(orderId) {
        const [orders] = await pool.execute(
            `SELECT o.*,
                    COALESCE(o.shipping_name, a.full_name) AS shipping_name,
                    COALESCE(o.shipping_phone, a.phone) AS shipping_phone,
                    COALESCE(o.shipping_address_line, a.address_line) AS address_line,
                    COALESCE(o.shipping_ward, a.ward) AS ward,
                    COALESCE(o.shipping_district, a.district) AS district,
                    COALESCE(o.shipping_city, a.city) AS city,
                    u.email AS user_email,
                    u.full_name AS user_name
             FROM orders o
             LEFT JOIN addresses a ON o.address_id = a.id
             JOIN users u ON o.user_id = u.id
             WHERE o.id = ?`,
            [orderId]
        );
        const order = orders[0];

        if (!order) {
            return null;
        }

        const [items] = await pool.execute(
            `SELECT oi.*, pv.size AS variant_size, pv.color AS variant_color
             FROM order_items oi
             LEFT JOIN product_variants pv ON oi.variant_id = pv.id
             WHERE oi.order_id = ?`,
            [orderId]
        );
        order.items = items;

        const [payments] = await pool.execute(
            'SELECT * FROM payments WHERE order_id = ? ORDER BY created_at DESC LIMIT 1',
            [orderId]
        );
        order.payment = payments[0] || null;

        await this.attachTrackingData(order);
        return order;
    }

    static async findByOrderCode(orderCode) {
        const [orders] = await pool.execute('SELECT id FROM orders WHERE order_code = ?', [orderCode]);
        if (orders.length > 0) {
            return this.findById(orders[0].id);
        }
        return null;
    }

    static async findByUser(userId, limit = 20, offset = 0) {
        const [orders] = await pool.execute(
            `SELECT o.*,
                    s.current_location_text AS shipment_current_location_text,
                    s.estimated_delivery_at AS shipment_estimated_delivery_at,
                    s.tracking_code AS shipment_tracking_code,
                    s.carrier AS shipment_carrier
             FROM orders o
             LEFT JOIN shipments s ON s.order_id = o.id
             WHERE o.user_id = ?
             ORDER BY o.created_at DESC
             LIMIT ? OFFSET ?`,
            [userId, String(limit), String(offset)]
        );

        for (const order of orders) {
            const [items] = await pool.execute(
                `SELECT oi.*, p.name AS product_name,
                        pv.size AS variant_size, pv.color AS variant_color,
                        (
                            SELECT pi.image_url
                            FROM product_images pi
                            WHERE pi.product_id = oi.product_id AND pi.is_primary = TRUE
                            LIMIT 1
                        ) AS image_url
                 FROM order_items oi
                 LEFT JOIN products p ON oi.product_id = p.id
                 LEFT JOIN product_variants pv ON oi.variant_id = pv.id
                 WHERE oi.order_id = ?`,
                [order.id]
            );
            order.items = items;
        }

        return orders;
    }

    static async updateStatus(orderId, status, trackingData = {}, options = {}) {
        const normalizedStatus = this.assertValidStatus(status);
        const connection = await pool.getConnection();

        try {
            await connection.beginTransaction();

            const [orders] = await connection.execute(
                'SELECT id, status FROM orders WHERE id = ? LIMIT 1 FOR UPDATE',
                [orderId]
            );
            const order = orders[0];

            if (!order) {
                throw new Error('Order not found');
            }

            const previousStatus = this.normalizeStatus(order.status);
            const statusChanged = previousStatus !== normalizedStatus;

            if (statusChanged) {
                await connection.execute(
                    'UPDATE orders SET status = ? WHERE id = ?',
                    [normalizedStatus, orderId]
                );
            }

            const trackingFields = ['carrier', 'tracking_code', 'tracking_url', 'current_location_text', 'current_lat', 'current_lng', 'estimated_delivery_at'];
            const hasTrackingPatch = trackingFields.some((field) => this.hasOwn(trackingData, field));
            const hasExplicitEventText = this.hasOwn(trackingData, 'title') || this.hasOwn(trackingData, 'description');
            const eventTime = trackingData.event_time || new Date();

            const shipmentPatch = {
                current_status: normalizedStatus,
                ...(hasTrackingPatch ? trackingData : {})
            };

            if (statusChanged || hasTrackingPatch || hasExplicitEventText) {
                shipmentPatch.last_event_at = eventTime;
            }

            const shipment = await this.upsertShipment(connection, orderId, shipmentPatch);

            if (statusChanged || hasTrackingPatch || hasExplicitEventText || this.hasOwn(trackingData, 'event_time')) {
                const statusPreset = this.getStatusEventPreset(normalizedStatus);
                const defaultTrackingDescription = 'Thông tin vận chuyển của đơn hàng đã được cập nhật.';

                await this.createTrackingEvent(connection, orderId, {
                    shipment_id: shipment?.id || null,
                    status: normalizedStatus,
                    title: trackingData.title || (statusChanged ? statusPreset.title : 'Cập nhật thông tin vận chuyển'),
                    description: trackingData.description || (statusChanged ? statusPreset.description : defaultTrackingDescription),
                    location_text: this.hasOwn(trackingData, 'current_location_text')
                        ? trackingData.current_location_text
                        : shipment?.current_location_text ?? null,
                    lat: this.hasOwn(trackingData, 'current_lat')
                        ? trackingData.current_lat
                        : shipment?.current_lat ?? null,
                    lng: this.hasOwn(trackingData, 'current_lng')
                        ? trackingData.current_lng
                        : shipment?.current_lng ?? null,
                    event_time: eventTime,
                    source: trackingData.source || 'admin',
                    created_by: options.actorUserId || null
                });
            }

            await connection.commit();
            return this.findById(orderId);
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    static async updatePaymentStatus(orderId, paymentStatus) {
        await pool.execute(
            'UPDATE orders SET payment_status = ? WHERE id = ?',
            [paymentStatus, orderId]
        );
    }

    static async findAll(filters = {}) {
        let query = `
            SELECT o.*,
                   u.full_name AS user_name,
                   u.email AS user_email,
                   (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) AS item_count
            FROM orders o
            JOIN users u ON o.user_id = u.id
            WHERE 1 = 1
        `;
        const params = [];

        if (filters.status) {
            query += ' AND o.status = ?';
            params.push(this.assertValidStatus(filters.status));
        }

        if (filters.payment_status) {
            query += ' AND o.payment_status = ?';
            params.push(filters.payment_status);
        }

        if (filters.search) {
            query += ' AND (o.order_code LIKE ? OR u.full_name LIKE ? OR u.email LIKE ? OR COALESCE(o.shipping_name, \'\') LIKE ? OR COALESCE(o.shipping_phone, \'\') LIKE ?)';
            const searchTerm = `%${filters.search}%`;
            params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
        }

        query += ' ORDER BY o.created_at DESC';

        if (filters.limit) {
            const limit = parseInt(filters.limit, 10) || 50;
            const offset = parseInt(filters.offset, 10) || 0;
            query += ` LIMIT ${limit} OFFSET ${offset}`;
        }

        const [orders] = await pool.query(query, params);
        return orders;
    }

    static async getStatistics() {
        const [stats] = await pool.execute(`
            SELECT
                COUNT(*) AS total_orders,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending_orders,
                SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) AS delivered_orders,
                SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_orders,
                SUM(final_amount) AS total_revenue,
                SUM(CASE WHEN DATE(created_at) = CURDATE() THEN final_amount ELSE 0 END) AS today_revenue,
                SUM(CASE WHEN YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE()) THEN final_amount ELSE 0 END) AS month_revenue
            FROM orders
        `);

        return stats[0];
    }
}

module.exports = Order;
