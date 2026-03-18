process.env.NODE_ENV = 'test';

jest.mock('../models/Cart', () => ({
    getOrCreate: jest.fn(),
    findItemByProduct: jest.fn(),
    addItem: jest.fn(),
    getCartCount: jest.fn(),
    getScopedItem: jest.fn(),
    updateQuantity: jest.fn(),
    getItemById: jest.fn(),
    removeItem: jest.fn()
}));

jest.mock('../models/Product', () => ({
    findById: jest.fn()
}));

const Cart = require('../models/Cart');
const Product = require('../models/Product');
const cartController = require('../controllers/cartController');

function createRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.redirect = jest.fn().mockReturnValue(res);
    res.render = jest.fn().mockReturnValue(res);
    return res;
}

describe('cartController', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('rejects non-positive quantity when adding to cart', async () => {
        const req = {
            body: { product_id: 1, quantity: -1 },
            sessionID: 'guest-session'
        };
        const res = createRes();

        await cartController.addToCart(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: false
        }));
        expect(Cart.getOrCreate).not.toHaveBeenCalled();
    });

    it('rejects variant ids that do not belong to the product', async () => {
        Cart.getOrCreate.mockResolvedValue({ id: 10 });
        Cart.findItemByProduct.mockResolvedValue(null);
        Product.findById.mockResolvedValue({
            id: 1,
            stock_quantity: 10,
            variants: [{ id: 2, stock_quantity: 5 }]
        });

        const req = {
            body: { product_id: 1, quantity: 1, variant_id: 99 },
            sessionID: 'guest-session'
        };
        const res = createRes();

        await cartController.addToCart(req, res);

        expect(Product.findById).toHaveBeenCalledWith(1, { incrementView: false });
        expect(res.status).toHaveBeenCalledWith(400);
        expect(Cart.addItem).not.toHaveBeenCalled();
    });

    it('rejects updates for cart items outside the current cart scope', async () => {
        Cart.getOrCreate.mockResolvedValue({ id: 20 });
        Cart.getScopedItem.mockResolvedValue(null);

        const req = {
            body: { cart_item_id: 88, quantity: 1 },
            sessionID: 'guest-session'
        };
        const res = createRes();

        await cartController.updateCart(req, res);

        expect(Cart.getScopedItem).toHaveBeenCalledWith(20, 88);
        expect(res.status).toHaveBeenCalledWith(404);
        expect(Cart.updateQuantity).not.toHaveBeenCalled();
    });
});
