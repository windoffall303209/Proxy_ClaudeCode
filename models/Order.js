// Model truy vấn và chuẩn hóa dữ liệu đơn hàng trong MySQL.
const crypto = require("crypto");
const pool = require("../config/database");
const StorefrontSetting = require("./StorefrontSetting");

const ORDER_STATUSES = [
  "pending_payment",
  "pending",
  "confirmed",
  "processing",
  "shipping",
  "delivered",
  "completed",
  "cancelled",
];
const TRACKING_SOURCES = new Set(["system", "admin", "carrier", "user"]);
const ONLINE_PAYMENT_METHODS = new Set(["vnpay", "momo"]);
const PAYMENT_WINDOW_HOURS = 24;
const DEFAULT_FREE_SHIPPING_MIN_AMOUNT = 500000;
const DEFAULT_SHIPPING_FEE = 30000;

const STATUS_EVENT_PRESETS = {
  pending_payment: {
    title: "Đơn hàng đang chờ thanh toán",
    description:
      "Đơn hàng đã được tạo và đang chờ khách hàng hoàn tất thanh toán.",
  },
  pending: {
    title: "Đơn hàng đã được tạo",
    description: "Hệ thống đã ghi nhận đơn hàng và đang chờ xác nhận.",
  },
  confirmed: {
    title: "Đơn hàng đã được xác nhận",
    description:
      "Đơn hàng đã được xác nhận và đang được chuẩn bị bàn giao vận chuyển.",
  },
  processing: {
    title: "Đơn hàng đang được xử lý",
    description: "Kho hàng đang đóng gói và chuẩn bị xuất kho.",
  },
  shipping: {
    title: "Đơn hàng đang được giao",
    description: "Đơn hàng đã rời kho và đang trên đường giao đến người nhận.",
  },
  delivered: {
    title: "Đơn hàng đã giao thành công",
    description: "Người nhận đã nhận được đơn hàng.",
  },
  completed: {
    title: "Đơn hàng đã hoàn thành",
    description:
      "Người mua đã xác nhận nhận hàng và đơn hàng được ghi nhận hoàn thành.",
  },
  cancelled: {
    title: "Đơn hàng đã bị hủy",
    description: "Đơn hàng đã được hủy theo cập nhật mới nhất.",
  },
};

const SAFE_STATUS_EVENT_PRESETS = {
  pending_payment: {
    title: "\u0110\u01a1n h\u00e0ng \u0111ang ch\u1edd thanh to\u00e1n",
    description:
      "\u0110\u01a1n h\u00e0ng \u0111\u00e3 \u0111\u01b0\u1ee3c t\u1ea1o v\u00e0 \u0111ang ch\u1edd kh\u00e1ch h\u00e0ng ho\u00e0n t\u1ea5t thanh to\u00e1n.",
  },
  pending: {
    title: "\u0110\u01a1n h\u00e0ng \u0111\u00e3 \u0111\u01b0\u1ee3c t\u1ea1o",
    description:
      "H\u1ec7 th\u1ed1ng \u0111\u00e3 ghi nh\u1eadn \u0111\u01a1n h\u00e0ng v\u00e0 \u0111ang ch\u1edd x\u00e1c nh\u1eadn.",
  },
  confirmed: {
    title:
      "\u0110\u01a1n h\u00e0ng \u0111\u00e3 \u0111\u01b0\u1ee3c x\u00e1c nh\u1eadn",
    description:
      "\u0110\u01a1n h\u00e0ng \u0111\u00e3 \u0111\u01b0\u1ee3c x\u00e1c nh\u1eadn v\u00e0 \u0111ang \u0111\u01b0\u1ee3c chu\u1ea9n b\u1ecb b\u00e0n giao v\u1eadn chuy\u1ec3n.",
  },
  processing: {
    title:
      "\u0110\u01a1n h\u00e0ng \u0111ang \u0111\u01b0\u1ee3c x\u1eed l\u00fd",
    description:
      "Kho h\u00e0ng \u0111ang \u0111\u00f3ng g\u00f3i v\u00e0 chu\u1ea9n b\u1ecb xu\u1ea5t kho.",
  },
  shipping: {
    title: "\u0110\u01a1n h\u00e0ng \u0111ang \u0111\u01b0\u1ee3c giao",
    description:
      "\u0110\u01a1n h\u00e0ng \u0111\u00e3 r\u1eddi kho v\u00e0 \u0111ang tr\u00ean \u0111\u01b0\u1eddng giao \u0111\u1ebfn ng\u01b0\u1eddi nh\u1eadn.",
  },
  delivered: {
    title: "\u0110\u01a1n h\u00e0ng \u0111\u00e3 giao th\u00e0nh c\u00f4ng",
    description:
      "Ng\u01b0\u1eddi nh\u1eadn \u0111\u00e3 nh\u1eadn \u0111\u01b0\u1ee3c \u0111\u01a1n h\u00e0ng.",
  },
  completed: {
    title: "\u0110\u01a1n h\u00e0ng \u0111\u00e3 ho\u00e0n th\u00e0nh",
    description:
      "Ng\u01b0\u1eddi mua \u0111\u00e3 x\u00e1c nh\u1eadn nh\u1eadn h\u00e0ng v\u00e0 \u0111\u01a1n h\u00e0ng \u0111\u01b0\u1ee3c ghi nh\u1eadn ho\u00e0n th\u00e0nh.",
  },
  cancelled: {
    title: "\u0110\u01a1n h\u00e0ng \u0111\u00e3 b\u1ecb h\u1ee7y",
    description:
      "\u0110\u01a1n h\u00e0ng \u0111\u00e3 \u0111\u01b0\u1ee3c h\u1ee7y theo c\u1eadp nh\u1eadt m\u1edbi nh\u1ea5t.",
  },
};

