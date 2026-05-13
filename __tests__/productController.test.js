// Kiểm thử tự động cho tests productcontroller.test để giữ ổn định hành vi quan trọng.
process.env.NODE_ENV = 'test';

jest.mock('../models/Product', () => ({
    findBySlug: jest.fn(),
    findAll: jest.fn(),
    count: jest.fn(),
    search: jest.fn(),
    getForYouRecommendations: jest.fn(),
    getReviewContext: jest.fn(),
    createReview: jest.fn(),
    updateReview: jest.fn()
}));

jest.mock('../models/Category', () => ({
    findBySlug: jest.fn(),
    findAll: jest.fn()
}));
jest.mock('../models/Banner', () => ({}));

const Product = require('../models/Product');
const Category = require('../models/Category');
const productController = require('../controllers/productController');

// Tạo response giả lập cho test.
function createRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.redirect = jest.fn().mockReturnValue(res);
    res.render = jest.fn().mockReturnValue(res);
    return res;
}

describe('productController.getProductDetail description rendering', () => {
    let consoleErrorSpy;

    beforeEach(() => {
        jest.clearAllMocks();
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleErrorSpy?.mockRestore();
    });

    it('keeps plain text line breaks by converting them into paragraphs and breaks', async () => {
        Product.findBySlug.mockResolvedValue({
            id: 1,
            slug: 'ao-thun-basic',
            category_id: 3,
            description: 'Dong 1\nDong 2\n\nDong 3'
        });
        Product.findAll.mockResolvedValue([
            { id: 1, slug: 'ao-thun-basic' },
            { id: 2, slug: 'ao-khoac' }
        ]);
        Product.getReviewContext.mockResolvedValue({
            canReview: false,
            eligibleOrder: null,
            existingReview: null
        });

        const req = {
            params: { slug: 'ao-thun-basic' },
            user: null
        };
        const res = createRes();

        await productController.getProductDetail(req, res);

        expect(res.render).toHaveBeenCalledWith('products/detail', expect.objectContaining({
            product: expect.objectContaining({
                descriptionHtml: '<p>Dong 1<br>Dong 2</p><p>Dong 3</p>'
            }),
            relatedProducts: [{ id: 2, slug: 'ao-khoac' }],
            user: null
        }));
    });

    it('preserves allowed rich text tags and strips unsafe markup', async () => {
        Product.findBySlug.mockResolvedValue({
            id: 4,
            slug: 'dam-midi',
            category_id: 7,
            description: '<p><strong>Chat lieu</strong> <em>mem mai</em></p><script>alert(1)</script><a href="javascript:alert(2)">Xau</a><a href="https://example.com" target="_blank">Tot</a>'
        });
        Product.findAll.mockResolvedValue([]);
        Product.getReviewContext.mockResolvedValue({
            canReview: false,
            eligibleOrder: null,
            existingReview: null
        });

        const req = {
            params: { slug: 'dam-midi' },
            user: null
        };
        const res = createRes();

        await productController.getProductDetail(req, res);

        const renderData = res.render.mock.calls[0][1];
        expect(renderData.product.descriptionHtml).toContain('<strong>Chat lieu</strong>');
        expect(renderData.product.descriptionHtml).toContain('<em>mem mai</em>');
        expect(renderData.product.descriptionHtml).toContain('rel="noopener noreferrer nofollow"');
        expect(renderData.product.descriptionHtml).not.toContain('<script');
        expect(renderData.product.descriptionHtml).not.toContain('javascript:');
    });

    it('includes review context and reviews when rendering the product detail page', async () => {
        Product.findBySlug.mockResolvedValue({
            id: 10,
            slug: 'ao-len',
            category_id: 2,
            description: 'Mo ta',
            reviews: [{ id: 1, rating: 5, comment: 'Rat dep' }],
            average_rating: 5,
            review_count: 1
        });
        Product.findAll.mockResolvedValue([]);
        Product.getReviewContext.mockResolvedValue({
            canReview: true,
            eligibleOrder: { id: 44, order_code: 'ORD001' },
            existingReview: null
        });

        const req = {
            params: { slug: 'ao-len' },
            query: { review: 'submitted' },
            user: { id: 8 }
        };
        const res = createRes();

        await productController.getProductDetail(req, res);

        expect(Product.getReviewContext).toHaveBeenCalledWith(10, 8);
        expect(res.render).toHaveBeenCalledWith('products/detail', expect.objectContaining({
            reviews: [{ id: 1, rating: 5, comment: 'Rat dep' }],
            reviewContext: expect.objectContaining({
                canReview: true,
                eligibleOrder: { id: 44, order_code: 'ORD001' }
            }),
            reviewFeedback: expect.objectContaining({
                type: 'success'
            })
        }));
    });
});

