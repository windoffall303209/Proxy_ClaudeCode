const Category = require('../models/Category');

async function headerCategories(req, res, next) {
    try {
        res.locals.headerCategories = await Category.findRootCategories();
    } catch (error) {
        console.error('Header categories error:', error);
        res.locals.headerCategories = [];
    }

    next();
}

module.exports = headerCategories;