class Order {
  // Thao tác với generate đơn hàng mã.
  static generateOrderCode() {
    return `ORD${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
  }

  // Thao tác với scope giỏ hàng dữ liệu.
  static scopeCartData(cartData, selectedCartItemIds = null) {
    const items = Array.isArray(cartData?.items) ? cartData.items : [];

    if (selectedCartItemIds === null || selectedCartItemIds === undefined) {
      return {
        ...cartData,
        items,
        subtotal: items.reduce(
          (sum, item) => sum + Number(item.subtotal || 0),
          0,
        ),
        itemCount: items.reduce(
          (sum, item) => sum + (Number.parseInt(item.quantity, 10) || 0),
          0,
        ),
      };
    }

    const selectedIdSet = new Set(
      (Array.isArray(selectedCartItemIds) ? selectedCartItemIds : [])
        .map((id) => Number.parseInt(id, 10))
        .filter((id) => Number.isInteger(id) && id > 0),
    );
    const scopedItems = items.filter((item) =>
      selectedIdSet.has(Number.parseInt(item.id, 10)),
    );

    return {
      ...cartData,
      items: scopedItems,
      subtotal: scopedItems.reduce(
        (sum, item) => sum + Number(item.subtotal || 0),
        0,
      ),
      itemCount: scopedItems.reduce(
        (sum, item) => sum + (Number.parseInt(item.quantity, 10) || 0),
        0,
      ),
    };
  }

  // Tính shipping fee.
  static calculateShippingFee(
    subtotal,
    freeShippingMinAmount = DEFAULT_FREE_SHIPPING_MIN_AMOUNT,
    shippingFeeAmount = DEFAULT_SHIPPING_FEE,
  ) {
    const threshold = Number(freeShippingMinAmount);
    const normalizedThreshold = Number.isFinite(threshold)
      ? Math.max(0, threshold)
      : DEFAULT_FREE_SHIPPING_MIN_AMOUNT;
    const fee = Number(shippingFeeAmount);
    const normalizedFee = Number.isFinite(fee)
      ? Math.max(0, fee)
      : DEFAULT_SHIPPING_FEE;

    return Number(subtotal) >= normalizedThreshold ? 0 : normalizedFee;
  }

  static async getFreeShippingMinAmount() {
    try {
      const settings = await StorefrontSetting.getAll();
      const amount = Number.parseInt(settings.free_shipping_min_amount, 10);
      return Number.isInteger(amount) && amount >= 0
        ? amount
        : DEFAULT_FREE_SHIPPING_MIN_AMOUNT;
    } catch (error) {
      return DEFAULT_FREE_SHIPPING_MIN_AMOUNT;
    }
  }

  static async getShippingFeeAmount() {
    try {
      const settings = await StorefrontSetting.getAll();
      const amount = Number.parseInt(settings.shipping_fee_amount, 10);
      return Number.isInteger(amount) && amount >= 0
        ? amount
        : DEFAULT_SHIPPING_FEE;
    } catch (error) {
      return DEFAULT_SHIPPING_FEE;
    }
  }

  static async resolveShippingFee(subtotal) {
    const freeShippingMinAmount = await this.getFreeShippingMinAmount();
    const shippingFeeAmount = await this.getShippingFeeAmount();
    return this.calculateShippingFee(
      subtotal,
      freeShippingMinAmount,
      shippingFeeAmount,
    );
  }

  // Lấy initial trạng thái for thanh toán.
  static getInitialStatusForPayment(paymentMethod, finalAmount) {
    const method = String(paymentMethod || "")
      .trim()
      .toLowerCase();
    const amount = Number(finalAmount) || 0;
    return ["vnpay", "momo"].includes(method) && amount > 0
      ? "pending_payment"
      : "pending";
  }

  // Tính hạn thanh toán cho đơn online cần trả tiền.
  static async getPaymentWindowHours() {
    try {
      const settings = await StorefrontSetting.getAll();
      const hours = Number.parseInt(settings.payment_window_hours, 10);
      return Number.isInteger(hours) && hours > 0 ? hours : PAYMENT_WINDOW_HOURS;
    } catch (error) {
      return PAYMENT_WINDOW_HOURS;
    }
  }

  static async getPaymentExpiresAt(paymentMethod, finalAmount) {
    const method = String(paymentMethod || "")
      .trim()
      .toLowerCase();
    const amount = Number(finalAmount) || 0;

    if (!ONLINE_PAYMENT_METHODS.has(method) || amount <= 0) {
      return null;
    }

    const paymentWindowHours = await this.getPaymentWindowHours();
    return new Date(Date.now() + paymentWindowHours * 60 * 60 * 1000);
  }

  // Kiểm tra own.
  static hasOwn(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
  }

  // Chuẩn hóa trạng thái.
  static normalizeStatus(status) {
    const normalized = String(status || "")
      .trim()
      .toLowerCase();
    if (normalized === "shipped") {
      return "shipping";
    }
    return normalized;
  }

  // Thao tác với assert valid trạng thái.
  static assertValidStatus(status) {
    const normalizedStatus = this.normalizeStatus(status);

    if (!ORDER_STATUSES.includes(normalizedStatus)) {
      throw new Error("Order status is invalid");
    }

    return normalizedStatus;
  }

  // Chuẩn hóa tracking source.
  static normalizeTrackingSource(source) {
    const normalized = String(source || "admin")
      .trim()
      .toLowerCase();
    return TRACKING_SOURCES.has(normalized) ? normalized : "admin";
  }

  // Lấy trạng thái event preset.
  static getStatusEventPreset(status) {
    return (
      SAFE_STATUS_EVENT_PRESETS[this.normalizeStatus(status)] || {
        title: "Cập nhật đơn hàng",
        description: "Thông tin đơn hàng đã được cập nhật.",
      }
    );
  }

  // Thao tác với assert địa chỉ ownership.
  static async assertAddressOwnership(connection, userId, addressId) {
    const [addresses] = await connection.execute(
      `SELECT id, full_name, phone, address_line, ward, district, city
             FROM addresses
             WHERE id = ? AND user_id = ?
             LIMIT 1
             FOR UPDATE`,
      [addressId, userId],
    );

    if (addresses.length === 0) {
      throw new Error("Address not found");
    }

    return addresses[0];
  }

  // Thao tác với assert sản phẩm stock.
  static async assertProductStock(connection, productId, quantity) {
    const [products] = await connection.execute(
      "SELECT id, is_active, stock_quantity FROM products WHERE id = ? LIMIT 1 FOR UPDATE",
      [productId],
    );

    const product = products[0];
    if (!product || product.is_active === false || product.is_active === 0) {
      throw new Error("Product is not available");
    }

    if (Number(product.stock_quantity) < quantity) {
      throw new Error("Insufficient product stock");
    }
  }

  // Thao tác với assert biến thể stock.
  static async assertVariantStock(connection, productId, variantId, quantity) {
    const [variants] = await connection.execute(
      "SELECT id, product_id, stock_quantity FROM product_variants WHERE id = ? LIMIT 1 FOR UPDATE",
      [variantId],
    );

    const variant = variants[0];
    if (!variant || Number(variant.product_id) !== Number(productId)) {
      throw new Error("Variant is not available for this product");
    }

    if (Number(variant.stock_quantity) < quantity) {
      throw new Error("Insufficient variant stock");
    }
  }

  // Kiểm tra hợp lệ đơn hàng item availability.
  static async validateOrderItemAvailability(connection, item) {
    const quantity = Number.parseInt(item.quantity, 10);

    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error("Cart contains invalid quantity");
    }

    await this.assertProductStock(connection, item.product_id, quantity);

    if (item.variant_id !== null && item.variant_id !== undefined) {
      await this.assertVariantStock(
        connection,
        item.product_id,
        item.variant_id,
        quantity,
      );
    }
  }

  // Thao tác với upsert shipment.
  static async upsertShipment(connection, orderId, shipmentData = {}) {
    const normalizedData = { ...shipmentData };

    if (
      this.hasOwn(normalizedData, "current_status") &&
      normalizedData.current_status !== null
    ) {
      normalizedData.current_status = this.assertValidStatus(
        normalizedData.current_status,
      );
    }

    const [shipments] = await connection.execute(
      "SELECT * FROM shipments WHERE order_id = ? LIMIT 1 FOR UPDATE",
      [orderId],
    );

    if (shipments.length === 0) {
      const initialShipment = {
        carrier: this.hasOwn(normalizedData, "carrier")
          ? normalizedData.carrier
          : null,
        tracking_code: this.hasOwn(normalizedData, "tracking_code")
          ? normalizedData.tracking_code
          : null,
        tracking_url: this.hasOwn(normalizedData, "tracking_url")
          ? normalizedData.tracking_url
          : null,
        current_status:
          this.hasOwn(normalizedData, "current_status") &&
          normalizedData.current_status
            ? normalizedData.current_status
            : "pending",
        current_location_text: this.hasOwn(
          normalizedData,
          "current_location_text",
        )
          ? normalizedData.current_location_text
          : null,
        current_lat: this.hasOwn(normalizedData, "current_lat")
          ? normalizedData.current_lat
          : null,
        current_lng: this.hasOwn(normalizedData, "current_lng")
          ? normalizedData.current_lng
          : null,
        estimated_delivery_at: this.hasOwn(
          normalizedData,
          "estimated_delivery_at",
        )
          ? normalizedData.estimated_delivery_at
          : null,
        last_event_at: this.hasOwn(normalizedData, "last_event_at")
          ? normalizedData.last_event_at
          : null,
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
          initialShipment.last_event_at,
        ],
      );

      const [createdRows] = await connection.execute(
        "SELECT * FROM shipments WHERE id = ? LIMIT 1",
        [result.insertId],
      );

      return createdRows[0] || null;
    }

    const shipment = shipments[0];
    const updates = [];
    const params = [];

    [
      "carrier",
      "tracking_code",
      "tracking_url",
      "current_status",
      "current_location_text",
      "current_lat",
      "current_lng",
      "estimated_delivery_at",
      "last_event_at",
    ].forEach((field) => {
      if (this.hasOwn(normalizedData, field)) {
        updates.push(`${field} = ?`);
        params.push(normalizedData[field]);
      }
    });

    if (updates.length > 0) {
      params.push(shipment.id);
      await connection.execute(
        `UPDATE shipments SET ${updates.join(", ")} WHERE id = ?`,
        params,
      );
    }

    const [updatedRows] = await connection.execute(
      "SELECT * FROM shipments WHERE id = ? LIMIT 1",
      [shipment.id],
    );

    return updatedRows[0] || shipment;
  }

  // Tạo tracking event.
  static async createTrackingEvent(connection, orderId, eventData = {}) {
    const normalizedStatus = this.assertValidStatus(
      eventData.status || "pending",
    );
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
        this.hasOwn(eventData, "location_text")
          ? eventData.location_text
          : null,
        this.hasOwn(eventData, "lat") ? eventData.lat : null,
        this.hasOwn(eventData, "lng") ? eventData.lng : null,
        eventTime,
        this.normalizeTrackingSource(eventData.source),
        eventData.created_by || null,
      ],
    );
  }

  // Thao tác với initialize tracking.
  static async initializeTracking(connection, orderId, status = "pending") {
    const normalizedStatus = this.assertValidStatus(status);
    const shipment = await this.upsertShipment(connection, orderId, {
      current_status: normalizedStatus,
      last_event_at: new Date(),
    });

    await this.createTrackingEvent(connection, orderId, {
      shipment_id: shipment?.id || null,
      status: normalizedStatus,
      source: "system",
    });
  }

  // Thao tác với auto complete delivered đơn hàng.
  // Tự hủy đơn thanh toán online quá hạn và hoàn lại tồn kho/voucher.
  static async expireOverduePendingPayments() {
    let orders = [];
    try {
      [orders] = await pool.execute(
        `SELECT id
         FROM orders
         WHERE status = 'pending_payment'
           AND payment_method IN ('vnpay', 'momo')
           AND payment_status <> 'paid'
           AND payment_expires_at IS NOT NULL
           AND payment_expires_at <= NOW()
         ORDER BY payment_expires_at ASC
         LIMIT 100`,
      );
    } catch (error) {
      if (["ER_BAD_FIELD_ERROR", "ER_NO_SUCH_TABLE"].includes(error?.code)) {
        return;
      }
      throw error;
    }

    for (const row of orders) {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();

        const [lockedOrders] = await connection.execute(
          `SELECT id, status, payment_status, voucher_id
           FROM orders
           WHERE id = ?
             AND status = 'pending_payment'
             AND payment_method IN ('vnpay', 'momo')
             AND payment_status <> 'paid'
             AND payment_expires_at <= NOW()
           LIMIT 1
           FOR UPDATE`,
          [row.id],
        );
        const order = lockedOrders[0];

        if (!order) {
          await connection.rollback();
          continue;
        }

        const [items] = await connection.execute(
          "SELECT product_id, variant_id, quantity FROM order_items WHERE order_id = ?",
          [order.id],
        );

        await connection.execute("UPDATE orders SET status = ? WHERE id = ?", [
          "cancelled",
          order.id,
        ]);

        for (const item of items) {
          const quantity = Math.max(0, Number.parseInt(item.quantity, 10) || 0);
          if (quantity <= 0) {
            continue;
          }

          await connection.execute(
            "UPDATE products SET stock_quantity = stock_quantity + ?, sold_count = GREATEST(sold_count - ?, 0) WHERE id = ?",
            [quantity, quantity, item.product_id],
          );

          if (item.variant_id) {
            await connection.execute(
              "UPDATE product_variants SET stock_quantity = stock_quantity + ? WHERE id = ?",
              [quantity, item.variant_id],
            );
          }
        }

        if (order.voucher_id) {
          await connection.execute(
            "UPDATE vouchers SET used_count = GREATEST(used_count - 1, 0) WHERE id = ?",
            [order.voucher_id],
          );
          await connection.execute(
            "DELETE FROM voucher_usage WHERE order_id = ?",
            [order.id],
          );
        }

        const shipment = await this.upsertShipment(connection, order.id, {
          current_status: "cancelled",
          last_event_at: new Date(),
        });

        await this.createTrackingEvent(connection, order.id, {
          shipment_id: shipment?.id || null,
          status: "cancelled",
          source: "system",
          title: "Đơn hàng tự động hủy do quá hạn thanh toán",
          description:
            "Đơn hàng thanh toán online đã quá 24 giờ nhưng chưa ghi nhận thanh toán.",
        });

        await connection.commit();
      } catch (error) {
        await connection.rollback();
        console.error("Expire pending payment order error:", error);
      } finally {
        connection.release();
      }
    }
  }

  static async autoCompleteDeliveredOrders() {
    let orders = [];
    try {
      await this.expireOverduePendingPayments();
      await pool.execute(
        `UPDATE orders
                 SET payment_status = 'paid'
                 WHERE status IN ('delivered', 'completed')
                   AND (payment_status IS NULL OR payment_status <> 'paid')`,
      );
      // thay đổi interval thành 14 DAY nếu muốn tự động hoàn thành sau 14 ngày kể từ khi giao hàng thành công.
      [orders] = await pool.execute(
        `SELECT o.id
                 FROM orders o
                 WHERE o.status = 'delivered'
                   AND o.updated_at <= DATE_SUB(NOW(), INTERVAL 7 DAY)
                   AND NOT EXISTS (
                       SELECT 1
                       FROM order_return_requests rr
                       WHERE rr.order_id = o.id
                         AND rr.status IN ('pending', 'approved')
                   )
                 LIMIT 100`,
      );
    } catch (error) {
      if (error?.code === "ER_NO_SUCH_TABLE") {
        return;
      }
      throw error;
    }
    // thay đổi interval thành 14 DAY nếu muốn tự động hoàn thành sau 14 ngày kể từ khi giao hàng thành công.
    for (const row of orders) {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const [lockedOrders] = await connection.execute(
          `SELECT id, status
                     FROM orders
                     WHERE id = ?
                       AND status = 'delivered'
                       AND updated_at <= DATE_SUB(NOW(), INTERVAL 7 DAY)
                     LIMIT 1
                     FOR UPDATE`,
          [row.id],
        );

        if (lockedOrders.length === 0) {
          await connection.rollback();
          continue;
        }

        await connection.execute(
          "UPDATE orders SET status = ?, payment_status = ? WHERE id = ?",
          ["completed", "paid", row.id],
        );

        const shipment = await this.upsertShipment(connection, row.id, {
          current_status: "completed",
          last_event_at: new Date(),
        });

        await this.createTrackingEvent(connection, row.id, {
          shipment_id: shipment?.id || null,
          status: "completed",
          source: "system",
          title: "Đơn hàng tự động hoàn thành",
          description:
            "Đơn hàng đã giao quá 7 ngày và không có yêu cầu hoàn hàng nên hệ thống tự động xác nhận hoàn thành.",
        });

        await connection.commit();
      } catch (error) {
        await connection.rollback();
        console.error("Auto complete delivered order error:", error);
      } finally {
        connection.release();
      }
    }
  }

  // Thao tác với attach tracking dữ liệu.
  static async attachTrackingData(order) {
    const [shipments] = await pool.execute(
      "SELECT * FROM shipments WHERE order_id = ? LIMIT 1",
      [order.id],
    );
    order.shipment = shipments[0] || null;

    const [events] = await pool.execute(
      `SELECT ote.*, u.full_name AS created_by_name
             FROM order_tracking_events ote
             LEFT JOIN users u ON ote.created_by = u.id
             WHERE ote.order_id = ?
             ORDER BY ote.event_time DESC, ote.id DESC`,
      [order.id],
    );
    order.tracking_events = events;

    return order;
  }

  // Tạo bản ghi mới.
  static async create(
    userId,
    addressId,
    paymentMethod,
    notes = null,
    shippingFeeFromUI = null,
    discountAmount = 0,
    voucherCode = null,
    voucherId = null,
    selectedCartItemIds = null,
  ) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();
      const addressSnapshot = await this.assertAddressOwnership(
        connection,
        userId,
        addressId,
      );

      const Cart = require("./Cart");
      const [carts] = await connection.execute(
        "SELECT id FROM cart WHERE user_id = ?",
        [userId],
      );

      if (carts.length === 0) {
        throw new Error("Cart not found");
      }

      const cartId = carts[0].id;
      const cartData = this.scopeCartData(
        await Cart.calculateTotal(cartId),
        selectedCartItemIds,
      );

      if (cartData.items.length === 0) {
        throw new Error("Cart is empty");
      }

      const orderCode = this.generateOrderCode();
      const shippingFee = await this.resolveShippingFee(cartData.subtotal);
      const finalAmount = Math.max(
        0,
        cartData.subtotal + shippingFee - discountAmount,
      );
      const initialStatus = this.getInitialStatusForPayment(
        paymentMethod,
        finalAmount,
      );
      const paymentExpiresAt = await this.getPaymentExpiresAt(
        paymentMethod,
        finalAmount,
      );

      const [orderResult] = await connection.execute(
        `INSERT INTO orders (
                    user_id, address_id, shipping_name, shipping_phone, shipping_address_line,
                    shipping_ward, shipping_district, shipping_city, voucher_id, order_code,
                    total_amount, discount_amount, shipping_fee, final_amount, payment_method, status, payment_expires_at, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
          initialStatus,
          paymentExpiresAt,
          notes,
        ],
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
            item.subtotal,
          ],
        );

        await connection.execute(
          "UPDATE products SET stock_quantity = stock_quantity - ?, sold_count = sold_count + ? WHERE id = ?",
          [item.quantity, item.quantity, item.product_id],
        );

        if (item.variant_id) {
          await connection.execute(
            "UPDATE product_variants SET stock_quantity = stock_quantity - ? WHERE id = ?",
            [item.quantity, item.variant_id],
          );
        }
      }

      if (voucherId && discountAmount > 0) {
        await connection.execute(
          "INSERT INTO voucher_usage (voucher_id, user_id, order_id, discount_amount) VALUES (?, ?, ?, ?)",
          [voucherId, userId, orderId, discountAmount],
        );

        await connection.execute(
          "UPDATE vouchers SET used_count = used_count + 1 WHERE id = ?",
          [voucherId],
        );
      }

      const itemIdsToDelete = cartData.items
        .map((item) => Number.parseInt(item.id, 10))
        .filter((id) => Number.isInteger(id) && id > 0);

      if (itemIdsToDelete.length > 0) {
        const placeholders = itemIdsToDelete.map(() => "?").join(", ");
        await connection.execute(
          `DELETE FROM cart_items WHERE cart_id = ? AND id IN (${placeholders})`,
          [cartId, ...itemIdsToDelete],
        );
      }

      await this.initializeTracking(connection, orderId, initialStatus);
      await connection.commit();

      return {
        id: orderId,
        order_code: orderCode,
        final_amount: finalAmount,
        status: initialStatus,
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // Tạo from sản phẩm.
  static async createFromProduct(
    userId,
    addressId,
    product,
    quantity,
    paymentMethod,
    notes = null,
    variantId = null,
    discountAmount = 0,
    voucherId = null,
  ) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();
      const addressSnapshot = await this.assertAddressOwnership(
        connection,
        userId,
        addressId,
      );

      const quantityNumber = Number.parseInt(quantity, 10);
      if (!Number.isInteger(quantityNumber) || quantityNumber <= 0) {
        throw new Error("Quantity is invalid");
      }

      await this.assertProductStock(connection, product.id, quantityNumber);
      if (variantId !== null && variantId !== undefined) {
        await this.assertVariantStock(
          connection,
          product.id,
          variantId,
          quantityNumber,
        );
      }

      const orderCode = this.generateOrderCode();
      const price = product.final_price || product.price;
      const subtotal = price * quantityNumber;
      const shippingFee = await this.resolveShippingFee(subtotal);
      const finalAmount = Math.max(0, subtotal + shippingFee - discountAmount);
      const initialStatus = this.getInitialStatusForPayment(
        paymentMethod,
        finalAmount,
      );
      const paymentExpiresAt = await this.getPaymentExpiresAt(
        paymentMethod,
        finalAmount,
      );

      const [orderResult] = await connection.execute(
        `INSERT INTO orders (
                    user_id, address_id, shipping_name, shipping_phone, shipping_address_line,
                    shipping_ward, shipping_district, shipping_city, voucher_id, order_code,
                    total_amount, discount_amount, shipping_fee, final_amount, payment_method, status, payment_expires_at, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
          initialStatus,
          paymentExpiresAt,
          notes,
        ],
      );

      const orderId = orderResult.insertId;
      const productImage =
        product.images && product.images.length > 0
          ? product.images[0].image_url
          : null;
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
          subtotal,
        ],
      );

      await connection.execute(
        "UPDATE products SET stock_quantity = stock_quantity - ?, sold_count = sold_count + ? WHERE id = ?",
        [quantityNumber, quantityNumber, product.id],
      );

      if (variantId) {
        await connection.execute(
          "UPDATE product_variants SET stock_quantity = stock_quantity - ? WHERE id = ?",
          [quantityNumber, variantId],
        );
      }

      if (voucherId && discountAmount > 0) {
        await connection.execute(
          "INSERT INTO voucher_usage (voucher_id, user_id, order_id, discount_amount) VALUES (?, ?, ?, ?)",
          [voucherId, userId, orderId, discountAmount],
        );

        await connection.execute(
          "UPDATE vouchers SET used_count = used_count + 1 WHERE id = ?",
          [voucherId],
        );
      }

      await this.initializeTracking(connection, orderId, initialStatus);
      await connection.commit();

      return {
        id: orderId,
        order_code: orderCode,
        final_amount: finalAmount,
        status: initialStatus,
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // Tìm theo ID.
  static async findById(orderId) {
    await this.autoCompleteDeliveredOrders();
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
      [orderId],
    );
    const order = orders[0];

    if (!order) {
      return null;
    }

    const [items] = await pool.execute(
      `SELECT oi.*, p.slug AS product_slug, pv.size AS variant_size, pv.color AS variant_color
             FROM order_items oi
             LEFT JOIN products p ON oi.product_id = p.id
             LEFT JOIN product_variants pv ON oi.variant_id = pv.id
             WHERE oi.order_id = ?`,
      [orderId],
    );
    order.items = items;

    const [payments] = await pool.execute(
      "SELECT * FROM payments WHERE order_id = ? ORDER BY created_at DESC LIMIT 1",
      [orderId],
    );
    order.payment = payments[0] || null;

    await this.attachTrackingData(order);
    return order;
  }

  // Tìm theo đơn hàng mã.
  static async findByOrderCode(orderCode) {
    const [orders] = await pool.execute(
      "SELECT id FROM orders WHERE order_code = ?",
      [orderCode],
    );
    if (orders.length > 0) {
      return this.findById(orders[0].id);
    }
    return null;
  }

  // Tìm theo người dùng.
  static async findByUser(userId, limit = 20, offset = 0) {
    await this.autoCompleteDeliveredOrders();
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
      [userId, String(limit), String(offset)],
    );

    for (const order of orders) {
      const [items] = await pool.execute(
        `SELECT oi.*, p.name AS product_name, p.slug AS product_slug,
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
        [order.id],
      );
      order.items = items;
    }

    return orders;
  }

  // Cập nhật trạng thái.
  static async updateStatus(orderId, status, trackingData = {}, options = {}) {
    const normalizedStatus = this.assertValidStatus(status);
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [orders] = await connection.execute(
        "SELECT id, status FROM orders WHERE id = ? LIMIT 1 FOR UPDATE",
        [orderId],
      );
      const order = orders[0];

      if (!order) {
        throw new Error("Order not found");
      }

      const previousStatus = this.normalizeStatus(order.status);
      const statusChanged = previousStatus !== normalizedStatus;

      const shouldMarkPaid = ["delivered", "completed"].includes(
        normalizedStatus,
      );

      if (statusChanged || shouldMarkPaid) {
        const updates = ["status = ?"];
        const updateParams = [normalizedStatus];

        if (shouldMarkPaid) {
          updates.push("payment_status = ?");
          updateParams.push("paid");
        }

        updateParams.push(orderId);
        await connection.execute(
          `UPDATE orders SET ${updates.join(", ")} WHERE id = ?`,
          updateParams,
        );
      }

      const trackingFields = [
        "carrier",
        "tracking_code",
        "tracking_url",
        "current_location_text",
        "current_lat",
        "current_lng",
        "estimated_delivery_at",
      ];
      const hasTrackingPatch = trackingFields.some((field) =>
        this.hasOwn(trackingData, field),
      );
      const hasExplicitEventText =
        this.hasOwn(trackingData, "title") ||
        this.hasOwn(trackingData, "description");
      const eventTime = trackingData.event_time || new Date();

      const shipmentPatch = {
        current_status: normalizedStatus,
        ...(hasTrackingPatch ? trackingData : {}),
      };

      if (statusChanged || hasTrackingPatch || hasExplicitEventText) {
        shipmentPatch.last_event_at = eventTime;
      }

      const shipment = await this.upsertShipment(
        connection,
        orderId,
        shipmentPatch,
      );

      if (
        statusChanged ||
        hasTrackingPatch ||
        hasExplicitEventText ||
        this.hasOwn(trackingData, "event_time")
      ) {
        const statusPreset = this.getStatusEventPreset(normalizedStatus);
        const defaultTrackingDescription =
          "Thông tin vận chuyển của đơn hàng đã được cập nhật.";

        await this.createTrackingEvent(connection, orderId, {
          shipment_id: shipment?.id || null,
          status: normalizedStatus,
          title:
            trackingData.title ||
            (statusChanged
              ? statusPreset.title
              : "Cập nhật thông tin vận chuyển"),
          description:
            trackingData.description ||
            (statusChanged
              ? statusPreset.description
              : defaultTrackingDescription),
          location_text: this.hasOwn(trackingData, "current_location_text")
            ? trackingData.current_location_text
            : (shipment?.current_location_text ?? null),
          lat: this.hasOwn(trackingData, "current_lat")
            ? trackingData.current_lat
            : (shipment?.current_lat ?? null),
          lng: this.hasOwn(trackingData, "current_lng")
            ? trackingData.current_lng
            : (shipment?.current_lng ?? null),
          event_time: eventTime,
          source: trackingData.source || "admin",
          created_by: options.actorUserId || null,
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

  // Thao tác với cancel theo người dùng.
  static async cancelByUser(orderId, userId) {
    const normalizedOrderId = Number.parseInt(orderId, 10);
    const normalizedUserId = Number.parseInt(userId, 10);

    if (
      !Number.isInteger(normalizedOrderId) ||
      normalizedOrderId <= 0 ||
      !Number.isInteger(normalizedUserId) ||
      normalizedUserId <= 0
    ) {
      throw new Error("Order is invalid");
    }

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [orders] = await connection.execute(
        "SELECT id, user_id, status, voucher_id FROM orders WHERE id = ? LIMIT 1 FOR UPDATE",
        [normalizedOrderId],
      );
      const order = orders[0];

      if (!order) {
        throw new Error("Order not found");
      }

      if (Number(order.user_id) !== normalizedUserId) {
        throw new Error("Access denied");
      }

      const currentStatus = this.normalizeStatus(order.status);
      if (!["pending", "confirmed"].includes(currentStatus)) {
        throw new Error("Order cannot be cancelled at this status");
      }

      const [items] = await connection.execute(
        "SELECT product_id, variant_id, quantity FROM order_items WHERE order_id = ?",
        [normalizedOrderId],
      );

      await connection.execute("UPDATE orders SET status = ? WHERE id = ?", [
        "cancelled",
        normalizedOrderId,
      ]);

      for (const item of items) {
        const quantity = Math.max(0, Number.parseInt(item.quantity, 10) || 0);
        if (quantity <= 0) {
          continue;
        }

        await connection.execute(
          "UPDATE products SET stock_quantity = stock_quantity + ?, sold_count = GREATEST(sold_count - ?, 0) WHERE id = ?",
          [quantity, quantity, item.product_id],
        );

        if (item.variant_id) {
          await connection.execute(
            "UPDATE product_variants SET stock_quantity = stock_quantity + ? WHERE id = ?",
            [quantity, item.variant_id],
          );
        }
      }

      if (order.voucher_id) {
        await connection.execute(
          "UPDATE vouchers SET used_count = GREATEST(used_count - 1, 0) WHERE id = ?",
          [order.voucher_id],
        );
        await connection.execute(
          "DELETE FROM voucher_usage WHERE order_id = ?",
          [normalizedOrderId],
        );
      }

      const shipment = await this.upsertShipment(
        connection,
        normalizedOrderId,
        {
          current_status: "cancelled",
          last_event_at: new Date(),
        },
      );

      await this.createTrackingEvent(connection, normalizedOrderId, {
        shipment_id: shipment?.id || null,
        status: "cancelled",
        source: "user",
        title: "Người mua đã hủy đơn hàng",
        description:
          "Đơn hàng được hủy bởi người mua trước khi chuyển sang giao hàng.",
        created_by: normalizedUserId,
      });

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    return this.findById(normalizedOrderId);
  }

  // Cập nhật thanh toán trạng thái.
  static async updatePaymentStatus(orderId, paymentStatus) {
    const shouldClearExpiry = String(paymentStatus || "").toLowerCase() === "paid";
    const query = shouldClearExpiry
      ? "UPDATE orders SET payment_status = ?, payment_expires_at = NULL WHERE id = ? AND payment_status <> ?"
      : "UPDATE orders SET payment_status = ? WHERE id = ? AND payment_status <> ?";
    const [result] = await pool.execute(
      query,
      [paymentStatus, orderId, paymentStatus],
    );

    return result;
  }

  // Tìm tất cả.
  static async findAll(filters = {}) {
    await this.autoCompleteDeliveredOrders();
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

    if (filters.status_group) {
      const group = String(filters.status_group).trim().toLowerCase();

      if (group === "awaiting_confirmation") {
        query += " AND o.status IN ('pending_payment', 'pending')";
      } else if (group === "awaiting_pickup") {
        query += " AND o.status IN ('confirmed', 'processing')";
      } else if (group === "awaiting_delivery") {
        query += " AND o.status = 'shipping'";
      } else if (group === "delivered") {
        query += " AND o.status = 'delivered'";
      } else if (group === "completed") {
        query += " AND o.status = 'completed'";
      } else if (group === "returns") {
        query += ` AND EXISTS (
          SELECT 1
          FROM order_return_requests rr
          WHERE rr.order_id = o.id
        )`;
      } else if (group === "cancelled") {
        query += " AND o.status = 'cancelled'";
      }
    }

    if (filters.status) {
      query += " AND o.status = ?";
      params.push(this.assertValidStatus(filters.status));
    }

    if (filters.payment_status) {
      query += " AND o.payment_status = ?";
      params.push(filters.payment_status);
    }

    if (filters.search) {
      query +=
        " AND (o.order_code LIKE ? OR u.full_name LIKE ? OR u.email LIKE ? OR COALESCE(o.shipping_name, '') LIKE ? OR COALESCE(o.shipping_phone, '') LIKE ?)";
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }

    query += " ORDER BY o.created_at DESC";

    if (filters.limit) {
      const limit = parseInt(filters.limit, 10) || 50;
      const offset = parseInt(filters.offset, 10) || 0;
      query += ` LIMIT ${limit} OFFSET ${offset}`;
    }

    const [orders] = await pool.query(query, params);
    for (const order of orders) {
      const [items] = await pool.execute(
        `SELECT oi.product_id, oi.product_name, p.slug AS product_slug
         FROM order_items oi
         LEFT JOIN products p ON p.id = oi.product_id
         WHERE oi.order_id = ?
         ORDER BY oi.id ASC
         LIMIT 3`,
        [order.id],
      );
      order.items = items;
    }

    return orders;
  }

  // Đếm nhanh các nhóm quản lý đơn hàng.
  static async getManagementCounts() {
    await this.autoCompleteDeliveredOrders();
    const [rows] = await pool.execute(`
      SELECT
        COUNT(*) AS all_count,
        SUM(CASE WHEN status IN ('pending_payment', 'pending') THEN 1 ELSE 0 END) AS awaiting_confirmation,
        SUM(CASE WHEN status IN ('confirmed', 'processing') THEN 1 ELSE 0 END) AS awaiting_pickup,
        SUM(CASE WHEN status = 'shipping' THEN 1 ELSE 0 END) AS awaiting_delivery,
        SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) AS delivered,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled
      FROM orders
    `);

    let returnsCount = 0;
    try {
      const [returnRows] = await pool.execute(
        "SELECT COUNT(DISTINCT order_id) AS total FROM order_return_requests",
      );
      returnsCount = Number(returnRows[0]?.total || 0);
    } catch (error) {
      if (error?.code !== "ER_NO_SUCH_TABLE") {
        throw error;
      }
    }

    return {
      all: Number(rows[0]?.all_count || 0),
      awaiting_confirmation: Number(rows[0]?.awaiting_confirmation || 0),
      awaiting_pickup: Number(rows[0]?.awaiting_pickup || 0),
      awaiting_delivery: Number(rows[0]?.awaiting_delivery || 0),
      delivered: Number(rows[0]?.delivered || 0),
      completed: Number(rows[0]?.completed || 0),
      returns: returnsCount,
      cancelled: Number(rows[0]?.cancelled || 0),
    };
  }

  // Lấy danh sách đánh giá để hiển thị trong khu quản lý đơn hàng.
  static async findReviews(filters = {}) {
    let query = `
      SELECT r.*,
             u.full_name AS user_name,
             u.email AS user_email,
             p.name AS product_name,
             p.slug AS product_slug,
             o.order_code
      FROM reviews r
      JOIN users u ON u.id = r.user_id
      JOIN products p ON p.id = r.product_id
      JOIN orders o ON o.id = r.order_id
      WHERE 1 = 1
    `;
    const params = [];

    if (filters.user_id) {
      query += " AND r.user_id = ?";
      params.push(filters.user_id);
    }

    if (filters.search) {
      query += " AND (p.name LIKE ? OR u.full_name LIKE ? OR u.email LIKE ? OR o.order_code LIKE ? OR COALESCE(r.comment, '') LIKE ?)";
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }

    query += " ORDER BY r.created_at DESC, r.id DESC";

    if (filters.limit) {
      const limit = parseInt(filters.limit, 10) || 50;
      const offset = parseInt(filters.offset, 10) || 0;
      query += ` LIMIT ${limit} OFFSET ${offset}`;
    }

    try {
      const [reviews] = await pool.query(query, params);
      return reviews;
    } catch (error) {
      if (error?.code === "ER_NO_SUCH_TABLE") {
        return [];
      }
      throw error;
    }
  }

  // Lấy statistics.
  static async getStatistics() {
    await this.autoCompleteDeliveredOrders();
    const [stats] = await pool.execute(`
            SELECT
                COUNT(*) AS total_orders,
                SUM(CASE WHEN status = 'pending_payment' THEN 1 ELSE 0 END) AS pending_payment_orders,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending_orders,
                SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) AS delivered_orders,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed_orders,
                SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_orders,
                SUM(CASE WHEN status = 'completed' THEN final_amount ELSE 0 END) AS total_revenue,
                SUM(CASE WHEN status = 'completed' AND DATE(created_at) = CURDATE() THEN final_amount ELSE 0 END) AS today_revenue,
                SUM(CASE WHEN status = 'completed' AND YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE()) THEN final_amount ELSE 0 END) AS month_revenue
            FROM orders
        `);

    return stats[0];
  }
}

module.exports = Order;
