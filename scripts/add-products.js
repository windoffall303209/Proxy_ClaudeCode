/**
 * Script để thêm 90 sản phẩm mới (30 nam, 30 nữ, 30 trẻ em)
 * Mỗi sản phẩm có 5-6 ảnh từ Unsplash (miễn phí)
 * Chạy: node scripts/add-products.js
 */
const pool = require('../config/database');
require('dotenv').config();

const productsData = {
  nam: [
    { name: 'Áo Polo Classic Nam', price: 450000, desc: 'Áo polo nam cotton cao cấp' },
    { name: 'Áo Polo Sport Nam', price: 480000, desc: 'Áo polo thể thao co giãn' },
    { name: 'Áo Polo Premium Nam', price: 550000, desc: 'Áo polo cao cấp sợi tre' },
    { name: 'Áo Thun Basic Nam', price: 250000, desc: 'Áo thun nam form rộng' },
    { name: 'Áo Thun Round Nam', price: 280000, desc: 'Áo thun cổ tròn cơ bản' },
    { name: 'Áo Thun V-Neck Nam', price: 280000, desc: 'Áo thun cổ chữ V' },
    { name: 'Áo Thun Oversize Nam', price: 290000, desc: 'Áo thun oversize streetwear' },
    { name: 'Áo Thun Printed Nam', price: 320000, desc: 'Áo thun in hình thời trang' },
    { name: 'Quần Jeans Slim Nam', price: 680000, desc: 'Quần jeans form slim' },
    { name: 'Quần Jeans Regular', price: 650000, desc: 'Quần jeans form regular' },
    { name: 'Quần Jeans Skinny', price: 620000, desc: 'Quần jeans skinny' },
    { name: 'Quần Jeans Rách Nam', price: 750000, desc: 'Quần jeans rách phong cách' },
    { name: 'Áo Sơ Mi Oxford', price: 520000, desc: 'Áo sơ mi Oxford cao cấp' },
    { name: 'Áo Sơ Mi Linen', price: 480000, desc: 'Áo sơ mi linen mát mẻ' },
    { name: 'Áo Sơ Mi Flannel', price: 550000, desc: 'Áo sơ mi flannel ấm áp' },
    { name: 'Áo Sơ Mi Họa Tiết', price: 520000, desc: 'Áo sơ mi họa tiết trẻ trung' },
    { name: 'Quần Kaki Slim', price: 380000, desc: 'Quần kaki form slim' },
    { name: 'Quần Kaki Regular', price: 360000, desc: 'Quần kaki form regular' },
    { name: 'Quần Shorts Kaki', price: 320000, desc: 'Quần shorts kaki năng động' },
    { name: 'Áo Khoác Bomber', price: 890000, desc: 'Áo khoác bomber trẻ trung' },
    { name: 'Áo Khoác Denim', price: 950000, desc: 'Áo khoác denim bụi bặm' },
    { name: 'Áo Khoác Hoodie', price: 750000, desc: 'Áo khoác hoodie ấm áp' },
    { name: 'Áo Khoác Zipper', price: 680000, desc: 'Áo khoác khóa kéo' },
    { name: 'Áo Khoác Blazer', price: 1200000, desc: 'Áo khoác blazer thanh lịch' },
    { name: 'Quần Jogger Nam', price: 380000, desc: 'Quần jogger thể thao' },
    { name: 'Quần Shorts Thể Thao', price: 320000, desc: 'Quần shorts thể thao' },
    { name: 'Áo Len Cổ Tròn', price: 520000, desc: 'Áo len cổ tròn' },
    { name: 'Áo Len Cardigan', price: 580000, desc: 'Áo len cardigan' },
    { name: 'Áo Tank Top Nam', price: 180000, desc: 'Áo tank top thể thao' },
    { name: 'Áo Henley Nam', price: 320000, desc: 'Áo Henley casual' },
  ],
  nu: [
    { name: 'Đầm Maxi Hoa', price: 750000, desc: 'Đầm maxi họa tiết hoa' },
    { name: 'Đầm Maxi Trơn', price: 680000, desc: 'Đầm maxi thanh lịch' },
    { name: 'Đầm Midi Xòe', price: 580000, desc: 'Đầm midi xòe trẻ trung' },
    { name: 'Đầm Dáng Suông', price: 520000, desc: 'Đầm dáng suông thoải mái' },
    { name: 'Váy Công Sở', price: 420000, desc: 'Váy công sở thanh lịch' },
    { name: 'Váy Chữ A', price: 380000, desc: 'Váy chữ A trẻ trung' },
    { name: 'Váy Babydoll', price: 420000, desc: 'Váy babydoll dễ thương' },
    { name: 'Chân Váy Xếp Ly', price: 320000, desc: 'Chân váy xếp ly thời trang' },
    { name: 'Chân Váy Jean', price: 380000, desc: 'Chân váy jean năng động' },
    { name: 'Áo Sơ Mi Lụa', price: 520000, desc: 'Áo sơ mi lụa cao cấp' },
    { name: 'Áo Sơ Mi Trắng', price: 450000, desc: 'Áo sơ mi trắng thanh lịch' },
    { name: 'Áo Sơ Mi Họa Tiết', price: 480000, desc: 'Áo sơ mi họa tiết nữ tính' },
    { name: 'Áo Kiểu Công Sở', price: 350000, desc: 'Áo kiểu công sở' },
    { name: 'Áo Croptop', price: 280000, desc: 'Áo croptop trẻ trung' },
    { name: 'Áo Babydoll', price: 320000, desc: 'Áo babydoll dễ thương' },
    { name: 'Áo Cardigan Len', price: 490000, desc: 'Áo cardigan len mỏng' },
    { name: 'Quần Jean Skinny', price: 580000, desc: 'Quần jean skinny tôn dáng' },
    { name: 'Quần Jean Ống Rộng', price: 620000, desc: 'Quần jean ống rộng' },
    { name: 'Quần Jean Cạp Cao', price: 550000, desc: 'Quần jean cạp cao' },
    { name: 'Quần Baggy', price: 550000, desc: 'Quần baggy jeans' },
    { name: 'Quần Shorts Jean', price: 380000, desc: 'Quần shorts jean' },
    { name: 'Áo Khoác Blazer Nữ', price: 980000, desc: 'Áo khoác blazer nữ' },
    { name: 'Áo Khoác Denim Nữ', price: 850000, desc: 'Áo khoác denim nữ' },
    { name: 'Áo Khoác Hoodie Nữ', price: 680000, desc: 'Áo khoác hoodie nữ' },
    { name: 'Đầm Dự Tiệc', price: 1100000, desc: 'Đầm dự tiệc sang trọng' },
    { name: 'Đầm Dạ Hội', price: 1500000, desc: 'Đầm dạ hội lộng lẫy' },
    { name: 'Áo Len Cổ Tim', price: 480000, desc: 'Áo len cổ tim' },
    { name: 'Áo Len Oversize', price: 520000, desc: 'Áo len oversize' },
    { name: 'Jumpsuit Nữ', price: 680000, desc: 'Jumpsuit thời trang' },
    { name: 'Áo Yếm Nữ', price: 420000, desc: 'Áo yếm trẻ trung' },
  ],
  'tre-em': [
    { name: 'Bộ Đồ Bé Trai', price: 320000, desc: 'Bộ đồ cotton bé trai' },
    { name: 'Bộ Đồ Bé Gái', price: 350000, desc: 'Bộ đồ cotton bé gái' },
    { name: 'Váy Công Chúa', price: 450000, desc: 'Váy công chúa xinh xắn' },
    { name: 'Váy Babydoll Bé Gái', price: 380000, desc: 'Váy babydoll' },
    { name: 'Áo Thun Trẻ Em', price: 180000, desc: 'Áo thun trẻ em' },
    { name: 'Áo Polo Trẻ Em', price: 220000, desc: 'Áo polo trẻ em' },
    { name: 'Quần Short Bé Trai', price: 220000, desc: 'Quần short bé trai' },
    { name: 'Quần Short Bé Gái', price: 200000, desc: 'Quần short bé gái' },
    { name: 'Bộ Thể Thao Bé Trai', price: 320000, desc: 'Bộ thể thao bé trai' },
    { name: 'Bộ Thể Thao Bé Gái', price: 320000, desc: 'Bộ thể thao bé gái' },
    { name: 'Váy Đầm Bé Gái Hoa', price: 280000, desc: 'Váy đầm hoa bé gái' },
    { name: 'Đầm Yếm Bé Gái', price: 320000, desc: 'Đầm yếm bé gái' },
    { name: 'Áo Khoác Bé Trai', price: 380000, desc: 'Áo khoác bé trai' },
    { name: 'Áo Khoác Bé Gái', price: 380000, desc: 'Áo khoác bé gái' },
    { name: 'Quần Jeans Bé Trai', price: 320000, desc: 'Quần jeans bé trai' },
    { name: 'Quần Jeans Bé Gái', price: 320000, desc: 'Quần jeans bé gái' },
    { name: 'Áo Hoodie Trẻ Em', price: 350000, desc: 'Áo hoodie trẻ em' },
    { name: 'Bộ Pijama Trẻ Em', price: 280000, desc: 'Bộ pijama trẻ em' },
    { name: 'Giày Thể Thao Trẻ Em', price: 420000, desc: 'Giày thể thao trẻ em' },
    { name: 'Mũ Trẻ Em', price: 120000, desc: 'Mũ trẻ em' },
    { name: 'Balo Trẻ Em', price: 280000, desc: 'Balo trẻ em đi học' },
    { name: 'Tất Trẻ Em', price: 80000, desc: 'Tất trẻ em 5 đôi' },
    { name: 'Khăn Quàng Trẻ Em', price: 150000, desc: 'Khăn quàng trẻ em' },
    { name: 'Găng Tay Trẻ Em', price: 120000, desc: 'Găng tay trẻ em' },
    { name: 'Áo Mưa Trẻ Em', price: 180000, desc: 'Áo mưa trẻ em' },
    { name: 'Dép Trẻ Em', price: 150000, desc: 'Dép trẻ em' },
    { name: 'Giày Thể Thao Bé Trai', price: 420000, desc: 'Giày thể thao bé trai' },
    { name: 'Giày Baby Girl', price: 380000, desc: 'Giày baby girl' },
    { name: 'Nón Trẻ Em', price: 100000, desc: 'Nón trẻ em' },
    { name: 'Khăn Tay Trẻ Em', price: 50000, desc: 'Khăn tay trẻ em 5 chiếc' },
  ]
};

