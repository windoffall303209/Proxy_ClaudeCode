/**
 * Script bổ sung sản phẩm cho đủ 90 mỗi loại
 * Chạy: node scripts/add-more-products.js
 */
const mysql = require('mysql2/promise');
require('dotenv').config();

const moreProductsNu = [
  { name: 'Áo Khoác Cardigan Nữ', price: 520000, desc: 'Áo khoác cardigan nữ tính' },
  { name: 'Áo thun Basic Nữ', price: 220000, desc: 'Áo thun basic nữ' },
  { name: 'Áo thun Oversize Nữ', price: 280000, desc: 'Áo thun oversize nữ' },
  { name: 'Quần Tây Nữ', price: 450000, desc: 'Quần tây công sở nữ' },
  { name: 'Quần Lửng Nữ', price: 320000, desc: 'Quần lửng nữ mùa hè' },
  { name: 'Áo Hai Dây Nữ', price: 180000, desc: 'Áo hai dây nữ' },
  { name: 'Áo thun Polo Nữ', price: 320000, desc: 'Áo thun polo nữ' },
  { name: 'Chân Váy Dài Nữ', price: 380000, desc: 'Chân váy dài nữ' },
  { name: 'Đầm Thun Nữ', price: 350000, desc: 'Đầm thun nữ thoải mái' },
  { name: 'Áo Khoác Dạ Nữ', price: 1200000, desc: 'Áo khoác dạ nữ' },
  { name: 'Áo Khoác Len Nữ', price: 680000, desc: 'Áo khoác len nữ' },
  { name: 'Áo thun Crop Nữ', price: 250000, desc: 'Áo thun crop nữ' },
  { name: 'Quần Ống Rộng Nữ', price: 480000, desc: 'Quần ống rộng nữ' },
  { name: 'Váy Hoa Nữ', price: 420000, desc: 'Váy hoa nữ' },
  { name: 'Áo thun Tay Dài Nữ', price: 320000, desc: 'Áo thun tay dài nữ' },
  { name: 'Đầm Len Nữ', price: 580000, desc: 'Đầm len nữ' },
  { name: 'Chân Váy Ngắn Nữ', price: 280000, desc: 'Chân váy ngắn nữ' },
  { name: 'Áo Khoác Phao Nữ', price: 980000, desc: 'Áo khoác phao nữ' },
  { name: 'Bộ Đồ Mặc Nhà Nữ', price: 320000, desc: 'Bộ đồ mặc nhà nữ' },
  { name: 'Áo thun Form Rông Nữ', price: 280000, desc: 'Áo thun form rộng nữ' },
];

const moreProductsTreEm = [
  { name: 'Bộ Đồ Ngủ Trẻ Em', price: 250000, desc: 'Bộ đồ ngủ trẻ em' },
  { name: 'Áo Gió Trẻ Em', price: 380000, desc: 'Áo gió trẻ em' },
  { name: 'Quần Dài Trẻ Em', price: 220000, desc: 'Quần dài trẻ em' },
  { name: 'Áo Thun Dài Trẻ Em', price: 200000, desc: 'Áo thun dài trẻ em' },
  { name: 'Bộ Đồ Mùa Hè Trẻ Em', price: 280000, desc: 'Bộ đồ mùa hè trẻ em' },
  { name: 'Giày Thể Thao Bé Trai', price: 420000, desc: 'Giày thể thao bé trai' },
  { name: 'Giày Thể Thao Bé Gái', price: 380000, desc: 'Giày thể thao bé gái' },
  { name: 'Dép XăngDan Trẻ Em', price: 180000, desc: 'Dép xăng đan trẻ em' },
  { name: 'Mũ Che Nắng Trẻ Em', price: 120000, desc: ' mũ che nắng trẻ em' },
  { name: 'Ba Lô Trẻ Em Đi Học', price: 280000, desc: 'Ba lô trẻ em đi học' },
  { name: 'Cặp Sách Trẻ Em', price: 320000, desc: 'Cặp sách trẻ em' },
  { name: 'Tất Vớ Trẻ Em 5 Đôi', price: 80000, desc: 'Tất vớ trẻ em 5 đôi' },
  { name: 'Khăn Quàng Cổ Trẻ Em', price: 150000, desc: 'Khăn quàng cổ trẻ em' },
  { name: 'Găng Tay Trẻ Em', price: 120000, desc: 'Găng tay trẻ em' },
  { name: 'Áo Mấm Trẻ Em', price: 180000, desc: 'Áo măm trẻ em' },
  { name: 'Bộ Đồ Bơi Trẻ Em', price: 280000, desc: 'Bộ đồ bơi trẻ em' },
  { name: 'Kính Mát Trẻ Em', price: 150000, desc: 'Kính mát trẻ em' },
  { name: 'Dép Lông Trẻ Em', price: 180000, desc: 'Dép lông trẻ em' },
  { name: 'Giày Boots Trẻ Em', price: 450000, desc: 'Giày boots trẻ em' },
  { name: 'Áo Khoang Trẻ Em', price: 420000, desc: 'Áo khoang trẻ em' },
];

