const crypto = require('crypto');
const axios = require('axios');
const QRCode = require('qrcode');
require('dotenv').config();

class PaymentService {
    // Process COD payment
    async processCOD(orderData) {
        const Payment = require('../models/Payment');
        
        // COD doesn't need immediate processing
        // Just create a pending payment record
        return {
            method: 'cod',
            status: 'pending',
            message: 'Đơn hàng sẽ được thanh toán khi nhận hàng'
        };
    }

    // Create VNPay payment
    async createVNPayPayment(order) {
        const vnp_TmnCode = process.env.VNPAY_TMN_CODE;
        const vnp_HashSecret = process.env.VNPAY_HASH_SECRET;
        const vnp_Url = process.env.VNPAY_URL;
        const vnp_ReturnUrl = process.env.VNPAY_RETURN_URL;

        const date = new Date();
        const createDate = this.formatDateTime(date);
        const orderId = order.order_code;
        const amount = order.final_amount;

        let vnp_Params = {};
        vnp_Params['vnp_Version'] = '2.1.0';
        vnp_Params['vnp_Command'] = 'pay';
        vnp_Params['vnp_TmnCode'] = vnp_TmnCode;
        vnp_Params['vnp_Locale'] = 'vn';
        vnp_Params['vnp_CurrCode'] = 'VND';
        vnp_Params['vnp_TxnRef'] = orderId;
        vnp_Params['vnp_OrderInfo'] = `Thanh toan don hang ${orderId}`;
        vnp_Params['vnp_OrderType'] = 'other';
        vnp_Params['vnp_Amount'] = amount * 100;
        vnp_Params['vnp_ReturnUrl'] = vnp_ReturnUrl;
        vnp_Params['vnp_IpAddr'] = '127.0.0.1';
        vnp_Params['vnp_CreateDate'] = createDate;

        vnp_Params = this.sortObject(vnp_Params);

        const signData = new URLSearchParams(vnp_Params).toString();
        const hmac = crypto.createHmac('sha512', vnp_HashSecret);
        const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');
        vnp_Params['vnp_SecureHash'] = signed;

        const paymentUrl = vnp_Url + '?' + new URLSearchParams(vnp_Params).toString();

        return {
            method: 'vnpay',
            paymentUrl,
            orderId
        };
    }

    // Verify VNPay callback
    async verifyVNPayPayment(vnpParams) {
        const vnp_SecureHash = vnpParams['vnp_SecureHash'];
        delete vnpParams['vnp_SecureHash'];
        delete vnpParams['vnp_SecureHashType'];

        vnpParams = this.sortObject(vnpParams);
        
        const vnp_HashSecret = process.env.VNPAY_HASH_SECRET;
        const signData = new URLSearchParams(vnpParams).toString();
        const hmac = crypto.createHmac('sha512', vnp_HashSecret);
        const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

        if (vnp_SecureHash === signed) {
            return {
                success: vnpParams['vnp_ResponseCode'] === '00',
                orderId: vnpParams['vnp_TxnRef'],
                transactionId: vnpParams['vnp_TransactionNo'],
                amount: vnpParams['vnp_Amount'] / 100
            };
        } else {
            return { success: false, message: 'Invalid signature' };
        }
    }

    // Create MoMo payment
    async createMoMoPayment(order) {
        const partnerCode = process.env.MOMO_PARTNER_CODE;
        const accessKey = process.env.MOMO_ACCESS_KEY;
        const secretKey = process.env.MOMO_SECRET_KEY;
        const endpoint = process.env.MOMO_ENDPOINT;
        const returnUrl = process.env.MOMO_RETURN_URL;
        const notifyUrl = process.env.MOMO_NOTIFY_URL;

        const orderId = order.order_code;
        const requestId = orderId;
        const amount = order.final_amount.toString();
        const orderInfo = `Thanh toán đơn hàng ${orderId}`;
        const requestType = 'captureWallet';
        const extraData = '';

        // Create signature
        const rawSignature = `accessKey=${accessKey}&amount=${amount}&extraData=${extraData}&ipnUrl=${notifyUrl}&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${partnerCode}&redirectUrl=${returnUrl}&requestId=${requestId}&requestType=${requestType}`;
        
        const signature = crypto
            .createHmac('sha256', secretKey)
            .update(rawSignature)
            .digest('hex');

        const requestBody = {
            partnerCode,
            accessKey,
            requestId,
            amount,
            orderId,
            orderInfo,
            redirectUrl: returnUrl,
            ipnUrl: notifyUrl,
            extraData,
            requestType,
            signature,
            lang: 'vi'
        };

        try {
            const response = await axios.post(endpoint, requestBody);

            if (response.data.resultCode === 0) {
                // Generate QR code for payment URL
                const qrCodeDataUrl = await QRCode.toDataURL(response.data.payUrl);

                return {
                    method: 'momo',
                    paymentUrl: response.data.payUrl,
                    qrCodeDataUrl,
                    orderId,
                    deeplink: response.data.deeplink
                };
            } else {
                throw new Error(response.data.message || 'MoMo payment creation failed');
            }
        } catch (error) {
            console.error('MoMo payment error:', error);
            throw new Error('Không thể tạo thanh toán MoMo');
        }
    }

    // Verify MoMo callback
    async verifyMoMoPayment(momoParams) {
        const {
            partnerCode,
            orderId,
            requestId,
            amount,
            orderInfo,
            orderType,
            transId,
            resultCode,
            message,
            payType,
            responseTime,
            extraData,
            signature
        } = momoParams;

        const secretKey = process.env.MOMO_SECRET_KEY;

        const rawSignature = `accessKey=${process.env.MOMO_ACCESS_KEY}&amount=${amount}&extraData=${extraData}&message=${message}&orderId=${orderId}&orderInfo=${orderInfo}&orderType=${orderType}&partnerCode=${partnerCode}&payType=${payType}&requestId=${requestId}&responseTime=${responseTime}&resultCode=${resultCode}&transId=${transId}`;

        const generatedSignature = crypto
            .createHmac('sha256', secretKey)
            .update(rawSignature)
            .digest('hex');

        if (signature === generatedSignature) {
            return {
                success: String(resultCode) === '0',
                orderId,
                transactionId: transId,
                amount: parseInt(amount)
            };
        } else {
            return { success: false, message: 'Invalid signature' };
        }
    }

    // Helper functions
    sortObject(obj) {
        const sorted = {};
        const keys = Object.keys(obj).sort();
        keys.forEach(key => {
            sorted[key] = obj[key];
        });
        return sorted;
    }

    formatDateTime(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        return `${year}${month}${day}${hours}${minutes}${seconds}`;
    }
}

module.exports = new PaymentService();
