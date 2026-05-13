# WIND OF FALL - Fashion E-commerce

Website thương mại điện tử thời trang xây bằng Node.js, Express, EJS và PostgreSQL.

README này dùng như bản đồ project: mỗi thư mục làm gì, route chính nằm ở đâu, và khi muốn sửa một chức năng thì nên mở file nào trước.

## Công nghệ chính

- Backend: Node.js, Express.js
- View server-side: EJS
- Database: PostgreSQL, `pg`
- Auth: JWT cookie, Express session, Google OAuth
- Upload/media: Multer, Cloudinary, Sharp
- Email: Resend
- Thanh toán: COD, VNPay, MoMo
- AI chat: OpenAI-compatible API hoặc Gemini, RAG text, vision, visual image embedding
- Test: Jest

## Chạy project

Yêu cầu:

- Node.js >= 18
- PostgreSQL >= 14
- npm

Cài dependency:

```bash
npm install
```

Tạo database:

```bash
createdb -U postgres tmdt_ecommerce
psql -U postgres -d tmdt_ecommerce -f database/schema.sql
```

Import dữ liệu mẫu nếu cần:

```bash
psql -U postgres -d tmdt_ecommerce -f database/seed.sql
```

Chạy migration bổ sung theo thứ tự số nếu database chưa có các bảng/cột mới:

```bash
psql -U postgres -d tmdt_ecommerce -f migrations/001_add_image_id_to_variants.sql
psql -U postgres -d tmdt_ecommerce -f migrations/002_add_handling_mode_to_chat_conversations.sql
psql -U postgres -d tmdt_ecommerce -f migrations/003_create_voucher_products.sql
psql -U postgres -d tmdt_ecommerce -f migrations/004_create_review_media.sql
psql -U postgres -d tmdt_ecommerce -f migrations/005_create_order_tracking_tables.sql
psql -U postgres -d tmdt_ecommerce -f migrations/006_snapshot_order_shipping_address.sql
psql -U postgres -d tmdt_ecommerce -f migrations/007_add_rich_media_to_chat_messages.sql
psql -U postgres -d tmdt_ecommerce -f migrations/008_create_chat_rag_tables.sql
psql -U postgres -d tmdt_ecommerce -f migrations/009_create_product_image_embeddings.sql
psql -U postgres -d tmdt_ecommerce -f migrations/010_create_storefront_settings.sql
psql -U postgres -d tmdt_ecommerce -f migrations/011_add_payment_completion_and_returns.sql
psql -U postgres -d tmdt_ecommerce -f migrations/012_add_order_payment_expiry.sql
psql -U postgres -d tmdt_ecommerce -f migrations/013_add_website_management_settings.sql
psql -U postgres -d tmdt_ecommerce -f migrations/014_expand_storefront_settings_management.sql
psql -U postgres -d tmdt_ecommerce -f migrations/015_fix_storefront_settings_vietnamese_accents.sql
psql -U postgres -d tmdt_ecommerce -f migrations/016_add_shipping_fee_setting.sql
```

Tạo `.env`:

```bash
cp .env.example .env
```

Chạy development:

```bash
npm run dev
```

Chạy production:

```bash
npm start
```

App mặc định chạy ở `http://localhost:3000`.

## Script npm

| Lệnh | Mục đích |
| --- | --- |
| `npm run dev` | Chạy bằng `nodemon server.js` |
| `npm start` | Chạy `server.js` |
| `npm test` | Chạy Jest kèm coverage |
| `npm run check:inline-views` | Kiểm tra view không nhúng asset inline sai quy ước |
| `npm run chat:rag:sync` | Đồng bộ dữ liệu RAG cho chatbot |
| `npm run product:visual:sync` | Đồng bộ embedding ảnh sản phẩm cho tìm bằng ảnh |
| `npm run product:category:reconcile` | Rà lại liên kết sản phẩm - danh mục |

## Luồng khởi động

```text
server.js
  -> require app.js
  -> app.js tạo Express app
  -> app.js gắn middleware dùng chung
  -> app.js mount routes/index.js tại "/"
  -> routes/index.js mount từng nhóm route
```

File quan trọng:

