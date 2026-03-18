/**
 * Script để kiểm tra và seed data vào database
 * Chạy: node scripts/check-db.js
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkAndSeed() {
    console.log('🔍 Kiểm tra database...\n');

    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'tmdt_ecommerce',
        port: process.env.DB_PORT || 3306,
        multipleStatements: true
    });

    try {
        // Check categories
        const [categories] = await connection.execute('SELECT * FROM categories');
        console.log(`📂 Categories: ${categories.length}`);
        categories.forEach(c => console.log(`   - [${c.id}] ${c.name} (${c.slug})`));

        // Check products
        const [products] = await connection.execute('SELECT id, name, slug, category_id, price FROM products LIMIT 10');
        console.log(`\n🛍️ Products: ${products.length}`);
        products.forEach(p => console.log(`   - [${p.id}] ${p.name} - ${p.price.toLocaleString()}đ`));

        // If no categories, insert them
        if (categories.length === 0) {
            console.log('\n⚠️ Không có categories, đang thêm...');
            await connection.execute(`
                INSERT INTO categories (name, slug, description, image_url, display_order) VALUES
                ('Thời Trang Nam', 'nam', 'Quần áo và phụ kiện nam', 'https://images.unsplash.com/photo-1490114538077-0a7f8cb49891?w=800', 1),
                ('Thời Trang Nữ', 'nu', 'Quần áo và phụ kiện nữ', 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800', 2),
                ('Thời Trang Trẻ Em', 'tre-em', 'Quần áo trẻ em', 'https://images.unsplash.com/photo-1503944583220-79d8926ad5e2?w=800', 3)
            `);
            console.log('✅ Đã thêm categories!');
        }

        // If no products, insert sample products
        if (products.length === 0) {
            console.log('\n⚠️ Không có products, đang thêm sản phẩm mẫu...');
            
            // Get category IDs
            const [cats] = await connection.execute('SELECT id, slug FROM categories');
            const catMap = {};
            cats.forEach(c => catMap[c.slug] = c.id);

            await connection.execute(`
                INSERT INTO products (category_id, name, slug, description, price, stock_quantity, sku, is_featured) VALUES
                (${catMap['nam'] || 1}, 'Áo Polo Classic Nam', 'ao-polo-classic-nam', 'Áo polo nam chất liệu cotton cao cấp', 450000, 100, 'APM001', TRUE),
                (${catMap['nam'] || 1}, 'Áo Thun Basic Nam', 'ao-thun-basic-nam', 'Áo thun nam form rộng thoải mái', 250000, 150, 'ATM002', FALSE),
                (${catMap['nam'] || 1}, 'Quần Jeans Slim Fit', 'quan-jeans-slim-fit', 'Quần jeans nam form slim hiện đại', 680000, 90, 'QJM001', FALSE),
                (${catMap['nu'] || 2}, 'Đầm Maxi Hoa', 'dam-maxi-hoa', 'Đầm maxi họa tiết hoa thanh lịch', 750000, 50, 'DMN001', TRUE),
                (${catMap['nu'] || 2}, 'Áo Sơ Mi Lụa Nữ', 'ao-so-mi-lua-nu', 'Áo sơ mi lụa nữ cao cấp', 520000, 60, 'ASN002', TRUE),
                (${catMap['tre-em'] || 3}, 'Bộ Đồ Bé Trai', 'bo-do-be-trai', 'Bộ đồ cotton mềm mại cho bé trai', 320000, 80, 'BTE001', FALSE),
                (${catMap['tre-em'] || 3}, 'Váy Công Chúa Bé Gái', 'vay-cong-chua-be-gai', 'Váy công chúa xinh xắn cho bé gái', 450000, 40, 'VTE002', TRUE)
            `);
            
            // Add product images
            const [prods] = await connection.execute('SELECT id, slug FROM products');
            for (const prod of prods) {
                let imageUrl = 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600';
                if (prod.slug.includes('polo')) imageUrl = 'https://images.unsplash.com/photo-1586790170083-2f9ceadc732d?w=600';
                else if (prod.slug.includes('dam') || prod.slug.includes('maxi')) imageUrl = 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=600';
                else if (prod.slug.includes('jeans')) imageUrl = 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=600';
                else if (prod.slug.includes('be-trai') || prod.slug.includes('tre-em')) imageUrl = 'https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?w=600';
                else if (prod.slug.includes('cong-chua')) imageUrl = 'https://images.unsplash.com/photo-1518831959646-742c3a14ebf7?w=600';
                else if (prod.slug.includes('lua')) imageUrl = 'https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?w=600';
                
                await connection.execute(
                    'INSERT INTO product_images (product_id, image_url, is_primary, display_order) VALUES (?, ?, TRUE, 0)',
                    [prod.id, imageUrl]
                );
            }
            
            console.log('✅ Đã thêm products và images!');
        }

        console.log('\n✅ Hoàn tất! Refresh lại trang http://localhost:3000 để xem kết quả.');

    } catch (error) {
        console.error('❌ Lỗi:', error.message);
    } finally {
        await connection.end();
    }
}

checkAndSeed();
