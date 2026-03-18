/**
 * =============================================================================
 * PRODUCT CONTROLLER - Điều khiển sản phẩm (Frontend)
 * =============================================================================
 * File này chứa các hàm xử lý logic hiển thị sản phẩm cho khách hàng:
 * - Trang chủ (Homepage)
 * - Danh sách sản phẩm (Product listing)
 * - Chi tiết sản phẩm (Product detail)
 * - Tìm kiếm sản phẩm (Search)
 * - Sản phẩm theo danh mục (Category products)
 * =============================================================================
 */

const Product = require('../models/Product');
const Category = require('../models/Category');
const Banner = require('../models/Banner');

// =============================================================================
// TRANG CHỦ - HOMEPAGE
// =============================================================================

/**
 * Hiển thị trang chủ
 *
 * @description Lấy dữ liệu banners, danh mục, sản phẩm mới và bán chạy
 *              để hiển thị trên trang chủ
 *
 * @param {Object} req - Request object từ Express
 * @param {Object} res - Response object từ Express
 *
 * @returns {Render} Render trang home/index với dữ liệu
 */
exports.getHomePage = async (req, res) => {
    try {
        // Lấy danh sách banner đang hoạt động (cho carousel)
        const banners = await Banner.getActiveBanners().catch(err => {
            console.error('Banner error:', err);
            return []; // Trả về mảng rỗng nếu lỗi
        });

        // Lấy 3 danh mục hàng đầu
        const categories = await Category.getTopCategories(3).catch(err => {
            console.error('Category error:', err);
            // Dữ liệu mẫu fallback nếu lỗi database
            return [
                { id: 1, name: 'Thời Trang Nam', slug: 'nam', product_count: 5 },
                { id: 2, name: 'Thời Trang Nữ', slug: 'nu', product_count: 5 },
                { id: 3, name: 'Thời Trang Trẻ Em', slug: 'tre-em', product_count: 4 }
            ];
        });

        // Lấy 8 sản phẩm mới nhất
        const newProducts = await Product.getNewProducts(8).catch(err => {
            console.error('New products error:', err);
            // Dữ liệu mẫu fallback
            return [
                { id: 1, name: 'Áo Polo Classic Nam', slug: 'ao-polo-classic', price: 450000, final_price: 225000, primary_image: 'https://images.unsplash.com/photo-1586790170083-2f9ceadc732d?w=600' },
                { id: 2, name: 'Đầm Maxi Hoa', slug: 'dam-maxi-hoa', price: 750000, final_price: 592500, primary_image: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=600' },
                { id: 3, name: 'Áo Thun Basic', slug: 'ao-thun-basic', price: 250000, final_price: 250000, primary_image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600' },
                { id: 4, name: 'Váy Công Sở', slug: 'vay-cong-so', price: 420000, final_price: 420000, primary_image: 'https://images.unsplash.com/photo-1594633313593-bab3825d0caf?w=600' }
            ];
        });

        // Lấy 8 sản phẩm bán chạy nhất
        const bestSellers = await Product.getBestSellers(8).catch(err => {
            console.error('Best sellers error:', err);
            // Dữ liệu mẫu fallback
            return [
                { id: 5, name: 'Quần Jeans Slim Fit', slug: 'quan-jeans', price: 680000, final_price: 680000, primary_image: 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=600' },
                { id: 6, name: 'Áo Sơ Mi Lụa', slug: 'ao-so-mi-lua', price: 520000, final_price: 520000, primary_image: 'https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?w=600' },
                { id: 7, name: 'Bộ Đồ Bé Trai', slug: 'bo-do-be-trai', price: 320000, final_price: 320000, primary_image: 'https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?w=600' },
                { id: 8, name: 'Áo Sơ Mi Oxford', slug: 'ao-so-mi-oxford', price: 520000, final_price: 410800, primary_image: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600' }
            ];
        });

        // Render trang chủ với dữ liệu
        res.render('home/index', {
            banners,
            categories,
            newProducts,
            bestSellers,
            user: req.user || null
        });
    } catch (error) {
        console.error('Homepage error:', error);
        res.status(500).render('error', { message: 'Unable to load homepage', user: req.user || null });
    }
};

// =============================================================================
// DANH SÁCH SẢN PHẨM - PRODUCT LISTING
// =============================================================================

/**
 * Hiển thị danh sách sản phẩm với bộ lọc
 *
 * @description Lấy danh sách sản phẩm theo các tiêu chí lọc:
 *              danh mục, từ khóa, khoảng giá, sắp xếp
 *
 * @param {Object} req - Request object từ Express
 * @param {Object} req.query - Tham số lọc từ URL
 * @param {string} [req.query.category] - Slug danh mục
 * @param {string} [req.query.search] - Từ khóa tìm kiếm
 * @param {number} [req.query.min_price] - Giá tối thiểu
 * @param {number} [req.query.max_price] - Giá tối đa
 * @param {string} [req.query.sort_by] - Trường sắp xếp (price, created_at, name)
 * @param {string} [req.query.sort_order] - Thứ tự (ASC, DESC)
 * @param {number} [req.query.page=1] - Số trang
 * @param {Object} res - Response object từ Express
 *
 * @returns {Render} Render trang products/list với danh sách sản phẩm
 */
exports.getProducts = async (req, res) => {
    try {
        // Lấy các tham số lọc từ query string
        const {
            category,       // Slug danh mục
            search,         // Từ khóa tìm kiếm
            min_price,      // Giá tối thiểu
            max_price,      // Giá tối đa
            sort,           // Sắp xếp (price-asc, price-desc, name-asc, name-desc, newest)
            page = 1,       // Số trang (mặc định: 1)
            sale            // Lọc sản phẩm đang khuyến mãi
        } = req.query;

        // Xử lý sort parameter
        let sort_by = 'created_at';
        let sort_order = 'DESC';

        if (sort) {
            switch (sort) {
                case 'price-asc':
                    sort_by = 'price';
                    sort_order = 'ASC';
                    break;
                case 'price-desc':
                    sort_by = 'price';
                    sort_order = 'DESC';
                    break;
                case 'name-asc':
                    sort_by = 'name';
                    sort_order = 'ASC';
                    break;
                case 'name-desc':
                    sort_by = 'name';
                    sort_order = 'DESC';
                    break;
                case 'newest':
                default:
                    sort_by = 'created_at';
                    sort_order = 'DESC';
                    break;
            }
        }

        // Cấu hình phân trang
        const limit = 12;                    // 12 sản phẩm mỗi trang
        const offset = (page - 1) * limit;   // Bỏ qua bao nhiêu sản phẩm

        // Xây dựng object filter
        const filters = {
            limit,
            offset,
            sort_by,
            sort_order
        };

        // Lọc theo danh mục nếu có
        if (category) {
            const cat = await Category.findBySlug(category).catch(() => null);
            if (cat) filters.category_id = cat.id;
        }

        // Lọc theo từ khóa tìm kiếm
        if (search) filters.search = search;

        // Lọc theo khoảng giá
        if (min_price) filters.min_price = parseFloat(min_price);
        if (max_price) filters.max_price = parseFloat(max_price);

        // Lọc sản phẩm đang khuyến mãi
        if (sale === 'true') filters.on_sale = true;

        // Lấy danh sách sản phẩm với error handling
        let products = [];
        let categories = [];

        try {
            products = await Product.findAll(filters);
        } catch (err) {
            console.error('Product findAll error:', err);
            // Dữ liệu mẫu fallback
            products = [
                { id: 1, name: 'Áo Polo Classic Nam', slug: 'ao-polo-classic', price: 450000, final_price: 225000, primary_image: 'https://images.unsplash.com/photo-1586790170083-2f9ceadc732d?w=600' },
                { id: 2, name: 'Đầm Maxi Hoa', slug: 'dam-maxi-hoa', price: 750000, final_price: 592500, primary_image: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=600' },
                { id: 3, name: 'Áo Thun Basic', slug: 'ao-thun-basic', price: 250000, final_price: 250000, primary_image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600' },
                { id: 4, name: 'Váy Công Sở', slug: 'vay-cong-so', price: 420000, final_price: 420000, primary_image: 'https://images.unsplash.com/photo-1594633313593-bab3825d0caf?w=600' }
            ];
        }

        // Lấy danh sách danh mục cho sidebar
        try {
            categories = await Category.findAll();
        } catch (err) {
            console.error('Category findAll error:', err);
            categories = [
                { id: 1, name: 'Thời Trang Nam', slug: 'nam', product_count: 5 },
                { id: 2, name: 'Thời Trang Nữ', slug: 'nu', product_count: 5 },
                { id: 3, name: 'Thời Trang Trẻ Em', slug: 'tre-em', product_count: 4 }
            ];
        }

        // Return JSON if requested (for AJAX)
        if (req.headers.accept && req.headers.accept.includes('application/json')) {
            return res.json({
                products,
                currentPage: parseInt(page),
                totalPages: Math.ceil(products.length / limit) || 1
            });
        }

        // Render trang danh sách sản phẩm
        res.render('products/list', {
            products,
            categories,
            category: null,                  // Không có category cụ thể
            filters: req.query,              // Giữ lại filter để hiển thị
            currentPage: parseInt(page),
            user: req.user || null,
            isSalePage: sale === 'true'      // Đánh dấu đây là trang sale
        });
    } catch (error) {
        console.error('Product listing error:', error);
        res.status(500).render('error', { message: 'Lỗi tải danh sách sản phẩm: ' + error.message, user: req.user || null });
    }
};

// =============================================================================
// CHI TIẾT SẢN PHẨM - PRODUCT DETAIL
// =============================================================================

/**
 * Hiển thị chi tiết sản phẩm
 *
 * @description Lấy thông tin đầy đủ của sản phẩm và sản phẩm liên quan
 *
 * @param {Object} req - Request object từ Express
 * @param {Object} req.params.slug - Slug của sản phẩm
 * @param {Object} res - Response object từ Express
 *
 * @returns {Render} Render trang products/detail với thông tin sản phẩm
 */
exports.getProductDetail = async (req, res) => {
    try {
        const { slug } = req.params;

        // Tìm sản phẩm theo slug
        let product = null;
        try {
            product = await Product.findBySlug(slug);
        } catch (err) {
            console.error('Product findBySlug error:', err);
        }

        // Trả về 404 nếu không tìm thấy
        if (!product) {
            return res.status(404).render('error', {
                message: 'Không tìm thấy sản phẩm: ' + slug,
                user: req.user || null
            });
        }

        // Lấy sản phẩm liên quan (cùng danh mục)
        let relatedProducts = [];
        try {
            relatedProducts = await Product.findAll({
                category_id: product.category_id,
                limit: 4,
                offset: 0
            });
            // Loại bỏ sản phẩm hiện tại khỏi danh sách liên quan
            relatedProducts = relatedProducts.filter(p => p.id !== product.id);
        } catch (err) {
            console.error('Related products error:', err);
        }

        // Render trang chi tiết
        res.render('products/detail', {
            product,
            relatedProducts,
            user: req.user || null
        });
    } catch (error) {
        console.error('Product detail error:', error);
        res.status(500).render('error', { message: 'Lỗi tải chi tiết sản phẩm: ' + error.message, user: req.user || null });
    }
};

// =============================================================================
// TÌM KIẾM SẢN PHẨM - SEARCH
// =============================================================================

/**
 * Tìm kiếm sản phẩm
 *
 * @description Tìm kiếm sản phẩm theo từ khóa trong tên và mô tả
 *
 * @param {Object} req - Request object từ Express
 * @param {Object} req.query.q - Từ khóa tìm kiếm
 * @param {Object} res - Response object từ Express
 *
 * @returns {Render|Redirect} Render trang kết quả tìm kiếm hoặc redirect
 */
exports.searchProducts = async (req, res) => {
    try {
        const { q } = req.query;

        // Redirect về trang danh sách nếu không có từ khóa
        if (!q) {
            return res.redirect('/products');
        }

        // Tìm kiếm sản phẩm (tối đa 20 kết quả)
        const products = await Product.search(q, 20);

        // Render trang kết quả
        res.render('products/search-results', {
            products,
            query: q,
            user: req.user || null
        });
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).render('error', { message: 'Search failed' });
    }
};

// =============================================================================
// SẢN PHẨM THEO DANH MỤC - CATEGORY PRODUCTS
// =============================================================================

/**
 * Hiển thị sản phẩm theo danh mục
 *
 * @description Lấy danh sách sản phẩm thuộc một danh mục cụ thể
 *
 * @param {Object} req - Request object từ Express
 * @param {Object} req.params.slug - Slug của danh mục
 * @param {Object} res - Response object từ Express
 *
 * @returns {Render} Render trang products/category với sản phẩm theo danh mục
 */
exports.getProductsByCategory = async (req, res) => {
    try {
        const { slug } = req.params;
        const { sort, page = 1 } = req.query;

        // Tìm danh mục theo slug
        let category = await Category.findBySlug(slug);

        // Fallback sang dữ liệu mẫu nếu không tìm thấy trong database
        if (!category) {
            const categoryMap = {
                'nam': { id: 1, name: 'Thời Trang Nam', slug: 'nam', description: 'Quần áo và phụ kiện nam' },
                'nu': { id: 2, name: 'Thời Trang Nữ', slug: 'nu', description: 'Quần áo và phụ kiện nữ' },
                'tre-em': { id: 3, name: 'Thời Trang Trẻ Em', slug: 'tre-em', description: 'Quần áo trẻ em' }
            };
            category = categoryMap[slug] || null;
        }

        // Trả về 404 nếu không tìm thấy danh mục
        if (!category) {
            return res.status(404).render('error', {
                message: 'Không tìm thấy danh mục: ' + slug,
                user: req.user || null
            });
        }

        // Xử lý sort parameter
        let sort_by = 'created_at';
        let sort_order = 'DESC';

        if (sort) {
            switch (sort) {
                case 'price-asc':
                    sort_by = 'price';
                    sort_order = 'ASC';
                    break;
                case 'price-desc':
                    sort_by = 'price';
                    sort_order = 'DESC';
                    break;
                case 'name-asc':
                    sort_by = 'name';
                    sort_order = 'ASC';
                    break;
                case 'name-desc':
                    sort_by = 'name';
                    sort_order = 'DESC';
                    break;
                case 'newest':
                default:
                    sort_by = 'created_at';
                    sort_order = 'DESC';
                    break;
            }
        }

        // Lấy sản phẩm thuộc danh mục
        let products = [];
        try {
            products = await Product.findAll({
                category_id: category.id,
                limit: 50,
                offset: 0,
                sort_by,
                sort_order
            });
        } catch (err) {
            console.error('Product findAll error:', err);
            products = []; // Trả về mảng rỗng nếu lỗi
        }

        // Nếu là AJAX request, trả về JSON
        if (req.xhr || req.headers.accept?.includes('application/json')) {
            return res.json({ products, category });
        }

        // Render trang danh mục
        res.render('products/category', {
            category,
            products,
            currentSort: sort || 'newest',
            user: req.user || null
        });
    } catch (error) {
        console.error('Category products error:', error);
        res.status(500).render('error', {
            message: 'Lỗi tải sản phẩm theo danh mục: ' + error.message,
            user: req.user || null
        });
    }
};
