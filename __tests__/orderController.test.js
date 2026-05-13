// Kiểm thử tự động cho tests ordercontroller.test để giữ ổn định hành vi quan trọng.
process.env.NODE_ENV = 'test';

jest.mock('../models/Order', () => ({
    create: jest.fn(),
    createFromProduct: jest.fn(),
    findById: jest.fn(),
    findByOrderCode: jest.fn(),
    updatePaymentStatus: jest.fn(),
    updateStatus: jest.fn(),
    calculateShippingFee: jest.fn((subtotal) => (Number(subtotal) >= 500000 ? 0 : 30000))
}));

jest.mock('../models/Address', () => ({
    findById: jest.fn(),
    findByUser: jest.fn()
}));

jest.mock('../models/Cart', () => ({
    getOrCreate: jest.fn(),
    calculateTotal: jest.fn()
}));

jest.mock('../models/Voucher', () => ({
    validate: jest.fn(),
    findAll: jest.fn(),
    getApplicableProductsMap: jest.fn()
}));

jest.mock('../models/Product', () => ({
    findById: jest.fn()
}));

jest.mock('../models/Payment', () => ({
    createPending: jest.fn(),
    recordGatewayResult: jest.fn()
}));

jest.mock('../services/paymentService', () => ({
    createVNPayPayment: jest.fn(),
    createMoMoPayment: jest.fn(),
    verifyVNPayPayment: jest.fn(),
    verifyMoMoPayment: jest.fn()
}));

jest.mock('../services/emailService', () => ({
    sendOrderConfirmation: jest.fn(() => Promise.resolve())
}));

const Order = require('../models/Order');
const Address = require('../models/Address');
const Cart = require('../models/Cart');
const Voucher = require('../models/Voucher');
const Product = require('../models/Product');
const Payment = require('../models/Payment');
const paymentService = require('../services/paymentService');
const orderController = require('../controllers/orderController');

// Tạo response giả lập cho test.
function createRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.render = jest.fn().mockReturnValue(res);
    res.redirect = jest.fn().mockReturnValue(res);
    return res;
}