- `server.js`: mở HTTP server, graceful shutdown.
- `app.js`: cấu hình Express, Helmet CSP, body parser, session, static file, `res.locals`, 404/error handler.
- `routes/index.js`: route trang chủ, API tỉnh/thành/geocode, và mount các route con.

## Cấu trúc thư mục

```text
TMDT_nodejs/
|-- app.js                         # Tạo Express app và middleware dùng chung
|-- server.js                      # Start/stop HTTP server
|-- package.json                   # Script npm và dependency
|-- .env.example                   # Mẫu biến môi trường
|-- config/                        # Database, Cloudinary, kiến thức RAG
|-- controllers/                   # Điều phối request, gọi model/service, render view
|   |-- admin/                     # Controller admin tách theo module
|   |-- chat/                      # Controller chat customer/admin
|   |-- authController.js
|   |-- cartController.js
|   |-- orderController.js
|   |-- productController.js
|-- models/                        # Query SQL/PostgreSQL và chuẩn hóa dữ liệu
|-- routes/                        # Khai báo URL -> controller
|-- services/                      # Logic ngoài controller: email, payment, AI, import
|-- middleware/                    # Auth, upload, dữ liệu header/storefront
|-- views/                         # EJS templates
|   |-- admin/
|   |-- auth/
|   |-- cart/
|   |-- checkout/
|   |-- home/
|   |-- partials/
|   |-- products/
|   |-- user/
|-- public/                        # CSS, JS, ảnh tĩnh, upload local
|   |-- css/
|   |-- js/
|   |-- images/
|   |-- uploads/
|-- database/                      # schema.sql, seed.sql, dữ liệu SQL phụ
|-- migrations/                    # Migration SQL bổ sung
|-- scripts/                       # Script seed, sync, repair, utility
|-- __tests__/                     # Jest tests
|-- archive/                       # Code cũ/backup, không phải luồng chính
|-- coverage/                      # Output coverage của Jest
|-- output/                        # Output sinh ra khi chạy tool
```

## Route map

| URL prefix | Route file | Controller chính | Ghi chú |
| --- | --- | --- | --- |
| `/` | `routes/index.js` | `controllers/productController.js` | Trang chủ, API tỉnh/thành/geocode |
| `/auth` | `routes/authRoutes.js` | `controllers/authController.js` | Đăng ký, đăng nhập, profile, địa chỉ, verify email, forgot password |
| `/products` | `routes/productRoutes.js` | `controllers/productController.js` | Danh sách, tìm kiếm, danh mục, chi tiết, review |
| `/cart` | `routes/cartRoutes.js` | `controllers/cartController.js` | Giỏ hàng guest/user |
| `/orders` | `routes/orderRoutes.js` | `controllers/orderController.js` | Checkout, mua ngay, thanh toán, lịch sử, tracking, hủy, hoàn hàng |
| `/admin` | `routes/adminRoutes.js` | `controllers/admin/index.js` + `controllers/adminAuthController.js` | Login admin, dashboard, CRUD quản trị |
| `/newsletter` | `routes/newsletterRoutes.js` | `controllers/newsletterController.js` | Đăng ký nhận tin |
| `/chat` | `routes/chatRoutes.js` | `controllers/chat/index.js` | Chat khách hàng và admin chat |

## Muốn sửa gì thì sửa ở đâu

### Header, footer, layout chung

| Muốn sửa | File nên mở |
| --- | --- |
| Header storefront | `views/partials/header.ejs` |
| Footer storefront | `views/partials/footer.ejs` |
| Layout chính | `views/layouts/main.ejs` |
| Header admin/sidebar admin | `views/partials/admin-header.ejs` |
| Footer admin | `views/partials/admin-footer.ejs` |
| CSS global storefront | `public/css/style.css` |
| CSS shell admin | `public/css/admin/core/*.css` |
| JS shell admin | `public/js/admin/admin-shell.js` |
| Danh mục hiện trên header | `middleware/headerCategories.js`, `models/Category.js` |
| Cấu hình storefront dùng toàn site | `middleware/storefrontSettings.js`, `models/StorefrontSetting.js` |

### Trang chủ và storefront

