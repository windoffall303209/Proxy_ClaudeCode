process.env.NODE_ENV = 'test';

jest.mock('../models/Order', () => ({
    create: jest.fn(),
    createFromProduct: jest.fn(),
    findById: jest.fn(),
    findByOrderCode: jest.fn(),
    updatePaymentStatus: jest.fn()
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
const orderController = require('../controllers/orderController');

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
            7
        );
        expect(res.redirect).toHaveBeenCalledWith('/orders/ORD123/confirmation');
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
});