const imagesNu = [
  'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=600',
  'https://images.unsplash.com/photo-1551163923-3e750836cb3e?w=600',
  'https://images.unsplash.com/photo-1550614000-4b9519e03d6c?w=600',
  'https://images.unsplash.com/photo-1542291448-1a5e9c6d4e6f?w=600',
  'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600',
  'https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=600',
];

const imagesTreEm = [
  'https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?w=600',
  'https://images.unsplash.com/photo-1518831959646-742c3a14ebf7?w=600',
  'https://images.unsplash.com/photo-1503918871075-d2e3d89afe35?w=600',
  'https://images.unsplash.com/photo-1512909006721-3d6018887383?w=600',
  'https://images.unsplash.com/photo-1485546788459-0e5f578db3b4?w=600',
  'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600',
];

// Chạy luồng chính của script.
async function main() {
  console.log('🚀 Bổ sung sản phẩm cho đủ 90 mỗi loại...\n');

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'tmdt_ecommerce',
    port: process.env.DB_PORT || 3306
  });

  try {
    // Thêm cho nữ (category_id = 2)
    console.log('\n📦 Đang bổ sung sản phẩm nữ...');
    for (let i = 0; i < moreProductsNu.length; i++) {
      const product = moreProductsNu[i];
      const slug = product.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '-' + Date.now();
      const sku = 'PRD-NU-' + Date.now();

      await connection.execute(
        `INSERT INTO products (category_id, name, slug, description, price, stock_quantity, sku, is_featured, is_active)
         VALUES (2, ?, ?, ?, ?, 100, ?, TRUE, TRUE)`,
        [product.name, slug, product.desc, product.price, sku]
      );

      const [result] = await connection.execute('SELECT LAST_INSERT_ID() as id');
      const productId = result[0].id;

      const numImages = Math.floor(Math.random() * 2) + 5;
      for (let j = 0; j < numImages; j++) {
        await connection.execute(
          `INSERT INTO product_images (product_id, image_url, is_primary, display_order)
           VALUES (?, ?, ?, ?)`,
          [productId, imagesNu[j % imagesNu.length], j === 0 ? 1 : 0, j]
        );
      }
      console.log(`  ✅ ${product.name}`);
    }

    // Thêm cho trẻ em (category_id = 3)
    console.log('\n📦 Đang bổ sung sản phẩm trẻ em...');
    for (let i = 0; i < moreProductsTreEm.length; i++) {
      const product = moreProductsTreEm[i];
      const slug = product.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '-' + Date.now();
      const sku = 'PRD-TE-' + Date.now();

      await connection.execute(
        `INSERT INTO products (category_id, name, slug, description, price, stock_quantity, sku, is_featured, is_active)
         VALUES (3, ?, ?, ?, ?, 100, ?, TRUE, TRUE)`,
        [product.name, slug, product.desc, product.price, sku]
      );

      const [result] = await connection.execute('SELECT LAST_INSERT_ID() as id');
      const productId = result[0].id;

      const numImages = Math.floor(Math.random() * 2) + 5;
      for (let j = 0; j < numImages; j++) {
        await connection.execute(
          `INSERT INTO product_images (product_id, image_url, is_primary, display_order)
           VALUES (?, ?, ?, ?)`,
          [productId, imagesTreEm[j % imagesTreEm.length], j === 0 ? 1 : 0, j]
        );
      }
      console.log(`  ✅ ${product.name}`);
    }

    console.log('\n✅ Hoàn tất!');

  } catch (error) {
    console.error('❌ Lỗi:', error.message);
  } finally {
    await connection.end();
  }
}

main();