| Muốn sửa | File nên mở |
| --- | --- |
| Nội dung trang chủ | `views/home/index.ejs` |
| Logic lấy dữ liệu trang chủ | `controllers/productController.js` |
| JS trang chủ | `public/js/home.js` |
| CSS trang chủ | `public/css/home.css` |
| Banner trang chủ | `models/Banner.js`, `controllers/admin/bannerController.js`, `views/admin/banners.ejs` |
| Số cột sản phẩm/số danh mục hiển thị | `views/admin/storefront.ejs`, `controllers/admin/storefrontController.js`, `models/StorefrontSetting.js` |

### Sản phẩm, danh mục, tìm kiếm, review

| Muốn sửa | File nên mở |
| --- | --- |
| Danh sách sản phẩm | `views/products/list.ejs`, `controllers/productController.js` |
| Trang danh mục | `views/products/category.ejs`, `routes/productRoutes.js` |
| Kết quả tìm kiếm | `views/products/search-results.ejs`, `public/js/search-suggest.js` |
| Chi tiết sản phẩm | `views/products/detail.ejs`, `public/js/product-detail.js`, `public/css/product-detail.css` |
| Card sản phẩm dùng lại | `views/partials/product-card.ejs` |
| Toolbar/sidebar catalog | `views/partials/catalog-toolbar.ejs`, `views/partials/catalog-sidebar.ejs`, `public/js/catalog-controls.js` |
| Query sản phẩm/danh mục/variant/review | `models/Product.js`, `models/Category.js` |
| Gợi ý sản phẩm | `services/productSuggestService.js`, `views/products/for-you.ejs` |
| Review có media | `middleware/reviewUpload.js`, `routes/productRoutes.js`, `controllers/productController.js` |

### Admin sản phẩm, danh mục, sale, voucher, banner

| Muốn sửa | File nên mở |
| --- | --- |
| Route admin | `routes/adminRoutes.js` |
| Controller admin tổng hợp | `controllers/admin/index.js` |
| Logic cũ còn dùng chung | `controllers/admin/legacy.js` |
| Quản lý sản phẩm admin | `controllers/admin/productController.js`, `views/admin/products.ejs`, `public/js/admin/products.js`, `public/css/admin/products.css` |
| Biến thể sản phẩm admin | `services/adminProductVariantService.js`, `models/Product.js` |
| Import/export sản phẩm | `services/productBulkImportService.js`, `middleware/productImportUpload.js` |
| Quản lý danh mục admin | `controllers/admin/categoryController.js`, `views/admin/categories.ejs`, `public/js/admin/categories.js` |
| Import/export danh mục | `services/categoryBulkImportService.js` |
| Quản lý sale | `models/Sale.js`, `views/admin/sales.ejs`, `public/js/admin/sales.js` |
| Quản lý voucher | `models/Voucher.js`, `views/admin/vouchers.ejs`, `public/js/admin/vouchers.js` |
| Quản lý banner | `models/Banner.js`, `views/admin/banners.ejs`, `public/js/admin/banners.js` |

### Giỏ hàng

| Muốn sửa | File nên mở |
| --- | --- |
| Route giỏ hàng | `routes/cartRoutes.js` |
| Logic thêm/sửa/xóa giỏ | `controllers/cartController.js` |
| Query giỏ hàng | `models/Cart.js` |
| Giao diện giỏ hàng | `views/cart/index.ejs` |
| JS giỏ hàng | `public/js/cart.js` |
| CSS giỏ hàng | `public/css/cart.css` |

### Checkout, đơn hàng, thanh toán, vận chuyển

| Muốn sửa | File nên mở |
| --- | --- |
| Route checkout/order | `routes/orderRoutes.js` |
| Logic tạo đơn, thanh toán, hủy, nhận hàng, hoàn hàng | `controllers/orderController.js` |
| Query/trạng thái đơn hàng | `models/Order.js` |
| Payment record | `models/Payment.js` |
| Tích hợp VNPay/MoMo | `services/paymentService.js` |
| Checkout từ giỏ hàng | `views/checkout/index.ejs`, `public/js/checkout.js` |
| Mua ngay | `views/checkout/buy-now.ejs`, `public/js/buy-now.js` |
| Trang xác nhận sau đặt hàng | `views/checkout/confirmation.ejs` |
| Lịch sử đơn hàng user | `views/user/orders.ejs`, `public/css/orders.css` |
| Theo dõi đơn hàng | `views/user/order-tracking.ejs`, `public/css/tracking.css` |
| Nút hủy/xác nhận nhận hàng | `public/js/order-actions.js` |
| Auto hoàn thành sau khi giao quá N ngày | `models/Order.js`, hàm `autoCompleteDeliveredOrders()` |

