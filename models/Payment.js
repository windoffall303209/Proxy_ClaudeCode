// Model truy vấn và chuẩn hóa dữ liệu thanh toán trong MySQL.
const pool = require('../config/database');

class Payment {
    // Tìm latest theo đơn hàng.
    static async findLatestByOrder(orderId, paymentMethod = null) {
        let query = 'SELECT * FROM payments WHERE order_id = ?';
        const params = [orderId];

        if (paymentMethod) {
            query += ' AND payment_method = ?';
            params.push(paymentMethod);
        }

        query += ' ORDER BY created_at DESC, id DESC LIMIT 1';

        const [payments] = await pool.execute(query, params);
        return payments[0] || null;
    }

    // Tìm theo transaction ID.
    static async findByTransactionId(transactionId) {
        if (!transactionId) {
            return null;
        }

        const [payments] = await pool.execute(
            'SELECT * FROM payments WHERE transaction_id = ? LIMIT 1',
            [transactionId]
        );

        return payments[0] || null;
    }

    // Tạo pending.
    static async createPending(orderId, paymentMethod, amount, paymentData = null) {
        const existingPayment = await this.findLatestByOrder(orderId, paymentMethod);

        if (existingPayment && existingPayment.status === 'pending' && !existingPayment.transaction_id) {
            return existingPayment;
        }

        const serializedPaymentData = paymentData ? JSON.stringify(paymentData) : null;

        const [result] = await pool.execute(
            `INSERT INTO payments (order_id, payment_method, amount, status, payment_data)
             VALUES (?, ?, ?, 'pending', ?)`,
            [orderId, paymentMethod, amount, serializedPaymentData]
        );

        return {
            id: result.insertId,
            order_id: orderId,
            payment_method: paymentMethod,
            amount,
            status: 'pending',
            payment_data: serializedPaymentData
        };
    }

    // Thao tác với record gateway result.
    static async recordGatewayResult({ orderId, paymentMethod, transactionId = null, amount, status, paymentData = null }) {
        const existingPayment =
            (transactionId ? await this.findByTransactionId(transactionId) : null) ||
            await this.findLatestByOrder(orderId, paymentMethod);
        const serializedPaymentData = paymentData ? JSON.stringify(paymentData) : null;
        const processedAt = status === 'pending' ? null : new Date();

        if (existingPayment) {
            await pool.execute(
                `UPDATE payments
                 SET transaction_id = COALESCE(?, transaction_id),
                     amount = ?,
                     status = ?,
                     payment_data = ?,
                     processed_at = ?
                 WHERE id = ?`,
                [
                    transactionId,
                    amount,
                    status,
                    serializedPaymentData,
                    processedAt,
                    existingPayment.id
                ]
            );

            return {
                ...existingPayment,
                transaction_id: transactionId || existingPayment.transaction_id,
                amount,
                status,
                payment_data: serializedPaymentData,
                processed_at: processedAt
            };
        }

        const [result] = await pool.execute(
            `INSERT INTO payments (order_id, payment_method, transaction_id, amount, status, payment_data, processed_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [orderId, paymentMethod, transactionId, amount, status, serializedPaymentData, processedAt]
        );

        return {
            id: result.insertId,
            order_id: orderId,
            payment_method: paymentMethod,
            transaction_id: transactionId,
            amount,
            status,
            payment_data: serializedPaymentData,
            processed_at: processedAt
        };
    }
}

module.exports = Payment;