// Ảnh Unsplash cho từng danh mục
const imagesByCategory = {
  nam: [
    'https://images.unsplash.com/photo-1586790170083-2f9ceadc732d?w=600',
    'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600',
    'https://images.unsplash.com/photo-1503944583220-79d8926ad5e2?w=600',
    'https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=600',
    'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600',
    'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=600',
  ],
  nu: [
    'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=600',
    'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600',
    'https://images.unsplash.com/photo-1594633313593-bab3825d0caf?w=600',
    'https://images.unsplash.com/photo-1485230895905-ec40ba36b9bc?w=600',
    'https://images.unsplash.com/photo-1518622358385-8ea7d0794bf6?w=600',
    'https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?w=600',
  ],
  'tre-em': [
    'https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?w=600',
    'https://images.unsplash.com/photo-1518831959646-742c3a14ebf7?w=600',
    'https://images.unsplash.com/photo-1503918871075-d2e3d89afe35?w=600',
    'https://images.unsplash.com/photo-1512909006721-3d6018887383?w=600',
    'https://images.unsplash.com/photo-1485546788459-0e5f578db3b4?w=600',
    'https://images.unsplash.com/photo-1503918871075-d2e3d89afe35?w=600',
  ]
};

// Chạy luồng chính của script.
async function main() {
  console.log('🚀 Bắt đầu thêm 90 sản phẩm mới...\n');

  const connection = pool;

  try {
    const categoryMap = { nam: 1, nu: 2, 'tre-em': 3 };
    let totalAdded = 0;

    for (const [category, products] of Object.entries(productsData)) {
      console.log(`\n📦 Đang thêm sản phẩm cho [${category}]...`);
      const categoryId = categoryMap[category];
      const images = imagesByCategory[category];

      for (let i = 0; i < products.length; i++) {
        const product = products[i];
        const sku = `PRD-${category.substring(0,3).toUpperCase()}-${(i+1).toString().padStart(3,'0')}`;
        const slug = product.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

        // Insert product
        const [result] = await connection.execute(
          `INSERT INTO products (category_id, name, slug, description, price, stock_quantity, sku, is_featured, is_active)
           VALUES (?, ?, ?, ?, ?, 100, ?, TRUE, TRUE)
           RETURNING id`,
          [categoryId, product.name, slug, product.desc, product.price, sku]
        );

        const productId = result.insertId;

        // Insert 5-6 images
        const numImages = Math.floor(Math.random() * 2) + 5; // 5-6 images
        for (let j = 0; j < numImages; j++) {
          const imageUrl = images[j % images.length];
          await connection.execute(
            `INSERT INTO product_images (product_id, image_url, is_primary, display_order)
             VALUES (?, ?, ?, ?)`,
            [productId, imageUrl, j === 0, j]
          );
        }

        totalAdded++;
        console.log(`  ✅ ${product.name} (ID: ${productId}) - Ảnh: ${numImages}`);
      }
    }

    console.log(`\n✅ Đã thêm ${totalAdded} sản phẩm mới!`);

  } catch (error) {
    console.error('❌ Lỗi:', error.message);
  } finally {
    await connection.end();
  }
}

main();