Ghi chú: thời gian tự động chuyển `delivered` sang `completed` đang nằm trong `models/Order.js` tại 2 câu SQL `INTERVAL '7 DAY'`. Nếu đổi số ngày, đổi cả nội dung tracking event gần đó để text hiển thị đúng.

### Đổi trả/hoàn hàng

| Muốn sửa | File nên mở |
| --- | --- |
| Form yêu cầu đổi trả của user | `views/user/return-request.ejs` |
| JS form đổi trả | `public/js/return-request.js` |
| Upload ảnh/video đổi trả | `middleware/returnUpload.js` |
| Logic tạo yêu cầu đổi trả | `controllers/orderController.js` |
| Model yêu cầu đổi trả | `models/ReturnRequest.js` |
| Admin duyệt đổi trả | `controllers/admin/returnController.js`, `views/admin/returns.ejs`, `views/admin/return-detail.ejs`, `public/js/admin/returns.js` |

### Auth, user, địa chỉ, admin login

| Muốn sửa | File nên mở |
| --- | --- |
| Route auth user | `routes/authRoutes.js` |
| Logic login/register/profile/verify/forgot password | `controllers/authController.js` |
| Login admin | `controllers/adminAuthController.js`, `views/admin/login.ejs` |
| Middleware JWT và phân quyền admin | `middleware/auth.js` |
| Model user | `models/User.js` |
| Model địa chỉ | `models/Address.js` |
| Trang login/register | `views/auth/login.ejs`, `views/auth/register.ejs` |
| JS login/register | `public/js/login.js`, `public/js/register.js` |
| Profile user | `views/user/profile.ejs`, `public/js/user-profile.js`, `public/css/user-profile.css` |
| Verify email | `views/auth/verify-email.ejs`, `public/js/verify-email.js` |
| Forgot password | `views/auth/forgot-password.ejs`, `public/js/auth/forgot-password.js` |

### Chat AI, RAG, tìm sản phẩm bằng ảnh

| Muốn sửa | File nên mở |
| --- | --- |
| Route chat | `routes/chatRoutes.js` |
| Controller chat entry | `controllers/chat/index.js` |
| Chat khách hàng/admin logic chính | `controllers/chat/legacy.js` |
| Trang chat admin | `views/admin/chat.ejs`, `public/js/admin/chat.js`, `public/css/admin/chat.css` |
| Widget chat storefront | `views/partials/chat-widget.ejs`, `public/js/chat-widget.js`, `public/css/chat-widget.css` |
| Render tin nhắn giàu/card sản phẩm | `public/js/chat-rich-message.js`, `public/css/chat-rich-message.css` |
| Model conversation/message | `models/Chat.js` |
| RAG text sản phẩm/knowledge | `services/chatRagService.js`, `models/ChatRag.js`, `config/chatRagKnowledge.js` |
| Embedding text | `services/chatEmbeddingService.js` |
| Vision mô tả ảnh | `services/chatVisionService.js` |
| Tìm sản phẩm tương tự bằng ảnh | `services/productVisualEmbeddingService.js`, `models/ProductImageEmbedding.js` |
| Đồng bộ RAG | `scripts/sync-chat-rag.js` hoặc `npm run chat:rag:sync` |
| Đồng bộ embedding ảnh | `scripts/sync-product-image-embeddings.js` hoặc `npm run product:visual:sync` |

### Email, newsletter, marketing

| Muốn sửa | File nên mở |
| --- | --- |
| Gửi email hệ thống | `services/emailService.js` |
| Newsletter public | `routes/newsletterRoutes.js`, `controllers/newsletterController.js`, `models/Newsletter.js` |
| Email marketing admin | `controllers/admin/marketingController.js`, route `/admin/email/send` |
| Email sale/voucher | `controllers/admin/legacy.js`, `services/emailService.js` |

Hiện code email dùng Resend. Các biến SMTP/Gmail cũ nếu còn trong môi trường thì không phải luồng chính.

