process.env.NODE_ENV = 'test';

const fs = require('fs');
const path = require('path');
const ejs = require('ejs');

jest.mock('../models/Category', () => ({
    findRootCategories: jest.fn()
}));

const Category = require('../models/Category');
const headerCategories = require('../middleware/headerCategories');

describe('header category navigation', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('loads root categories into res.locals for all views', async () => {
        const categories = [
            { id: 1, name: 'Nam', slug: 'nam' },
            { id: 4, name: 'Phụ kiện', slug: 'phu-kien' }
        ];
        const req = {};
        const res = { locals: {} };
        const next = jest.fn();

        Category.findRootCategories.mockResolvedValue(categories);

        await headerCategories(req, res, next);

        expect(Category.findRootCategories).toHaveBeenCalledTimes(1);
        expect(res.locals.headerCategories).toEqual(categories);
        expect(next).toHaveBeenCalledTimes(1);
    });

    it('renders dynamic root categories in both desktop and mobile navigation', () => {
        const templatePath = path.join(__dirname, '..', 'views', 'partials', 'header.ejs');
        const template = fs.readFileSync(templatePath, 'utf8');

        const html = ejs.render(
            template,
            {
                pageStyles: [],
                user: null,
                path: '/products/category/phu-kien',
                category: { slug: 'phu-kien' },
                headerCategories: [
                    { id: 1, name: 'Nam', slug: 'nam' },
                    { id: 4, name: 'Phụ kiện', slug: 'phu-kien' }
                ]
            },
            { filename: templatePath }
        );

        expect(html).toContain('Phụ kiện');
        expect(html).not.toContain('/products/category/tre-em');
        expect(html.match(/\/products\/category\/phu-kien/g)).toHaveLength(2);
    });
});
