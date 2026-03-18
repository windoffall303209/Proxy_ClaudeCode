# WIND OF FALL - Fashion E-commerce

Website thương mại điện tử thời trang xây bằng Node.js, Express, EJS và MySQL.

## Tổng quan

Project hiện chạy theo mô hình MVC server-side:
- `app.js`: khởi tạo Express app và middleware.
- `server.js`: start/stop HTTP server, graceful shutdown.
- `routes/`: chia route theo tính năng.
- `controllers/`: điều phối request và business logic cấp ứng dụng.
- `models/`: truy cập MySQL bằng `mysql2/promise`.
- `views/` + `public/`: giao diện EJS và JavaScript/CSS phía client.

## Tính năng chính

### Người dùng
- Đăng ký, đăng nhập, đăng xuất bằng JWT cookie.
- Hồ sơ người dùng, đổi mật khẩu, avatar, địa chỉ giao hàng.
- Xác thực email bằng mã 6 số.
- Quên mật khẩu bằng mã xác nhận qua email.
- Trang chủ, danh mục, tìm kiếm, chi tiết sản phẩm.
- Giỏ hàng cho khách vãng lai và người dùng đăng nhập.
- Checkout, voucher, lịch sử đơn hàng.
- Chat hỗ trợ có AI provider cấu hình qua `.env`.

### Admin
- Dashboard thống kê.
- Quản lý sản phẩm, ảnh sản phẩm, biến thể, banner, sale, voucher.
- Quản lý đơn hàng và người dùng.
- Quản lý chat và gửi email marketing.

## Yêu cầu

- Node.js >= 18.x
- MySQL >= 5.7
- npm

Lý do yêu cầu Node 18+: code server đang dùng `fetch()` native trong route proxy/geocode và chat AI.

## Cài đặt

### 1. Cài dependency

```bash
npm install
```

### 2. Tạo database

```bash
mysql -u root -p < database/schema.sql
```

### 3. Import dữ liệu mẫu (tùy chọn)

```bash
mysql -u root -p tmdt_ecommerce < database/seed.sql
```

### 4. Chạy migration bổ sung (nếu cần)

```bash
mysql -u root -p tmdt_ecommerce < migrations/001_add_image_id_to_variants.sql
```

Migration này chỉ thêm cột `image_id` cho bảng `product_variants`. Ứng dụng hiện tại chưa expose UI/API đầy đủ để quản lý ảnh theo variant.

### 5. Tạo file môi trường

```bash
cp .env.example .env
```

Cập nhật các biến trong `.env` theo hạ tầng của bạn.

### 6. Chạy ứng dụng

Development:

```bash
npm run dev
```

Production:

```bash
npm start
```

App mặc định chạy tại [http://localhost:3000](http://localhost:3000).

## Test

```bash
npm test
```

Repo hiện có smoke test cho startup flow để đảm bảo:
- Import app không tự động mở port.
- `server.js` có thể start/stop sạch.
- Jest không bị fail vì thiếu test như trước.

## Biến môi trường đang được code sử dụng

```env
# Server
PORT=3000
NODE_ENV=development
BASE_URL=http://localhost:3000

# Database
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=tmdt_ecommerce
DB_PORT=3306

# JWT + Session
JWT_SECRET=your_secret
JWT_EXPIRE=24h
SESSION_SECRET=your_session_secret

# Email (Resend only)
RESEND_API_KEY=re_xxxxxxxxxxxxx
RESEND_FROM=Your Store <onboarding@resend.dev>

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
MAX_FILE_SIZE=5242880

# VNPay
VNPAY_TMN_CODE=your_vnpay_tmn_code
VNPAY_HASH_SECRET=your_vnpay_hash_secret
VNPAY_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
VNPAY_RETURN_URL=http://localhost:3000/orders/payment/vnpay/callback

# MoMo
MOMO_PARTNER_CODE=your_momo_partner_code
MOMO_ACCESS_KEY=your_momo_access_key
MOMO_SECRET_KEY=your_momo_secret_key
MOMO_ENDPOINT=https://test-payment.momo.vn/v2/gateway/api/create
MOMO_RETURN_URL=http://localhost:3000/orders/payment/momo/callback
MOMO_NOTIFY_URL=http://localhost:3000/orders/payment/momo/callback

# AI chat
OPENAI_API_KEY=your_openai_compatible_key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
AI_PROVIDER=openai
# GEMINI_API_KEY=your_gemini_api_key
# GEMINI_MODEL=gemini-2.0-flash
```

## Ghi chú quan trọng

### Email
Code hiện tại chỉ dùng Resend trong `services/emailService.js`.
Các biến Gmail cũ như `EMAIL_USER`, `MAIL_USER`, `MAIL_PASS`, `USE_RESEND` không còn được code đọc nữa.

### Graceful shutdown
`server.js` hiện đã được tách khỏi `app.js`, lưu lại server instance đúng cách và hỗ trợ shutdown sạch qua `SIGTERM`/`SIGINT`.

### Testability
`config/database.js` không còn probe DB ngay khi import trong `NODE_ENV=test`, nên có thể require app/server trong Jest mà không bị side effect không cần thiết.

### Variant image mapping
Repo có migration thêm `image_id` cho `product_variants`, nhưng code hiện tại mới hỗ trợ CRUD variant cơ bản:
- `Product.getVariants(productId)`
- `Product.addVariant(productId, variantData)`
- `Product.deleteVariant(variantId)`

Tài liệu cũ ghi nhận feature "ảnh theo màu của variant" là hoàn tất không còn đúng với code hiện tại.

## Cấu trúc thư mục

```text
TMDT_nodejs/
|-- app.js
|-- server.js
|-- config/
|-- controllers/
|-- database/
|-- middleware/
|-- migrations/
|-- models/
|-- public/
|-- routes/
|-- services/
|-- views/
|-- __tests__/
```

## Gợi ý kiểm tra nhanh sau khi setup

1. Chạy `npm test` để xác nhận startup flow ổn.
2. Kiểm tra kết nối MySQL bằng cách chạy `npm start`.
3. Thử login, cart, checkout và admin dashboard với dữ liệu seed.
4. Nếu dùng chat AI, xác nhận provider/key trong `.env` hoạt động.

## License

ISC