### Upload, media, Cloudinary

| Muốn sửa | File nên mở |
| --- | --- |
| Cấu hình Cloudinary | `config/cloudinary.js` |
| Upload chung admin/product/category/banner | `middleware/upload.js` |
| Upload chat | `middleware/chatUpload.js` |
| Upload review | `middleware/reviewUpload.js` |
| Upload đổi trả | `middleware/returnUpload.js` |
| Upload file import sản phẩm/danh mục | `middleware/productImportUpload.js` |
| Giới hạn file | `.env`, biến `MAX_FILE_SIZE`, `MAX_CHAT_FILE_SIZE` |

### Database, seed, migration

| Muốn sửa | File nên mở |
| --- | --- |
| Kết nối PostgreSQL | `config/database.js` |
| Schema gốc | `database/schema.sql` |
| Dữ liệu mẫu | `database/seed.sql` |
| Seed sản phẩm số lượng lớn | `database/reseed_products_20_each.sql`, `scripts/seed-all.js`, `scripts/run-seed.js` |
| Thay đổi schema mới | tạo file mới trong `migrations/` theo số tiếp theo |
| Sửa dữ liệu tracking cũ | `scripts/repair-tracking-text.js` |
| Kiểm tra DB nhanh | `scripts/check-db.js` |

### Frontend asset theo trang

| Trang/tính năng | View | JS | CSS |
| --- | --- | --- | --- |
| Home | `views/home/index.ejs` | `public/js/home.js` | `public/css/home.css` |
| Product list/search/category | `views/products/*.ejs` | `public/js/product-list.js`, `public/js/catalog-controls.js`, `public/js/search-suggest.js` | `public/css/product-list.css` |
| Product detail | `views/products/detail.ejs` | `public/js/product-detail.js` | `public/css/product-detail.css` |
| Cart | `views/cart/index.ejs` | `public/js/cart.js` | `public/css/cart.css` |
| Checkout | `views/checkout/index.ejs` | `public/js/checkout.js` | `public/css/checkout.css` |
| Buy now | `views/checkout/buy-now.ejs` | `public/js/buy-now.js` | `public/css/checkout.css` |
| User orders | `views/user/orders.ejs` | `public/js/order-actions.js` | `public/css/orders.css` |
| Tracking | `views/user/order-tracking.ejs` | `public/js/order-actions.js` | `public/css/tracking.css` |
| Return request | `views/user/return-request.ejs` | `public/js/return-request.js` | `public/css/orders.css` |
| Chat widget | `views/partials/chat-widget.ejs` | `public/js/chat-widget.js`, `public/js/chat-rich-message.js` | `public/css/chat-widget.css`, `public/css/chat-rich-message.css` |
| Admin pages | `views/admin/*.ejs` | `public/js/admin/*.js` | `public/css/admin/*.css`, `public/css/admin/core/*.css` |

## Model map

| Model | Dữ liệu phụ trách |
| --- | --- |
| `User.js` | User, admin/user status, auth helpers |
| `Address.js` | Địa chỉ giao hàng |
| `Product.js` | Sản phẩm, ảnh, biến thể, review, listing |
| `Category.js` | Danh mục |
| `Cart.js` | Giỏ hàng |
| `Order.js` | Đơn hàng, trạng thái, tracking, auto complete |
| `Payment.js` | Bản ghi thanh toán |
| `ReturnRequest.js` | Yêu cầu đổi trả |
| `Voucher.js` | Mã giảm giá |
| `Sale.js` | Chương trình giảm giá |
| `Banner.js` | Banner storefront |
| `StorefrontSetting.js` | Cấu hình hiển thị storefront |
| `Chat.js` | Conversation/message chat |
| `ChatRag.js` | Chunk RAG và trạng thái sync |
| `ProductImageEmbedding.js` | Embedding ảnh sản phẩm |
| `Newsletter.js` | Email đăng ký nhận tin |

## Biến môi trường quan trọng

Nhóm server/database:

```env
PORT=3000
NODE_ENV=development
BASE_URL=http://localhost:3000
DB_HOST=localhost
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=tmdt_ecommerce
DB_PORT=5432
```

Nhóm auth/session:

```env
JWT_SECRET=your_secret
JWT_EXPIRE=24h
SESSION_SECRET=your_session_secret
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
```

