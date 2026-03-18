/**
 * Script để seed banners và verify data
 */
const mysql = require('mysql2/promise');
require('dotenv').config();

async function seedData() {
    console.log('🔧 Seed banners và verify data...\n');

    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'tmdt_ecommerce',
        port: process.env.DB_PORT || 3306
    });

    try {
        // Check and add banners
        const [banners] = await connection.execute('SELECT COUNT(*) as count FROM banners');
        console.log('Banners hiện tại:', banners[0].count);
        
        if (banners[0].count === 0) {
            console.log('Đang thêm banners...');
            await connection.execute(`
                INSERT INTO banners (title, subtitle, image_url, link_url, button_text, display_order, is_active) VALUES
                ('SALE Cuối Năm - Giảm tới 50%', 'Mua ngay hôm nay!', 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=1200', '/products', 'Mua ngay', 1, TRUE),
                ('Bộ Sưu Tập Mới', 'Thời trang Xuân Hè 2026', 'https://images.unsplash.com/photo-1558171813-4c088753af8f?w=1200', '/products', 'Khám phá', 2, TRUE)
            `);
            console.log('✅ Đã thêm 2 banners!');
        }

        // Verify categories
        const [categories] = await connection.execute('SELECT id, name, slug, (SELECT COUNT(*) FROM products WHERE category_id = categories.id) as count FROM categories');
        console.log('\n📂 Categories:');
        categories.forEach(c => console.log(`   - [${c.id}] ${c.name} (${c.slug}): ${c.count} products`));

        // Verify products with images
        const [products] = await connection.execute(`
            SELECT p.id, p.name, p.slug, 
                   (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = TRUE LIMIT 1) as primary_image
            FROM products p WHERE p.is_active = TRUE
        `);
        console.log('\n🛍️ Products with images:');
        products.forEach(p => console.log(`   - [${p.id}] ${p.name}: ${p.primary_image ? '✅ Has image' : '❌ No image'}`));

        // Verify banners
        const [allBanners] = await connection.execute('SELECT id, title, is_active FROM banners');
        console.log('\n🖼️ Banners:');
        allBanners.forEach(b => console.log(`   - [${b.id}] ${b.title}: ${b.is_active ? '✅ Active' : '❌ Inactive'}`));

        console.log('\n✅ Seed hoàn tất! Refresh trang http://localhost:3000');

    } catch (error) {
        console.error('❌ Lỗi:', error.message);
    } finally {
        await connection.end();
    }
}

seedData();