describe('orderController', () => {
    let consoleErrorSpy;

    beforeEach(() => {
        jest.clearAllMocks();
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
    });

    it('rejects checkout when the address does not belong to the user', async () => {
        Address.findById.mockResolvedValue({ id: 4, user_id: 999 });

        const req = {
            user: { id: 1 },
            body: {
                address_id: 4,
                payment_method: 'cod'
            }
        };
        const res = createRes();

        await orderController.createOrder(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(Order.create).not.toHaveBeenCalled();
    });

    it('renders checkout with only the selected cart items from the query string', async () => {
        Cart.getOrCreate.mockResolvedValue({ id: 2 });
        Cart.calculateTotal.mockResolvedValue({
            subtotal: 590000,
            itemCount: 2,
            items: [
                { id: 11, product_id: 1, quantity: 1, subtotal: 100000 },
                { id: 22, product_id: 2, quantity: 1, subtotal: 490000 }
            ]
        });
        Address.findByUser.mockResolvedValue([{ id: 4, is_default: true }]);
        Voucher.findAll.mockResolvedValue([]);
        Voucher.getApplicableProductsMap.mockResolvedValue(new Map());

        const req = {
            user: { id: 1 },
            query: { items: '22' }
        };
        const res = createRes();

        await orderController.showCheckout(req, res);

        expect(res.render).toHaveBeenCalledWith('checkout/index', expect.objectContaining({
            cart: expect.objectContaining({
                subtotal: 490000,
                itemCount: 1,
                items: [expect.objectContaining({ id: 22 })]
            }),
            selectedCartItemIds: [22]
        }));
    });

    it('passes server-controlled pricing inputs to Order.create', async () => {
        Address.findById.mockResolvedValue({ id: 4, user_id: 1 });
        Cart.getOrCreate.mockResolvedValue({ id: 2 });
        Cart.calculateTotal.mockResolvedValue({
            subtotal: 100000,
            items: [{ product_id: 1, quantity: 1, subtotal: 100000 }]
        });
        Voucher.validate.mockResolvedValue({
            valid: true,
            discountAmount: 15000,
            voucher: { id: 7 }
        });
        Order.create.mockResolvedValue({ id: 11 });
        Order.findById.mockResolvedValue({ id: 11, order_code: 'ORD123' });

        const req = {
            user: { id: 1 },
            body: {
                address_id: 4,
                payment_method: 'cod',
                notes: 'leave at front desk',
                shipping_fee: 1,
                discount_amount: 999999,
                voucher_code: 'SAVE15'
            }
        };
        const res = createRes();

        await orderController.createOrder(req, res);

        expect(Order.create).toHaveBeenCalledWith(
            1,
            4,
            'cod',
            'leave at front desk',
            null,
            15000,
            'SAVE15',
            7,
            null
        );
        expect(res.redirect).toHaveBeenCalledWith('/orders/ORD123/confirmation');
    });

    it('creates a cart order using only the selected cart items', async () => {
        Address.findById.mockResolvedValue({ id: 4, user_id: 1 });
        Cart.getOrCreate.mockResolvedValue({ id: 2 });
        Cart.calculateTotal.mockResolvedValue({
            subtotal: 590000,
            itemCount: 2,
            items: [
                { id: 11, product_id: 1, quantity: 1, subtotal: 100000 },
                { id: 22, product_id: 2, quantity: 1, subtotal: 490000 }
            ]
        });
        Voucher.validate.mockResolvedValue({
            valid: true,
            discountAmount: 10000,
            voucher: { id: 7 }
        });
        Order.create.mockResolvedValue({ id: 11 });
        Order.findById.mockResolvedValue({ id: 11, order_code: 'ORD123' });

        const req = {
            user: { id: 1 },
            body: {
                address_id: 4,
                payment_method: 'cod',
                voucher_code: 'SAVE10',
                selected_cart_item_ids: '11'
            }
        };
        const res = createRes();

        await orderController.createOrder(req, res);

        expect(Voucher.validate).toHaveBeenCalledWith(
            'SAVE10',
            1,
            130000,
            [expect.objectContaining({ id: 11 })]
        );
        expect(Order.create).toHaveBeenCalledWith(
            1,
            4,
            'cod',
            undefined,
            null,
            10000,
            'SAVE10',
            7,
            [11]
        );
    });

    it('validates vouchers against only selected cart items during checkout', async () => {
        Cart.getOrCreate.mockResolvedValue({ id: 2 });
        Cart.calculateTotal.mockResolvedValue({
            subtotal: 590000,
            itemCount: 2,
            items: [
                { id: 11, product_id: 1, quantity: 1, subtotal: 100000 },
                { id: 22, product_id: 2, quantity: 1, subtotal: 490000 }
            ]
        });
        Voucher.validate.mockResolvedValue({
            valid: true,
            discountAmount: 10000,
            voucher: { code: 'SAVE10', name: 'Save 10k', type: 'fixed', value: 10000 }
        });

        const req = {
            user: { id: 1 },
            body: {
                code: 'SAVE10',
                order_amount: 590000,
                mode: 'cart',
                selected_cart_item_ids: '11'
            }
        };
        const res = createRes();

        await orderController.validateVoucher(req, res);

        expect(Voucher.validate).toHaveBeenCalledWith(
            'SAVE10',
            1,
            130000,
            [expect.objectContaining({ id: 11 })]
        );
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: true,
            discount_amount: 10000
        }));
    });

    it('clamps cart voucher discounts so the payable total never becomes negative', async () => {
        Address.findById.mockResolvedValue({ id: 4, user_id: 1 });
        Cart.getOrCreate.mockResolvedValue({ id: 2 });
        Cart.calculateTotal.mockResolvedValue({
            subtotal: 10000,
            items: [{ id: 11, product_id: 1, quantity: 1, subtotal: 10000 }]
        });
        Voucher.validate.mockResolvedValue({
            valid: true,
            discountAmount: 999999,
            voucher: { id: 9 }
        });
        Order.create.mockResolvedValue({ id: 21 });
        Order.findById.mockResolvedValue({ id: 21, order_code: 'ORD999' });

        const req = {
            user: { id: 1 },
            body: {
                address_id: 4,
                payment_method: 'cod',
                voucher_code: 'BIGSALE',
                selected_cart_item_ids: '11'
            }
        };
        const res = createRes();

        await orderController.createOrder(req, res);

        expect(Order.create).toHaveBeenCalledWith(
            1,
            4,
            'cod',
            undefined,
            null,
            40000,
            'BIGSALE',
            9,
            [11]
        );
    });

    it('auto-confirms zero-payable cart orders and skips online payment gateways', async () => {
        Address.findById.mockResolvedValue({ id: 4, user_id: 1 });
        Cart.getOrCreate.mockResolvedValue({ id: 2 });
        Cart.calculateTotal.mockResolvedValue({
            subtotal: 10000,
            items: [{ id: 11, product_id: 1, quantity: 1, subtotal: 10000 }]
        });
        Voucher.validate.mockResolvedValue({
            valid: true,
            discountAmount: 40000,
            voucher: { id: 9 }
        });
        Order.create.mockResolvedValue({ id: 21 });
        Order.findById.mockResolvedValue({
            id: 21,
            order_code: 'ORDZERO',
            final_amount: 0,
            status: 'pending',
            payment_status: 'unpaid'
        });
        Order.updateStatus.mockResolvedValue({
            id: 21,
            order_code: 'ORDZERO',
            final_amount: 0,
            status: 'confirmed',
            payment_status: 'paid'
        });

        const req = {
            user: { id: 1 },
            body: {
                address_id: 4,
                payment_method: 'vnpay',
                voucher_code: 'BIGSALE',
                selected_cart_item_ids: '11'
            },
            ip: '127.0.0.1'
        };
        const res = createRes();

        await orderController.createOrder(req, res);

        expect(Order.updatePaymentStatus).toHaveBeenCalledWith(21, 'paid');
        expect(Order.updateStatus).toHaveBeenCalledWith(21, 'confirmed', expect.objectContaining({
            source: 'system'
        }));
        expect(paymentService.createVNPayPayment).not.toHaveBeenCalled();
        expect(res.redirect).toHaveBeenCalledWith('/orders/ORDZERO/confirmation');
    });

    it('rejects buy-now orders when the variant does not belong to the product', async () => {
        Address.findById.mockResolvedValue({ id: 8, user_id: 1 });
        Product.findById.mockResolvedValue({
            id: 3,
            price: 200000,
            final_price: 180000,
            stock_quantity: 10,
            variants: [{ id: 5, stock_quantity: 4 }]
        });

        const req = {
            user: { id: 1 },
            body: {
                product_id: 3,
                quantity: 1,
                address_id: 8,
                payment_method: 'cod',
                variant_id: 9
            }
        };
        const res = createRes();

        await orderController.createBuyNowOrder(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(Order.createFromProduct).not.toHaveBeenCalled();
    });

    it('calculates buy-now variant pricing numerically when product and variant prices are strings', async () => {
        Product.findById.mockResolvedValue({
            id: 3,
            name: 'Ao Cardigan Nu',
            slug: 'ao-cardigan-nu',
            price: '490000.00',
            final_price: '490000.00',
            stock_quantity: 10,
            images: [{ image_url: '/img/cardigan.jpg' }],
            variants: [{
                id: 5,
                color: 'Kem',
                size: 'M',
                stock_quantity: 4,
                additional_price: '20000.00'
            }]
        });
        Address.findByUser.mockResolvedValue([]);
        Voucher.findAll.mockResolvedValue([]);
        Voucher.getApplicableProductsMap.mockResolvedValue(new Map());

        const req = {
            user: { id: 1 },
            params: { productId: '3' },
            query: { variant_id: '5' }
        };
        const res = createRes();

        await orderController.showBuyNow(req, res);

        expect(res.render).toHaveBeenCalledWith('checkout/buy-now', expect.objectContaining({
            cart: expect.objectContaining({
                subtotal: 510000,
                items: [
                    expect.objectContaining({
                        unit_price: 510000,
                        subtotal: 510000
                    })
                ]
            }),
            selectedVariant: expect.objectContaining({ id: 5 })
        }));
    });

    it('passes numeric variant-adjusted price to Order.createFromProduct when source prices are strings', async () => {
        Address.findById.mockResolvedValue({ id: 8, user_id: 1 });
        Product.findById.mockResolvedValue({
            id: 3,
            name: 'Ao Cardigan Nu',
            price: '490000.00',
            final_price: '490000.00',
            stock_quantity: 10,
            images: [{ image_url: '/img/cardigan.jpg' }],
            variants: [{
                id: 5,
                stock_quantity: 4,
                additional_price: '20000.00'
            }]
        });
        Order.createFromProduct.mockResolvedValue({ id: 11 });
        Order.findById.mockResolvedValue({ id: 11, order_code: 'ORD123' });

        const req = {
            user: { id: 1 },
            body: {
                product_id: 3,
                quantity: 1,
                address_id: 8,
                payment_method: 'cod',
                variant_id: 5
            }
        };
        const res = createRes();

        await orderController.createBuyNowOrder(req, res);

        expect(Order.createFromProduct).toHaveBeenCalledWith(
            1,
            8,
            expect.objectContaining({ final_price: 510000 }),
            1,
            'cod',
            undefined,
            5,
            0,
            null
        );
        expect(res.redirect).toHaveBeenCalledWith('/orders/ORD123/confirmation');
    });

    it('clamps buy-now voucher discounts so the payable total never becomes negative', async () => {
        Address.findById.mockResolvedValue({ id: 8, user_id: 1 });
        Product.findById.mockResolvedValue({
            id: 3,
            name: 'Ao Cardigan Nu',
            price: 10000,
            final_price: 10000,
            stock_quantity: 10,
            variants: []
        });
        Voucher.validate.mockResolvedValue({
            valid: true,
            discountAmount: 999999,
            voucher: { id: 12 }
        });
        Order.createFromProduct.mockResolvedValue({ id: 30 });
        Order.findById.mockResolvedValue({ id: 30, order_code: 'ORD300' });

        const req = {
            user: { id: 1 },
            body: {
                product_id: 3,
                quantity: 1,
                address_id: 8,
                payment_method: 'cod',
                voucher_code: 'BIGSALE'
            }
        };
        const res = createRes();

        await orderController.createBuyNowOrder(req, res);

        expect(Order.createFromProduct).toHaveBeenCalledWith(
            1,
            8,
            expect.objectContaining({ final_price: 10000 }),
            1,
            'cod',
            undefined,
            null,
            40000,
            12
        );
    });

    it('records successful VNPay IPN callbacks and marks the order as paid', async () => {
        paymentService.verifyVNPayPayment.mockResolvedValue({
            isValidSignature: true,
            success: true,
            orderId: 'ORD123',
            transactionId: 'VNP123',
            amount: 120000,
            responseCode: '00',
            transactionStatus: '00',
            bankCode: 'NCB',
            cardType: 'ATM',
            payDate: '20260319093000',
            raw: { vnp_TxnRef: 'ORD123' }
        });
        Order.findByOrderCode.mockResolvedValue({
            id: 11,
            order_code: 'ORD123',
            final_amount: 120000,
            payment_status: 'unpaid'
        });

        const req = { query: { vnp_TxnRef: 'ORD123' }, user: null };
        const res = createRes();

        await orderController.vnpayIpn(req, res);

        expect(Payment.recordGatewayResult).toHaveBeenCalledWith(expect.objectContaining({
            orderId: 11,
            paymentMethod: 'vnpay',
            transactionId: 'VNP123',
            amount: 120000,
            status: 'success'
        }));
        expect(Order.updatePaymentStatus).toHaveBeenCalledWith(11, 'paid');
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ RspCode: '00', Message: 'Confirm Success' });
    });

    it('rejects VNPay IPN callbacks when the amount mismatches the order', async () => {
        paymentService.verifyVNPayPayment.mockResolvedValue({
            isValidSignature: true,
            success: true,
            orderId: 'ORD124',
            transactionId: 'VNP124',
            amount: 99999,
            responseCode: '00',
            transactionStatus: '00',
            raw: { vnp_TxnRef: 'ORD124' }
        });
        Order.findByOrderCode.mockResolvedValue({
            id: 12,
            order_code: 'ORD124',
            final_amount: 120000,
            payment_status: 'unpaid'
        });

        const req = { query: { vnp_TxnRef: 'ORD124' }, user: null };
        const res = createRes();

        await orderController.vnpayIpn(req, res);

        expect(Order.updatePaymentStatus).not.toHaveBeenCalled();
        expect(Payment.recordGatewayResult).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ RspCode: '04', Message: 'Invalid Amount' });
    });
});