Nhóm email/upload:

```env
RESEND_API_KEY=re_xxxxxxxxxxxxx
RESEND_FROM=Your Store <onboarding@resend.dev>
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
MAX_FILE_SIZE=5242880
MAX_CHAT_FILE_SIZE=31457280
```

Nhóm payment:

```env
VNPAY_TMN_CODE=your_vnpay_tmn_code
VNPAY_HASH_SECRET=your_vnpay_hash_secret
VNPAY_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
VNPAY_RETURN_URL=http://localhost:3000/orders/payment/vnpay/callback
MOMO_PARTNER_CODE=your_momo_partner_code
MOMO_ACCESS_KEY=your_momo_access_key
MOMO_SECRET_KEY=your_momo_secret_key
MOMO_ENDPOINT=https://test-payment.momo.vn/v2/gateway/api/create
MOMO_RETURN_URL=http://localhost:3000/orders/payment/momo/callback
MOMO_NOTIFY_URL=http://localhost:3000/orders/payment/momo/callback
```

Nhóm AI:

```env
AI_PROVIDER=openai
OPENAI_API_KEY=your_openai_compatible_key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
OPENAI_VISION_MODEL=gpt-4o-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
# GEMINI_API_KEY=your_gemini_api_key
# GEMINI_MODEL=gemini-2.0-flash
PRODUCT_VISUAL_EMBED_MODEL=nvidia/nvclip
```

Nếu dùng NVIDIA NIM tại `https://integrate.api.nvidia.com/v1`, nên tách rõ:

- `OPENAI_MODEL=meta/llama-3.3-70b-instruct`
- `OPENAI_VISION_MODEL=meta/llama-3.2-90b-vision-instruct`
- `OPENAI_EMBEDDING_MODEL=nvidia/nv-embedqa-e5-v5`
- `PRODUCT_VISUAL_EMBED_MODEL=nvidia/nvclip`

## Quy ước sửa code

1. Muốn thêm URL mới: sửa file trong `routes/`, trỏ tới function trong `controllers/`.
2. Muốn đổi dữ liệu lấy từ DB: sửa `models/` trước, sau đó controller gọi model.
3. Muốn đổi giao diện server-render: sửa `views/`.
4. Muốn đổi tương tác phía trình duyệt: sửa `public/js/`.
5. Muốn đổi style: sửa `public/css/`.
6. Muốn đổi upload/auth/session/header data: sửa `middleware/`.
7. Muốn thêm bảng/cột: thêm migration trong `migrations/`, không sửa production DB trực tiếp bằng tay.
8. Muốn đổi logic tích hợp ngoài như email, payment, AI: sửa `services/`.

## Test và kiểm tra nhanh

Chạy toàn bộ test:

```bash
npm test
```

Chạy kiểm tra asset inline:

```bash
npm run check:inline-views
```

Kiểm tra DB:

```bash
node scripts/check-db.js
```

Sau khi sửa tính năng lớn, nên kiểm tra thủ công các luồng:

1. Đăng ký, đăng nhập, xác thực email.
2. Xem sản phẩm, tìm kiếm, lọc danh mục, chi tiết sản phẩm.
3. Thêm giỏ, checkout, thanh toán COD/online.
4. Lịch sử đơn, tracking, hủy đơn, xác nhận nhận hàng.
5. Yêu cầu đổi trả và admin duyệt đổi trả.
6. Admin CRUD sản phẩm/danh mục/banner/sale/voucher.
7. Chat AI nếu thay đổi prompt, RAG hoặc media.

## Ghi chú kỹ thuật

- `app.js` không tự mở port, giúp Jest có thể import app mà không side effect.
- `server.js` chịu trách nhiệm start server và graceful shutdown.
- `controllers/admin/index.js` gom nhiều controller admin; một phần logic cũ vẫn ở `controllers/admin/legacy.js`.
- `controllers/chat/index.js` gom chat customer/admin; luồng chat chính hiện nằm nhiều trong `controllers/chat/legacy.js`.
- `archive/` là code backup/cũ, không phải luồng chạy chính.
- `coverage/`, `output/`, `node_modules/` là output/phụ thuộc, không sửa tay cho logic app.

## License

ISC