describe('productController.createProductReview', () => {
    let consoleErrorSpy;

    beforeEach(() => {
        jest.clearAllMocks();
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleErrorSpy?.mockRestore();
    });

    it('creates a verified approved review for an eligible delivered order', async () => {
        Product.findBySlug.mockResolvedValue({
            id: 12,
            slug: 'ao-khoac-da'
        });
        Product.getReviewContext.mockResolvedValue({
            canReview: true,
            eligibleOrder: { id: 77, order_code: 'ORD777' },
            existingReview: null
        });
        Product.createReview.mockResolvedValue({ id: 5 });

        const req = {
            params: { slug: 'ao-khoac-da' },
            body: { rating: '5', comment: 'Chat vai tot' },
            user: { id: 3 }
        };
        const res = createRes();

        await productController.createProductReview(req, res);

        expect(Product.findBySlug).toHaveBeenCalledWith('ao-khoac-da', { incrementView: false });
        expect(Product.createReview).toHaveBeenCalledWith({
            productId: 12,
            userId: 3,
            orderId: 77,
            rating: 5,
            comment: 'Chat vai tot',
            isVerified: true,
            isApproved: true,
            media: []
        });
        expect(res.redirect).toHaveBeenCalledWith('/products/ao-khoac-da?review=submitted');
    });

    it('rejects duplicate reviews for the same product', async () => {
        Product.findBySlug.mockResolvedValue({
            id: 20,
            slug: 'dam-lua'
        });
        Product.getReviewContext.mockResolvedValue({
            canReview: false,
            eligibleOrder: null,
            existingReview: { id: 9, rating: 4 }
        });

        const req = {
            params: { slug: 'dam-lua' },
            body: { rating: '4', comment: 'OK' },
            user: { id: 11 }
        };
        const res = createRes();

        await productController.createProductReview(req, res);

        expect(Product.createReview).not.toHaveBeenCalled();
        expect(res.redirect).toHaveBeenCalledWith('/products/dam-lua?review=already-reviewed');
    });
});

