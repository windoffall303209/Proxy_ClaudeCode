/**
 * Script để chạy seed data vào database
 * Chạy: node scripts/run-seed.js
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runSeed() {
    console.log('🌱 Bắt đầu seed database...\n');

    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        port: process.env.DB_PORT || 3306,
        multipleStatements: true
    });

    try {
        // Check if database exists
        console.log('📦 Kiểm tra database...');
        const [databases] = await connection.execute("SHOW DATABASES LIKE 'tmdt_ecommerce'");
        
        if (databases.length === 0) {
            console.log('⚠️ Database tmdt_ecommerce chưa tồn tại. Đang tạo...');
            await connection.execute('CREATE DATABASE IF NOT EXISTS tmdt_ecommerce');
            console.log('✅ Đã tạo database tmdt_ecommerce');
            
            // Run schema
            console.log('\n📋 Đang tạo schema...');
            const schemaPath = path.join(__dirname, '../database/schema.sql');
            const schema = fs.readFileSync(schemaPath, 'utf8');
            await connection.query(schema);
            console.log('✅ Đã tạo schema');
        } else {
            console.log('✅ Database đã tồn tại');
        }

        // Use the database
        await connection.query('USE tmdt_ecommerce');

        // Check if categories table has data
        const [categories] = await connection.execute('SELECT COUNT(*) as count FROM categories');
        
        if (categories[0].count === 0) {
            // Run seed
            console.log('\n🌱 Đang import seed data...');
            const seedPath = path.join(__dirname, '../database/seed.sql');
            const seed = fs.readFileSync(seedPath, 'utf8');
            await connection.query(seed);
            console.log('✅ Đã import seed data thành công!');
        } else {
            console.log(`✅ Database đã có ${categories[0].count} categories, không cần seed lại.`);
        }

        // Display summary
        console.log('\n📊 Tóm tắt database:');
        const [catCount] = await connection.execute('SELECT COUNT(*) as count FROM categories');
        const [prodCount] = await connection.execute('SELECT COUNT(*) as count FROM products');
        const [userCount] = await connection.execute('SELECT COUNT(*) as count FROM users');
        
        console.log(`   - Categories: ${catCount[0].count}`);
        console.log(`   - Products: ${prodCount[0].count}`);
        console.log(`   - Users: ${userCount[0].count}`);
        
        console.log('\n✅ Seed hoàn tất!');
        console.log('🚀 Bạn có thể refresh lại trang http://localhost:3000 để xem sản phẩm.');

    } catch (error) {
        console.error('❌ Lỗi:', error.message);
        
        if (error.message.includes('ER_NO_SUCH_TABLE')) {
            console.log('\n💡 Gợi ý: Có vẻ như tables chưa được tạo. Hãy chạy schema.sql trước:');
            console.log('   mysql -u root -p < database/schema.sql');
            console.log('   mysql -u root -p < database/seed.sql');
        }
    } finally {
        await connection.end();
    }
}

runSeed();