describe('productController.updateProductReview', () => {
    let consoleErrorSpy;

    beforeEach(() => {
        jest.clearAllMocks();
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleErrorSpy?.mockRestore();
    });

    it('updates an existing review and forwards removed media ids', async () => {
        Product.findBySlug.mockResolvedValue({
            id: 50,
            slug: 'ao-gio'
        });
        Product.getReviewContext.mockResolvedValue({
            canReview: false,
            eligibleOrder: null,
            existingReview: {
                id: 99,
                rating: 4,
                comment: 'Cu',
                media: [
                    { id: 701, media_type: 'image', media_url: 'https://example.com/old.jpg' }
                ]
            }
        });
        Product.updateReview.mockResolvedValue({
            id: 99,
            removedMedia: [],
            media: [
                { media_type: 'image', media_url: 'https://example.com/new.jpg' }
            ]
        });

        const req = {
            params: { slug: 'ao-gio', reviewId: '99' },
            body: {
                rating: '5',
                comment: 'Da cap nhat',
                remove_media_ids: ['701']
            },
            uploadedReviewMedia: [
                {
                    mediaType: 'image',
                    mediaUrl: 'https://example.com/new.jpg',
                    publicId: 'reviews/new'
                }
            ],
            user: { id: 14 }
        };
        const res = createRes();

        await productController.updateProductReview(req, res);

        expect(Product.updateReview).toHaveBeenCalledWith({
            reviewId: 99,
            userId: 14,
            rating: 5,
            comment: 'Da cap nhat',
            removeMediaIds: [701],
            media: [
                {
                    mediaType: 'image',
                    mediaUrl: 'https://example.com/new.jpg',
                    publicId: 'reviews/new'
                }
            ]
        });
        expect(res.redirect).toHaveBeenCalledWith('/products/ao-gio?review=updated');
    });

    it('rejects updates that exceed review media limits', async () => {
        Product.findBySlug.mockResolvedValue({
            id: 51,
            slug: 'quan-linen'
        });
        Product.getReviewContext.mockResolvedValue({
            canReview: false,
            eligibleOrder: null,
            existingReview: {
                id: 100,
                media: [
                    { id: 1, media_type: 'image' },
                    { id: 2, media_type: 'image' },
                    { id: 3, media_type: 'image' },
                    { id: 4, media_type: 'image' },
                    { id: 5, media_type: 'image' }
                ]
            }
        });

        const req = {
            params: { slug: 'quan-linen', reviewId: '100' },
            body: {
                rating: '4',
                comment: 'Them media'
            },
            uploadedReviewMedia: [
                {
                    mediaType: 'image',
                    mediaUrl: 'https://example.com/extra.jpg'
                }
            ],
            user: { id: 22 }
        };
        const res = createRes();

        await productController.updateProductReview(req, res);

        expect(Product.updateReview).not.toHaveBeenCalled();
        expect(res.redirect).toHaveBeenCalledWith('/products/quan-linen?review=invalid-media');
    });
});

describe('productController product listing rules', () => {
    let consoleErrorSpy;

    beforeEach(() => {
        jest.clearAllMocks();
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleErrorSpy?.mockRestore();
    });

    it('prioritizes in-stock products on the main listing page', async () => {
        Product.count.mockResolvedValue(28);
        Product.findAll.mockResolvedValue([]);
        Category.findAll.mockResolvedValue([]);

        const req = {
            query: {
                sort: 'price-asc',
                page: '2',
                per_page: '10',
                search: 'ao so mi'
            },
            headers: {
                accept: 'text/html'
            },
            user: null
        };
        const res = createRes();

        await productController.getProducts(req, res);

        expect(Product.findAll).toHaveBeenCalledWith(expect.objectContaining({
            limit: 10,
            offset: 10,
            search: 'ao so mi',
            sort_by: 'price',
            sort_order: 'ASC',
            prioritize_in_stock: true
        }));
        expect(res.render).toHaveBeenCalledWith('products/list', expect.objectContaining({
            products: [],
            totalItems: 28,
            totalPages: 3,
            perPage: 10
        }));
    });

    it('maps best-selling sort to sold_count descending', async () => {
        Product.count.mockResolvedValue(12);
        Product.findAll.mockResolvedValue([]);
        Category.findAll.mockResolvedValue([]);

        const req = {
            query: {
                sort: 'best-selling'
            },
            headers: {
                accept: 'text/html'
            },
            user: null
        };
        const res = createRes();

        await productController.getProducts(req, res);

        expect(Product.findAll).toHaveBeenCalledWith(expect.objectContaining({
            sort_by: 'sold_count',
            sort_order: 'DESC'
        }));
        expect(res.render).toHaveBeenCalledWith('products/list', expect.objectContaining({
            currentSort: 'best-selling'
        }));
    });

    it('prioritizes in-stock products on category pages', async () => {
        Category.findBySlug.mockResolvedValue({
            id: 9,
            name: 'Ao nu',
            slug: 'ao-nu'
        });
        Product.count.mockResolvedValue(45);
        Product.findAll.mockResolvedValue([]);

        const req = {
            params: { slug: 'ao-nu' },
            query: {
                sort: 'name-desc',
                per_page: '30',
                page: '2'
            },
            headers: {
                accept: 'text/html'
            },
            user: null
        };
        const res = createRes();

        await productController.getProductsByCategory(req, res);

        expect(Product.findAll).toHaveBeenCalledWith(expect.objectContaining({
            category_id: 9,
            limit: 30,
            offset: 30,
            sort_by: 'name',
            sort_order: 'DESC',
            prioritize_in_stock: true
        }));
        expect(res.render).toHaveBeenCalledWith('products/category', expect.objectContaining({
            category: expect.objectContaining({ id: 9 }),
            totalItems: 45,
            totalPages: 2,
            perPage: 30
        }));
    });

    it('prioritizes in-stock products for related items on product detail', async () => {
        Product.findBySlug.mockResolvedValue({
            id: 14,
            slug: 'dam-midi',
            category_id: 3,
            description: 'Mo ta'
        });
        Product.findAll.mockResolvedValue([]);
        Product.getReviewContext.mockResolvedValue({
            canReview: false,
            eligibleOrder: null,
            existingReview: null
        });

        const req = {
            params: { slug: 'dam-midi' },
            user: null
        };
        const res = createRes();

        await productController.getProductDetail(req, res);

        expect(Product.findAll).toHaveBeenCalledWith(expect.objectContaining({
            category_id: 3,
            limit: 4,
            offset: 0,
            prioritize_in_stock: true
        }));
    });

    it('paginates search results using the selected per-page size', async () => {
        const allResults = Array.from({ length: 25 }, (_, index) => ({
            id: index + 1,
            slug: `product-${index + 1}`
        }));

        Product.count.mockResolvedValue(80);
        Product.search.mockResolvedValue(allResults);

        const req = {
            query: {
                q: 'ao khoac',
                page: '2',
                per_page: '10'
            },
            user: null
        };
        const res = createRes();

        await productController.searchProducts(req, res);

        expect(Product.search).toHaveBeenCalledWith('ao khoac', 80);
        const expectedProducts = [...allResults].sort((left, right) => right.id - left.id).slice(10, 20);
        expect(res.render).toHaveBeenCalledWith('products/search-results', expect.objectContaining({
            products: expectedProducts,
            totalItems: 25,
            totalPages: 3,
            currentPage: 2,
            perPage: 10
        }));
    });

    it('maps sale=true to the shared promotion filter on the main listing page', async () => {
        Product.count.mockResolvedValue(9);
        Product.findAll.mockResolvedValue([]);
        Category.findAll.mockResolvedValue([]);

        const req = {
            query: {
                sale: 'true',
                page: '1'
            },
            headers: {
                accept: 'text/html'
            },
            user: null
        };
        const res = createRes();

        await productController.getProducts(req, res);

        expect(Product.count).toHaveBeenCalledWith(expect.objectContaining({
            promotion: 'active_or_upcoming',
            use_final_price: true
        }));
        expect(Product.findAll).toHaveBeenCalledWith(expect.objectContaining({
            promotion: 'active_or_upcoming',
            use_final_price: true
        }));
        expect(res.render).toHaveBeenCalledWith('products/list', expect.objectContaining({
            isSalePage: true,
            filters: expect.objectContaining({
                promotion: ['active_or_upcoming']
            })
        }));
    });

    it('filters search results by category, rating and promotion before paginating', async () => {
        Category.findBySlug.mockResolvedValue({
            id: 2,
            name: 'Thời Trang Nữ',
            slug: 'nu'
        });
        Category.findAll.mockResolvedValue([
            { id: 2, name: 'Thời Trang Nữ', slug: 'nu' }
        ]);
        Product.count.mockResolvedValue(20);
        Product.search.mockResolvedValue([
            { id: 1, slug: 'active-match', category_id: 2, average_rating: 4.8, promotion_status: 'active', price: 300000, final_price: 250000, display_price: 250000 },
            { id: 2, slug: 'wrong-category', category_id: 3, average_rating: 5, promotion_status: 'active', price: 250000, final_price: 240000, display_price: 240000 },
            { id: 3, slug: 'wrong-rating', category_id: 2, average_rating: 3.2, promotion_status: 'active', price: 200000, final_price: 180000, display_price: 180000 },
            { id: 4, slug: 'wrong-promotion', category_id: 2, average_rating: 4.9, promotion_status: 'upcoming', price: 280000, final_price: 280000, display_price: 280000 }
        ]);

        const req = {
            query: {
                q: 'ao polo',
                category: 'nu',
                rating: '4',
                promotion: 'active'
            },
            user: null
        };
        const res = createRes();

        await productController.searchProducts(req, res);

        expect(res.render).toHaveBeenCalledWith('products/search-results', expect.objectContaining({
            products: [expect.objectContaining({ slug: 'active-match' })],
            totalItems: 1,
            filters: expect.objectContaining({
                category: ['nu'],
                rating: ['4'],
                promotion: ['active']
            })
        }));
    });

    it('supports multi-select filters on category pages', async () => {
        Category.findBySlug.mockResolvedValue({
            id: 1,
            name: 'Nam',
            slug: 'nam',
            parent_id: null
        });
        Category.findAll.mockResolvedValue([
            { id: 1, name: 'Nam', slug: 'nam', parent_id: null },
            { id: 11, name: 'Ao khoac nam', slug: 'ao-khoac-nam', parent_id: 1 },
            { id: 12, name: 'Quan nam', slug: 'quan-nam', parent_id: 1 }
        ]);
        Product.count.mockResolvedValue(12);
        Product.findAll.mockResolvedValue([]);

        const req = {
            params: { slug: 'nam' },
            query: {
                category: ['ao-khoac-nam', 'quan-nam'],
                price_range: [':200000', '1000000:'],
                rating: ['5', '4'],
                promotion: ['active', 'upcoming']
            },
            headers: {
                accept: 'text/html'
            },
            user: null
        };
        const res = createRes();

        await productController.getProductsByCategory(req, res);

        expect(Product.findAll).toHaveBeenCalledWith(expect.objectContaining({
            category_ids: [11, 12],
            ratings: [5, 4],
            promotions: ['active', 'upcoming'],
            price_ranges: [
                expect.objectContaining({ min: null, max: 200000 }),
                expect.objectContaining({ min: 1000000, max: null })
            ]
        }));
        expect(res.render).toHaveBeenCalledWith('products/category', expect.objectContaining({
            filters: expect.objectContaining({
                category: ['ao-khoac-nam', 'quan-nam'],
                rating: ['5', '4'],
                promotion: ['active', 'upcoming'],
                price_ranges: [':200000', '1000000:']
            })
        }));
    });
});

describe('productController.getForYou', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders recommendations for logged in users', async () => {
        Product.getForYouRecommendations.mockResolvedValue([
            { id: 1, slug: 'ao-polo' },
            { id: 2, slug: 'quan-jean' }
        ]);

        const req = {
            user: { id: 5 }
        };
        const res = createRes();

        await productController.getForYou(req, res);

        expect(Product.getForYouRecommendations).toHaveBeenCalledWith(5, 30);
        expect(res.render).toHaveBeenCalledWith('products/for-you', expect.objectContaining({
            products: expect.arrayContaining([
                expect.objectContaining({ slug: 'ao-polo' }),
                expect.objectContaining({ slug: 'quan-jean' })
            ]),
            hasPurchaseHistory: true,
            path: '/products/for-you'
        }));
    });

    it('renders an empty state when the user has no purchase history', async () => {
        Product.getForYouRecommendations.mockResolvedValue([]);

        const req = {
            user: { id: 8 }
        };
        const res = createRes();

        await productController.getForYou(req, res);

        expect(res.render).toHaveBeenCalledWith('products/for-you', expect.objectContaining({
            products: [],
            hasPurchaseHistory: false
        }));
    });
});
