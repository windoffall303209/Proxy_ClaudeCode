# BÁO CÁO BÀI TẬP LỚN

**Môn:** Phát triển hệ thống thương mại điện tử

**Đề tài:** Xây dựng website thương mại điện tử thời trang WIND OF FALL

**Lớp:** [Điền lớp]

**Số thứ tự nhóm:** [Điền số nhóm]

**GVHD:** TS. Lê Văn Vịnh

**SVTH:** [Điền danh sách sinh viên, mã sinh viên, nhóm trưởng in đậm]

**Hà Nội, tháng 5 năm 2026**

{{PAGE_BREAK}}

# MỤC LỤC

1. Chương I. Mô tả, khảo sát và xác định yêu cầu bài toán
2. Chương II. Kiến thức áp dụng
3. Chương III. Phân tích thiết kế hệ thống
4. Chương IV. Cài đặt và hướng dẫn sử dụng
5. Kết luận
6. Hướng phát triển
7. Tài liệu tham khảo
8. Phân công công việc

{{PAGE_BREAK}}

# Chương I. MÔ TẢ, KHẢO SÁT VÀ XÁC ĐỊNH YÊU CẦU BÀI TOÁN

## 1.1. Mô tả bài toán

Thương mại điện tử trong lĩnh vực thời trang yêu cầu một hệ thống vừa hỗ trợ trưng bày sản phẩm trực quan, vừa xử lý chính xác các nghiệp vụ giỏ hàng, đặt hàng, thanh toán, giao nhận, đổi trả và chăm sóc khách hàng. Với đặc thù sản phẩm thời trang, hệ thống cần quản lý danh mục, ảnh sản phẩm, biến thể kích cỡ, màu sắc, tồn kho, chương trình khuyến mãi và đánh giá sau mua. Bên cạnh đó, quản trị viên cần một khu vực vận hành đủ mạnh để cập nhật dữ liệu sản phẩm, theo dõi đơn hàng, chăm sóc khách, gửi thông báo marketing và cấu hình giao diện cửa hàng.

Đề tài WIND OF FALL xây dựng một website thương mại điện tử thời trang dựa trên Node.js, Express.js, EJS và MySQL. Hệ thống có hai nhóm giao diện chính: giao diện người dùng cho khách hàng mua sắm và giao diện quản trị cho nhân viên/admin vận hành cửa hàng. Ngoài các chức năng thương mại điện tử cơ bản, project còn tích hợp các điểm nâng cao như thanh toán COD/VNPay/MoMo, chatbot tư vấn có RAG, tìm sản phẩm bằng hình ảnh, email marketing, cấu hình storefront động và cơ chế bảo mật bằng JWT, Helmet CSP, same-origin guard.

Mục tiêu của hệ thống là số hóa quy trình bán hàng thời trang từ khâu khách xem sản phẩm đến khâu admin xử lý đơn, đồng thời tạo nền tảng có thể mở rộng sang các nghiệp vụ thực tế như tích hợp vận chuyển, cá nhân hóa đề xuất sản phẩm, chăm sóc khách hàng tự động và vận hành đa kênh.

## 1.2. Khảo sát và xác định yêu cầu bài toán

Qua khảo sát quy trình vận hành của một cửa hàng thời trang trực tuyến, có thể xác định các nhu cầu chính sau:

- Khách hàng cần xem sản phẩm theo danh mục, tìm kiếm nhanh, lọc, xem chi tiết ảnh và biến thể sản phẩm trước khi quyết định mua.
- Khách hàng cần có tài khoản để lưu thông tin cá nhân, địa chỉ giao hàng, lịch sử đơn, trạng thái thanh toán và yêu cầu đổi trả.
- Hệ thống cần hỗ trợ cả khách vãng lai ở một số màn hình công khai và người dùng đã đăng nhập ở các nghiệp vụ yêu cầu xác thực.
- Quy trình đặt hàng cần kiểm tra giỏ hàng, địa chỉ, voucher, phí vận chuyển, phương thức thanh toán và trạng thái thanh toán.
- Quản trị viên cần quản lý sản phẩm, danh mục, ảnh, biến thể, banner, sale, voucher, đơn hàng, người dùng, đánh giá, đổi trả và cấu hình website.
- Cửa hàng cần kênh hỗ trợ khách hàng nhanh, trong đó chatbot có thể trả lời câu hỏi cơ bản, gợi ý sản phẩm và chuyển chế độ xử lý thủ công khi cần.
- Hệ thống cần có cơ chế bảo mật, phân quyền, kiểm soát request thay đổi trạng thái và bảo vệ dữ liệu cá nhân.

## 1.3. Đối tượng sử dụng

| Tác nhân | Vai trò trong hệ thống | Nhu cầu chính |
| --- | --- | --- |
| Khách vãng lai | Người dùng chưa đăng nhập | Xem trang chủ, danh mục, tìm kiếm, xem chi tiết sản phẩm, thêm giỏ tạm thời, chat tư vấn |
| Khách hàng | Người dùng đã có tài khoản | Quản lý hồ sơ, địa chỉ, giỏ hàng, đặt hàng, thanh toán, theo dõi đơn, đổi trả, đánh giá |
| Quản trị viên | Người vận hành website | Quản lý catalog, đơn hàng, khách hàng, khuyến mãi, banner, storefront, chat, marketing |
| Cổng thanh toán | Hệ thống ngoài | Nhận yêu cầu thanh toán và gửi callback/IPN xác nhận kết quả |
| Dịch vụ AI | Hệ thống ngoài | Tạo câu trả lời, embedding văn bản, phân tích ảnh và gợi ý sản phẩm |
| Dịch vụ email/media | Hệ thống ngoài | Gửi email giao dịch/marketing và lưu trữ ảnh/video |

## 1.4. Phạm vi chức năng

Phạm vi người dùng bao gồm đăng ký, đăng nhập, Google OAuth, xác thực email, quên mật khẩu, cập nhật hồ sơ, quản lý địa chỉ, xem sản phẩm, tìm kiếm, lọc theo danh mục, xem chi tiết, thêm/sửa/xóa giỏ hàng, mua ngay, áp dụng voucher, đặt hàng, thanh toán COD/VNPay/MoMo, thanh toán lại đơn online, xem lịch sử đơn, theo dõi vận chuyển, hủy đơn, xác nhận đã nhận hàng, gửi yêu cầu đổi trả, đánh giá sản phẩm kèm ảnh/video, đăng ký newsletter và chat với cửa hàng.

Phạm vi quản trị bao gồm đăng nhập admin, dashboard, quản lý danh mục, sản phẩm, ảnh, biến thể, import/export sản phẩm và danh mục, quản lý đơn hàng, cập nhật trạng thái đơn, duyệt đổi trả, quản lý người dùng, đánh giá, banner, sale, voucher, gửi email marketing, quản lý chat khách hàng, cấu hình storefront, cấu hình phương thức thanh toán, cấu hình phí vận chuyển, bật/tắt maintenance mode và quản lý một số thiết lập bảo mật.

## 1.5. Yêu cầu chức năng

| Nhóm chức năng | Mô tả yêu cầu |
| --- | --- |
| Quản lý tài khoản | Đăng ký, đăng nhập, đăng xuất, xác thực email, quên mật khẩu, Google OAuth, cập nhật hồ sơ, đổi mật khẩu, xóa mềm tài khoản |
| Catalog sản phẩm | Hiển thị danh mục, danh sách sản phẩm, tìm kiếm, gợi ý, chi tiết sản phẩm, ảnh, biến thể, sale, đánh giá |
| Giỏ hàng | Lưu giỏ theo user hoặc session, thêm/sửa/xóa sản phẩm, tính tổng tiền và số lượng |
| Đặt hàng | Checkout từ giỏ hoặc mua ngay, chọn địa chỉ, áp dụng voucher, tính phí ship, tạo đơn và order item |
| Thanh toán | COD, VNPay, MoMo, tạo bản ghi payment, xác minh chữ ký callback, cập nhật trạng thái đơn |
| Theo dõi đơn | Lịch sử đơn, tracking event, trạng thái vận chuyển, hủy đơn, xác nhận nhận hàng |
| Đổi trả | User gửi yêu cầu đổi trả kèm ảnh/video, admin duyệt và cập nhật trạng thái |
| Review | Khách mua hàng đánh giá sản phẩm, có thể đính kèm media |
| Chatbot | Chat khách/admin, AI trả lời tự động, RAG theo sản phẩm/knowledge, gửi ảnh để tìm sản phẩm tương tự |
| Quản trị | Dashboard, CRUD catalog, quản lý đơn, user, banner, sale, voucher, review, storefront settings, email marketing |

## 1.6. Yêu cầu phi chức năng

- Bảo mật: hệ thống cần xác thực bằng JWT, phân quyền admin, chặn request đổi trạng thái không cùng nguồn gốc, kiểm soát upload, không lộ stack trace cho người dùng cuối và cấu hình cookie an toàn trong production.
- Hiệu năng: các truy vấn phổ biến cần có index theo email, slug, status, user_id, product_id, order_code; dữ liệu storefront settings được cache ngắn hạn để giảm truy vấn lặp.
- Khả năng mở rộng: kiến trúc tách route, controller, model, service và middleware giúp bổ sung nghiệp vụ mới mà không làm phình controller.
- Khả năng bảo trì: schema được quản lý bằng `database/schema.sql` và các migration đánh số; README đóng vai trò bản đồ kỹ thuật của project.
- Trải nghiệm người dùng: giao diện server-render bằng EJS, tách CSS/JS theo trang, responsive cho storefront và admin.
- Tính toàn vẹn dữ liệu: MySQL dùng khóa ngoại cho các quan hệ chính như user-order, product-category, cart-item, order-item, payment-order, review-product.

# Chương II. KIẾN THỨC ÁP DỤNG

## 2.1. Phân tích và thiết kế hệ thống

Trong quá trình xây dựng hệ thống thương mại điện tử, nhóm áp dụng các kỹ thuật phân tích thiết kế như biểu đồ phân cấp chức năng, biểu đồ luồng dữ liệu và mô hình quan hệ cơ sở dữ liệu. Biểu đồ phân cấp chức năng giúp tách hệ thống lớn thành các khối nghiệp vụ như quản lý tài khoản, catalog, giỏ hàng, đơn hàng, thanh toán, hậu mãi, chatbot và quản trị. Biểu đồ luồng dữ liệu giúp mô tả cách dữ liệu đi từ người dùng đến hệ thống, từ hệ thống đến cơ sở dữ liệu và từ hệ thống đến các dịch vụ ngoài như VNPay, MoMo, Cloudinary, Resend và AI provider. ERD giúp xác định các bảng, khóa chính, khóa ngoại và ràng buộc dữ liệu.

### 2.1.1. Biểu đồ phân cấp chức năng BFD

```text
WIND OF FALL E-commerce
|-- 1. Quản lý tài khoản
|   |-- Đăng ký, đăng nhập, đăng xuất
|   |-- Xác thực email, quên mật khẩu
|   |-- Hồ sơ cá nhân, địa chỉ giao hàng
|   |-- Xóa mềm và khôi phục tài khoản trong thời hạn
|-- 2. Quản lý mua sắm
|   |-- Xem trang chủ, danh mục, danh sách sản phẩm
|   |-- Tìm kiếm, lọc, gợi ý sản phẩm
|   |-- Xem chi tiết sản phẩm, biến thể, ảnh, review
|-- 3. Giỏ hàng và đặt hàng
|   |-- Thêm, cập nhật, xóa sản phẩm khỏi giỏ
|   |-- Checkout từ giỏ hoặc mua ngay
|   |-- Áp dụng voucher, tính phí ship
|-- 4. Thanh toán và đơn hàng
|   |-- COD, VNPay, MoMo
|   |-- Callback/IPN, retry payment
|   |-- Lịch sử đơn, tracking, hủy đơn, xác nhận nhận hàng
|-- 5. Hậu mãi
|   |-- Review có ảnh/video
|   |-- Yêu cầu đổi trả và admin duyệt
|-- 6. Chat và tư vấn
|   |-- Chat widget
|   |-- AI/RAG text, vision, tìm sản phẩm bằng ảnh
|   |-- Admin chat, chuyển AI/manual
|-- 7. Quản trị hệ thống
|   |-- Dashboard
|   |-- CRUD sản phẩm, danh mục, banner, sale, voucher
|   |-- Quản lý user, đơn hàng, review, đổi trả
|   |-- Storefront settings, maintenance, email marketing
```

### 2.1.2. Biểu đồ luồng dữ liệu DFD

DFD mức ngữ cảnh có thể mô tả hệ thống WIND OF FALL là một tiến trình trung tâm nhận dữ liệu từ khách hàng và quản trị viên. Khách hàng gửi yêu cầu xem sản phẩm, tạo giỏ, đặt hàng, thanh toán và chat. Quản trị viên gửi yêu cầu quản lý catalog, đơn hàng, người dùng, khuyến mãi và cấu hình website. Hệ thống đọc/ghi dữ liệu vào MySQL, gửi ảnh lên Cloudinary, gửi email qua Resend, chuyển yêu cầu thanh toán đến VNPay/MoMo và gửi truy vấn đến dịch vụ AI.

DFD mức 1 chia hệ thống thành các tiến trình chính:

1. Xác thực và quản lý tài khoản: nhận thông tin đăng ký/đăng nhập, kiểm tra database, sinh JWT, gửi mã xác thực email hoặc reset password.
2. Quản lý sản phẩm: lấy dữ liệu danh mục, sản phẩm, ảnh, biến thể, sale, review; trả về danh sách hoặc chi tiết sản phẩm.
3. Xử lý giỏ hàng: nhận thao tác thêm/sửa/xóa, cập nhật bảng `cart` và `cart_items`.
4. Xử lý đơn hàng: kiểm tra giỏ, địa chỉ, voucher, tồn kho, tạo đơn, order item, payment và shipment.
5. Xử lý thanh toán: tạo URL/QR thanh toán, nhận callback, xác minh chữ ký, cập nhật `payments` và `orders`.
6. Chăm sóc khách hàng: lưu conversation/message, truy vấn RAG, gọi AI, hoặc chuyển sang admin trả lời thủ công.
7. Quản trị: admin thao tác trên sản phẩm, danh mục, order, user, banner, sale, voucher, storefront settings và báo cáo vận hành.

## 2.2. Quản trị hệ thống

Hệ thống quản trị được tách riêng dưới prefix `/admin`. Các route admin sau khi qua trang login đều dùng middleware `verifyToken` và `isAdmin`, đảm bảo chỉ tài khoản role `admin` mới truy cập được. Admin có thể quản lý dữ liệu nghiệp vụ quan trọng như sản phẩm, danh mục, biến thể, ảnh sản phẩm, đơn hàng, người dùng, banner, sale, voucher, đánh giá, yêu cầu đổi trả, chat và cấu hình storefront.

Thiết kế admin theo module giúp người vận hành thao tác trực tiếp với các thành phần của cửa hàng mà không cần can thiệp vào database. Các chức năng import/export sản phẩm và danh mục hỗ trợ vận hành dữ liệu số lượng lớn. Storefront settings cho phép chỉnh nội dung, hiển thị, phương thức thanh toán, phí vận chuyển và maintenance mode theo dạng cấu hình.

## 2.3. Cơ sở dữ liệu

Project sử dụng MySQL với driver `mysql2/promise`. Cơ sở dữ liệu được thiết kế theo hướng chuẩn hóa, chia thành các nhóm bảng phục vụ tài khoản, catalog sản phẩm, giỏ hàng, đơn hàng, thanh toán, hậu mãi, chat/RAG và cấu hình website. Các bảng quan trọng đều có khóa chính tự tăng, khóa ngoại và index cho trường thường truy vấn như email, slug, user_id, product_id, order_code, status.

Việc dùng migration đánh số từ `001` đến `017` giúp quản lý thay đổi schema theo thời gian. `database/schema.sql` là bản schema reset đầy đủ, còn thư mục `migrations` chứa các thay đổi tăng dần như thêm ảnh cho biến thể, mode chat AI/manual, voucher theo sản phẩm, review media, tracking đơn hàng, RAG, embedding ảnh, storefront settings, hạn thanh toán online, phí ship và xóa mềm tài khoản.

## 2.4. Ngôn ngữ lập trình và framework

Backend dùng Node.js và Express.js. Express cung cấp hệ thống middleware và router phù hợp với mô hình MVC. View được render bằng EJS, giúp server trả về HTML hoàn chỉnh, phù hợp với website thương mại điện tử truyền thống và giảm độ phức tạp so với SPA. JavaScript phía client được tách theo từng trang trong `public/js`, còn CSS tách theo storefront và admin trong `public/css`.

Các thư viện chính gồm `bcryptjs` để băm mật khẩu, `jsonwebtoken` để sinh/kiểm tra JWT, `helmet` để cấu hình HTTP security headers, `multer` để nhận file upload, `cloudinary` và `sharp` để xử lý media, `xlsx` để import/export dữ liệu, `nodemailer`/`resend` để gửi email, `axios` và `qrcode` để tích hợp thanh toán, cùng các thư viện AI/embedding qua endpoint OpenAI-compatible hoặc Gemini CLI.

## 2.5. Kiến thức bảo mật áp dụng

Hệ thống áp dụng nhiều lớp bảo mật ở mức ứng dụng. JWT được lưu ở cookie và kiểm tra bằng middleware `verifyToken`; quyền admin được kiểm tra bằng `isAdmin`. Middleware `optionalAuth` cho phép các trang công khai cá nhân hóa nội dung nếu user đã đăng nhập. Email chưa xác thực bị chặn trước khi dùng các chức năng yêu cầu tài khoản hợp lệ.

`helmet` được dùng để cấu hình Content Security Policy, referrer policy và hạn chế nguồn script/style/media. Middleware `sameOrigin` bảo vệ các request POST/PUT/PATCH/DELETE bằng cách kiểm tra `Origin`, `Referer` hoặc `Sec-Fetch-Site`. Upload file được tách theo mục đích: sản phẩm, chat, review, đổi trả, import dữ liệu; giới hạn dung lượng được cấu hình bằng biến môi trường. Với tài khoản bị xóa, hệ thống dùng xóa mềm trong 14 ngày rồi job định kỳ ẩn danh thông tin cá nhân.

## 2.6. Thanh toán điện tử

Hệ thống hỗ trợ ba phương thức thanh toán: COD, VNPay và MoMo. COD tạo đơn với trạng thái chờ xử lý và thanh toán khi nhận hàng. VNPay tạo URL thanh toán dựa trên tham số giao dịch, ký HMAC SHA512 và xác minh chữ ký callback/IPN trước khi cập nhật kết quả. MoMo tạo request thanh toán dạng `captureWallet`, ký HMAC SHA256, nhận `payUrl`, QR code/deeplink và xác minh callback bằng chữ ký.

Các đơn online có trạng thái `pending_payment`, có thể thanh toán lại qua route retry và có thời hạn thanh toán cấu hình được. Bảng `payments` lưu bản ghi giao dịch theo order, phương thức, transaction_id, trạng thái, amount và raw response, giúp đối soát khi có sự cố.

## 2.7. Chatbot, RAG và tìm sản phẩm bằng ảnh

Chatbot được thiết kế như một kênh hỗ trợ khách hàng trên storefront. Dữ liệu chat gồm `chat_conversations` và `chat_messages`, hỗ trợ sender `customer`, `admin`, `bot`, trạng thái active/closed và mode xử lý `ai` hoặc `manual`. Admin có thể xem hội thoại, trả lời, đóng/mở lại và chuyển chế độ từ AI sang thủ công.

RAG được xây dựng bằng cách đồng bộ dữ liệu sản phẩm và knowledge tĩnh thành các chunk trong `chat_rag_chunks`, tạo embedding cho từng chunk, sau đó tìm kiếm theo cosine similarity kết hợp lexical bonus. Điều này giúp chatbot trả lời dựa trên dữ liệu catalog và thông tin cửa hàng thay vì bịa thông tin. Với ảnh khách gửi, hệ thống có service vision và visual embedding để mô tả ảnh hoặc tìm sản phẩm tương tự trong catalog.

# Chương III. PHÂN TÍCH THIẾT KẾ HỆ THỐNG

## 3.1. Kiến trúc tổng thể

Project có kiến trúc server-rendered MVC mở rộng bằng service layer. Luồng xử lý tổng quát như sau:

```text
Browser
  -> Express app (app.js)
  -> Middleware: Helmet, session, body parser, sameOrigin, optionalAuth, settings
  -> routes/index.js
  -> Route modules: auth, products, cart, orders, admin, newsletter, chat
  -> Controllers
  -> Models hoặc Services
  -> MySQL / Cloudinary / Resend / VNPay / MoMo / AI Provider
  -> EJS views hoặc JSON response
```

`server.js` chịu trách nhiệm mở HTTP server, graceful shutdown và job định kỳ 6 giờ/lần để ẩn danh tài khoản đã quá hạn khôi phục. `app.js` chỉ tạo Express app và không tự listen port, nhờ đó Jest có thể import app mà không gây side effect. Đây là thiết kế tốt cho kiểm thử và triển khai.

## 3.2. Cấu trúc thư mục

| Thư mục/tệp | Vai trò |
| --- | --- |
| `app.js` | Tạo Express app, cấu hình middleware, static assets, route và error handler |
| `server.js` | Start/stop server, graceful shutdown, job ẩn danh tài khoản |
| `routes/` | Khai báo URL và mount route module |
| `controllers/` | Điều phối request, gọi model/service, render view hoặc trả JSON |
| `models/` | Query MySQL, chuẩn hóa dữ liệu và thao tác nghiệp vụ gần database |
| `services/` | Tích hợp ngoài và logic phức tạp: payment, email, AI, import, embedding |
| `middleware/` | Auth, upload, same-origin guard, settings, header categories |
| `views/` | Template EJS cho storefront, auth, checkout, user, admin |
| `public/` | CSS, JS, ảnh tĩnh, vendor assets và uploads |
| `database/` | Schema reset, seed và dữ liệu SQL phụ |
| `migrations/` | Migration SQL theo thứ tự |
| `scripts/` | Script sync RAG, embedding ảnh, seed, kiểm tra DB, utility |
| `__tests__/` | Bộ kiểm thử Jest cho controller, model, service, security và startup |

## 3.3. Route map

| URL prefix | Route file | Chức năng |
| --- | --- | --- |
| `/` | `routes/index.js` | Trang chủ, API tỉnh/thành/quận/huyện/xã, reverse geocode |
| `/auth` | `routes/authRoutes.js` | Đăng ký, đăng nhập, Google OAuth, profile, địa chỉ, verify email, forgot password |
| `/products` | `routes/productRoutes.js` | Danh sách, tìm kiếm, danh mục, gợi ý, chi tiết, review |
| `/cart` | `routes/cartRoutes.js` | Xem giỏ, thêm, cập nhật, xóa, đếm số lượng |
| `/orders` | `routes/orderRoutes.js` | Checkout, tạo đơn, mua ngay, voucher, lịch sử, tracking, thanh toán, đổi trả |
| `/admin` | `routes/adminRoutes.js` | Dashboard và toàn bộ chức năng quản trị |
| `/newsletter` | `routes/newsletterRoutes.js` | Subscribe, unsubscribe, kiểm tra trạng thái |
| `/chat` | `routes/chatRoutes.js` | Chat khách hàng, admin chat, unread count, mode AI/manual |

## 3.4. Phân tích thiết kế cơ sở dữ liệu

CSDL của hệ thống có thể chia thành các nhóm thực thể sau:

| Nhóm | Bảng chính | Ý nghĩa |
| --- | --- | --- |
| Người dùng | `users`, `addresses` | Tài khoản khách/admin, xác thực, địa chỉ giao hàng, xóa mềm |
| Catalog | `categories`, `products`, `product_images`, `product_variants` | Danh mục, sản phẩm, ảnh, size/màu/tồn kho |
| Khuyến mãi | `sales`, `vouchers`, `voucher_products`, `voucher_usage` | Sale, mã giảm giá, giới hạn dùng và liên kết sản phẩm |
| Giỏ hàng | `cart`, `cart_items` | Giỏ theo user hoặc session |
| Đơn hàng | `orders`, `order_items` | Thông tin đơn, snapshot địa chỉ, sản phẩm đã mua |
| Thanh toán | `payments` | Giao dịch COD/VNPay/MoMo, transaction id, trạng thái |
| Vận chuyển | `shipments`, `order_tracking_events` | Mã tracking, trạng thái, lịch sử cập nhật |
| Hậu mãi | `order_return_requests`, `order_return_media`, `reviews`, `review_media` | Đổi trả và đánh giá sản phẩm |
| Nội dung vận hành | `banners`, `storefront_settings`, `newsletter_subscribers`, `email_campaigns` | Banner, cấu hình, subscriber, chiến dịch email |
| Chat và AI | `chat_conversations`, `chat_messages`, `chat_rag_chunks`, `chat_rag_sync_state`, `product_image_embeddings` | Hội thoại, RAG text và embedding ảnh |

Một số quan hệ quan trọng:

- `products.category_id` liên kết `categories.id`, mỗi sản phẩm thuộc một danh mục.
- `product_images.product_id` và `product_variants.product_id` liên kết sản phẩm với ảnh và biến thể.
- `orders.user_id` liên kết người đặt hàng, `order_items.order_id` liên kết chi tiết đơn.
- `payments.order_id` liên kết mỗi giao dịch với một đơn hàng.
- `order_tracking_events.order_id` ghi lịch sử trạng thái của đơn.
- `reviews.product_id`, `reviews.user_id`, `reviews.order_id` đảm bảo đánh giá gắn với sản phẩm, khách và đơn đã mua.
- `chat_messages.conversation_id` lưu các tin nhắn trong từng hội thoại.

## 3.5. Thiết kế trạng thái nghiệp vụ

Luồng trạng thái đơn hàng:

```text
pending_payment
  -> pending
  -> confirmed
  -> processing
  -> shipping
  -> delivered
  -> completed

Từ các trạng thái phù hợp có thể chuyển sang cancelled nếu khách/admin hủy đơn.
```

Với thanh toán, trạng thái chính gồm `unpaid`, `paid`, `refunded` ở bảng `orders` và `pending`, `success`, `failed`, `refunded` ở bảng `payments`. Việc tách trạng thái đơn và trạng thái payment giúp hệ thống xử lý các tình huống thực tế như đơn đã tạo nhưng chưa thanh toán, callback thanh toán thất bại, thanh toán lại, hoặc hoàn tiền.

Luồng đổi trả gồm `pending`, `approved`, `rejected`, `resolved`. User gửi yêu cầu kèm lý do và media, admin xem chi tiết và cập nhật kết quả. Luồng này giúp tách hậu mãi khỏi trạng thái giao hàng chính.

## 3.6. Thiết kế chức năng người dùng

### 3.6.1. Trang chủ và catalog

Trang chủ lấy dữ liệu qua `controllers/productController.js`, hiển thị banner, danh mục và các nhóm sản phẩm. Danh mục header được nạp bởi middleware `headerCategories`, còn cấu hình storefront được nạp bởi `storefrontSettings`. Người dùng có thể truy cập danh sách sản phẩm, trang danh mục, kết quả tìm kiếm, trang chi tiết và trang gợi ý `for-you`.

### 3.6.2. Chi tiết sản phẩm và đánh giá

Trang chi tiết sản phẩm hiển thị ảnh, thông tin giá, sale, biến thể size/màu, tồn kho, mô tả và review. Người dùng đã mua hàng có thể tạo hoặc sửa review, kèm upload ảnh/video qua middleware `reviewUpload`. Dữ liệu review được quản lý trong bảng `reviews` và `review_media`.

### 3.6.3. Giỏ hàng và checkout

Giỏ hàng hỗ trợ cả user đã đăng nhập và session. Các thao tác thêm, cập nhật, xóa sản phẩm đi qua `cartRoutes` và `cartController`. Khi checkout, hệ thống kiểm tra địa chỉ, sản phẩm, số lượng, voucher, phí ship và phương thức thanh toán. Checkout từ giỏ và mua ngay được tách route để giảm nhầm lẫn nghiệp vụ.

### 3.6.4. Thanh toán, lịch sử đơn và tracking

Sau khi tạo đơn, hệ thống điều hướng theo phương thức thanh toán. COD tạo đơn chờ xử lý; VNPay/MoMo chuyển đến cổng thanh toán sandbox và nhận callback. User có thể xem lịch sử đơn, tracking, thanh toán lại đơn online đang chờ, hủy đơn, xác nhận nhận hàng hoặc gửi yêu cầu đổi trả.

### 3.6.5. Chatbot tư vấn

Chat widget xuất hiện ở storefront, cho phép khách gửi tin nhắn văn bản hoặc media. Với mode AI, hệ thống gọi service RAG/AI để trả lời dựa trên dữ liệu sản phẩm và knowledge. Với tình huống phức tạp, admin có thể chuyển sang manual để trả lời trực tiếp.

## 3.7. Thiết kế chức năng quản trị

### 3.7.1. Dashboard admin

Dashboard tổng hợp thông tin vận hành như đơn hàng, doanh thu, người dùng, sản phẩm và các trạng thái cần xử lý. Đây là màn hình điều hướng chính sau khi admin đăng nhập.

### 3.7.2. Quản lý sản phẩm và danh mục

Admin có thể thêm, sửa, xóa sản phẩm, quản lý ảnh, biến thể, danh mục, import/export Excel và xóa hàng loạt. Upload ảnh được xử lý qua `middleware/upload.js` và Cloudinary. Import sản phẩm dùng `productBulkImportService`, còn import danh mục dùng `categoryBulkImportService`.

### 3.7.3. Quản lý đơn hàng và đổi trả

Admin xem danh sách đơn, chi tiết đơn, cập nhật trạng thái, xem tracking và xử lý yêu cầu đổi trả. Các thay đổi trạng thái được ghi vào tracking event để user theo dõi lịch sử xử lý.

### 3.7.4. Quản lý marketing

Admin quản lý banner, sale, voucher, newsletter và email marketing. Sale có thể theo phần trăm, số tiền cố định hoặc BOGO. Voucher có mã, loại giảm, giá trị, giới hạn dùng, giới hạn theo user, thời gian hiệu lực và có thể gán theo sản phẩm.

### 3.7.5. Quản lý storefront và hệ thống

Storefront settings là cơ chế cấu hình website dạng key-value, hỗ trợ draft/publish, maintenance mode, payment settings, phí ship, nội dung hiển thị và một số thiết lập bảo mật. Cách làm này giúp admin thay đổi cấu hình vận hành mà không cần sửa code.

## 3.8. Các chức năng chưa làm được hoặc còn hạn chế

- Chưa tích hợp đơn vị vận chuyển thực tế để tự động lấy phí ship và cập nhật tracking realtime từ hãng vận chuyển.
- Chưa có CSRF token per-form; hệ thống hiện dùng same-origin/origin guard cho request thay đổi trạng thái.
- Session mặc định của `express-session` chưa được thay bằng Redis/MySQL store, chưa tối ưu cho production nhiều instance.
- Chưa có tài liệu OpenAPI chi tiết cho toàn bộ endpoint.
- Một số tính năng như VNPay, MoMo, Resend, Cloudinary, AI/RAG và visual embedding phụ thuộc API key bên ngoài nên khi demo cần cấu hình môi trường đầy đủ.
- Chưa có số liệu benchmark hiệu năng, tải đồng thời và coverage kiểm thử mới nhất trong báo cáo này.
- Tracking vận chuyển chủ yếu là tracking nội bộ do admin/hệ thống cập nhật, chưa đồng bộ với đơn vị giao hàng bên ngoài.

# Chương IV. CÀI ĐẶT VÀ HƯỚNG DẪN SỬ DỤNG

## 4.1. Cài đặt cơ sở dữ liệu

Yêu cầu môi trường gồm Node.js từ phiên bản 18, MySQL từ phiên bản 5.7 và npm. Để tạo database mới, chạy:

```bash
mysql -u root -p < database/schema.sql
```

Nếu database cũ đã tồn tại, chạy các migration trong thư mục `migrations/` theo đúng thứ tự từ `001` đến `017`. Sau đó có thể import dữ liệu mẫu:

```bash
mysql -u root -p tmdt_ecommerce < database/seed.sql
```

Project cũng cung cấp file mẫu import sản phẩm tại `sample-data/wind-of-fall-product-import-example.xlsx`.

## 4.2. Cài đặt môi trường server

Các bước cài đặt:

1. Cài dependency bằng `npm install`.
2. Tạo file `.env` từ `.env.example`.
3. Cấu hình MySQL: `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT`.
4. Cấu hình JWT và session: `JWT_SECRET`, `JWT_EXPIRE`, `SESSION_SECRET`.
5. Nếu cần upload ảnh thật, cấu hình Cloudinary.
6. Nếu cần email, cấu hình Resend.
7. Nếu cần thanh toán online, cấu hình VNPay và MoMo sandbox.
8. Nếu cần chatbot/RAG, cấu hình AI provider và embedding model.

Chạy development:

```bash
npm run dev
```

Chạy production:

```bash
npm start
```

Mặc định ứng dụng chạy tại `http://localhost:3000`.

## 4.3. Giao diện User

### 4.3.1. Giao diện trang chủ

Trang chủ hiển thị banner, thông tin thương hiệu, danh mục và các nhóm sản phẩm nổi bật. Header gồm thanh thông báo, logo, tìm kiếm, auth/cart action và navigation theo danh mục. Footer có newsletter, liên kết thông tin và khu vực thanh toán/liên hệ.

### 4.3.2. Giao diện trang sản phẩm

Trang danh sách sản phẩm hỗ trợ hiển thị grid sản phẩm, toolbar, sidebar lọc, phân trang và truy cập nhanh vào chi tiết. Mỗi card sản phẩm hiển thị ảnh chính, tên, giá, sale và trạng thái.

### 4.3.3. Giao diện trang chi tiết sản phẩm

Trang chi tiết hiển thị gallery ảnh, thông tin sản phẩm, giá bán, sale, lựa chọn size/màu, tồn kho, nút thêm giỏ/mua ngay, mô tả và review. Đây là màn hình quyết định mua hàng nên cần thể hiện rõ ảnh, biến thể và trạng thái còn hàng.

### 4.3.4. Giao diện trang tìm kiếm

Người dùng có thể tìm kiếm sản phẩm theo từ khóa. Hệ thống có route `/products/search` và script `search-suggest.js` hỗ trợ gợi ý tìm kiếm. Kết quả tìm kiếm được render bằng view riêng để người dùng tiếp tục lọc và xem chi tiết.

### 4.3.5. Giao diện đăng ký, đăng nhập và xác thực

Người dùng đăng ký tài khoản, đăng nhập bằng email/mật khẩu hoặc Google OAuth. Sau khi đăng ký, hệ thống hỗ trợ xác thực email bằng mã và quên mật khẩu bằng reset code. Các route quan trọng nằm trong `authRoutes.js` và controller `authController.js`.

### 4.3.6. Giao diện giỏ hàng

Trang giỏ hàng hiển thị danh sách sản phẩm, biến thể, số lượng, đơn giá, tổng tiền và thao tác cập nhật/xóa. Giỏ hàng được lưu bền trong database theo user hoặc session, giúp người dùng không mất giỏ khi chuyển trang.

### 4.3.7. Giao diện xác nhận đặt hàng và thanh toán

Trang checkout cho phép chọn địa chỉ, kiểm tra sản phẩm, áp dụng voucher, xem phí ship, tổng tiền và chọn phương thức thanh toán. Với VNPay/MoMo, hệ thống chuyển người dùng đến cổng thanh toán hoặc hiển thị QR/deeplink; sau callback, trang confirmation hiển thị kết quả đơn hàng.

### 4.3.8. Giao diện lịch sử, tracking và đổi trả

Người dùng xem lịch sử đơn, trạng thái thanh toán, trạng thái giao hàng, timeline tracking và các thao tác như hủy, thanh toán lại, xác nhận đã nhận hàng. Với đơn đủ điều kiện, người dùng gửi yêu cầu đổi trả kèm ảnh/video.

### 4.3.9. Giao diện chatbot

Chat widget hỗ trợ người dùng hỏi thông tin cửa hàng, sản phẩm, thanh toán, giao hàng hoặc gửi ảnh để tìm sản phẩm tương tự. Tin nhắn có thể là text, media hoặc product cards. Admin có thể tiếp quản hội thoại khi cần hỗ trợ thủ công.

## 4.4. Giao diện Admin

### 4.4.1. Giao diện đăng nhập admin

Admin có route login riêng, hỗ trợ đăng nhập thường và Google OAuth. Nếu tài khoản không có role admin hoặc chưa xác thực email, hệ thống điều hướng về trang admin login kèm thông báo phù hợp.

### 4.4.2. Giao diện dashboard admin

Dashboard là màn hình tổng quan sau đăng nhập, hỗ trợ admin nắm nhanh tình hình vận hành. Từ dashboard admin có thể chuyển đến sản phẩm, đơn hàng, user, banner, sale, voucher, chat và storefront settings.

### 4.4.3. Giao diện quản lý sản phẩm

Admin có thể thêm mới, sửa, xóa sản phẩm, upload ảnh, quản lý ảnh chính, thêm biến thể size/màu, import/export dữ liệu và theo dõi job import. Đây là phần trung tâm của hệ thống catalog.

### 4.4.4. Giao diện quản lý danh mục

Admin quản lý danh mục cha-con, ảnh danh mục, thứ tự hiển thị, import/export và xóa hàng loạt. Danh mục được dùng cho navigation header và phân loại sản phẩm.

### 4.4.5. Giao diện quản lý đơn hàng

Admin xem danh sách đơn, lọc theo trạng thái, xem chi tiết, cập nhật trạng thái và theo dõi thanh toán. Trạng thái thay đổi được phản ánh cho user qua trang tracking.

### 4.4.6. Giao diện quản lý tài khoản người dùng

Admin xem danh sách user, chi tiết user và cập nhật trạng thái hoạt động. Hệ thống phân biệt user thường và admin qua trường `role`.

### 4.4.7. Giao diện quản lý banner, sale, voucher

Admin quản lý banner trang chủ, chương trình sale và voucher. Các chương trình này ảnh hưởng trực tiếp đến trải nghiệm mua hàng và tổng tiền checkout.

### 4.4.8. Giao diện quản lý chat, review và đổi trả

Admin có màn hình chat để xem hội thoại, trả lời khách, chuyển mode AI/manual, đóng hoặc mở lại conversation. Admin cũng có màn hình review và returns để theo dõi phản hồi sau mua và xử lý yêu cầu đổi trả.

### 4.4.9. Giao diện quản lý cấu hình website

Storefront settings cho phép admin thay đổi nội dung, giao diện, phương thức thanh toán, phí ship, thời hạn thanh toán và maintenance mode. Cơ chế draft/publish giúp chuẩn bị thay đổi trước khi áp dụng chính thức.

## 4.5. Kiểm thử

Repository có bộ kiểm thử Jest trong thư mục `__tests__`, bao phủ nhiều nhóm chức năng như admin controller, auth controller, cart controller, product controller, order controller, product model, chat controller, RAG service, bulk import, route security, app security headers, header navigation và startup. Đây là nền tảng kiểm thử tự động quan trọng để hạn chế regression khi sửa nghiệp vụ.

Trong phiên tạo báo cáo này, lệnh `npm test -- --runInBand` đã được thử với biến `SKIP_DB_CONNECTION_PROBE=true` nhưng không kết thúc trong giới hạn 6 phút của phiên chạy, nên báo cáo chưa ghi số lượng test pass/fail hoặc coverage mới nhất. Lệnh `npm run check:inline-views` chạy được nhưng báo còn một số inline style/style block trong EJS views. Khi nộp chính thức, nhóm nên chạy lại test trên máy cấu hình đầy đủ, cập nhật số liệu coverage và xử lý các cảnh báo chất lượng view nếu muốn báo cáo phản ánh trạng thái sạch hơn.

Bảng test case thủ công đề xuất:

| STT | Luồng kiểm thử | Kết quả mong đợi |
| --- | --- | --- |
| 1 | Đăng ký tài khoản và xác thực email | User được tạo, nhận mã, xác thực thành công |
| 2 | Đăng nhập user và truy cập profile | JWT hợp lệ, profile hiển thị đúng |
| 3 | Tìm kiếm và xem chi tiết sản phẩm | Sản phẩm trả về đúng từ khóa, trang chi tiết đủ ảnh/biến thể |
| 4 | Thêm sản phẩm vào giỏ và cập nhật số lượng | Giỏ hàng cập nhật đúng tổng tiền |
| 5 | Checkout COD | Đơn được tạo, trạng thái thanh toán chưa trả, trạng thái đơn chờ xử lý |
| 6 | Checkout VNPay/MoMo sandbox | URL/QR thanh toán được tạo, callback cập nhật payment nếu chữ ký hợp lệ |
| 7 | Hủy đơn khi còn được phép | Đơn chuyển cancelled và tracking event được ghi |
| 8 | Admin cập nhật trạng thái đơn | User xem được timeline tracking mới |
| 9 | User gửi yêu cầu đổi trả | Return request được tạo kèm media |
| 10 | Chatbot hỏi thông tin giao hàng/thanh toán | Bot trả lời dựa trên knowledge và không bịa phương thức ngoài hệ thống |

## 4.6. Triển khai

Khi triển khai production, hệ thống cần server Node.js, MySQL, domain HTTPS, biến môi trường đầy đủ, API key cho các dịch vụ ngoài và cơ chế chạy nền như PM2 hoặc service manager. Nếu dùng reverse proxy như Nginx, cần cấu hình `trust proxy`, HTTPS, callback URL của VNPay/MoMo và allowed origins phù hợp. Cookie secure nên bật khi `NODE_ENV=production`. Ảnh/media nên lưu trên Cloudinary hoặc CDN thay vì thư mục local. Session store nên chuyển sang Redis hoặc MySQL nếu chạy nhiều instance.

# KẾT LUẬN

Project WIND OF FALL đã xây dựng được một hệ thống thương mại điện tử thời trang tương đối đầy đủ, bao phủ cả phía người dùng và phía quản trị. Ở phía khách hàng, hệ thống hỗ trợ các luồng quan trọng như xem sản phẩm, tìm kiếm, giỏ hàng, checkout, thanh toán, lịch sử đơn, tracking, đổi trả, review và chat tư vấn. Ở phía quản trị, hệ thống có các chức năng vận hành thực tế như quản lý sản phẩm, danh mục, biến thể, ảnh, đơn hàng, người dùng, banner, sale, voucher, review, returns, chat, email marketing và cấu hình storefront.

Về kỹ thuật, project có kiến trúc rõ ràng theo Express MVC, tách riêng route, controller, model, service, middleware, view và public assets. CSDL MySQL được thiết kế có khóa ngoại, index và migration. Các tích hợp như VNPay, MoMo, Cloudinary, Resend, AI/RAG và visual embedding cho thấy hệ thống không chỉ dừng ở CRUD cơ bản mà đã tiếp cận nhiều bài toán thương mại điện tử thực tế. Các lớp bảo mật như JWT, phân quyền admin, Helmet CSP, same-origin guard, xác thực email và kiểm soát upload góp phần nâng cao độ an toàn của hệ thống.

Tuy nhiên, hệ thống vẫn còn không gian hoàn thiện trước khi dùng ở quy mô production lớn, đặc biệt ở các điểm như tích hợp vận chuyển thật, CSRF token per-form, session store production, tài liệu API, benchmark hiệu năng, monitoring và quy trình CI/CD. Những hạn chế này là cơ sở cho hướng phát triển tiếp theo.

# HƯỚNG PHÁT TRIỂN

- Tích hợp đơn vị vận chuyển thật để tính phí ship động, tạo vận đơn và đồng bộ tracking realtime.
- Bổ sung CSRF token cho form quan trọng, rate limiting, audit log admin, 2FA cho admin và cơ chế quản lý secret tốt hơn.
- Chuyển session store sang Redis/MySQL, bổ sung cache Redis cho catalog và settings, tối ưu truy vấn sản phẩm khi dữ liệu lớn.
- Xây dựng OpenAPI/Swagger cho các endpoint JSON, đặc biệt các endpoint admin và payment callback.
- Hoàn thiện CI/CD, Dockerfile, migration pipeline, logging tập trung và monitoring uptime.
- Phát triển recommendation cá nhân hóa dựa trên lịch sử xem, giỏ hàng, đơn hàng và sản phẩm tương tự.
- Nâng cấp chatbot bằng giao diện quản trị knowledge base, đánh giá chất lượng câu trả lời, lưu feedback và handoff rõ hơn sang nhân viên.
- Bổ sung báo cáo doanh thu, tồn kho, hiệu quả voucher/sale và hành vi người dùng cho admin dashboard.
- Chuẩn hóa kiểm thử end-to-end cho các luồng đăng ký, checkout, thanh toán, đổi trả và admin CRUD.

# TÀI LIỆU THAM KHẢO

1. Node.js Documentation: https://nodejs.org/docs
2. Express.js Documentation: https://expressjs.com
3. EJS Documentation: https://ejs.co
4. MySQL Documentation: https://dev.mysql.com/doc
5. Helmet Documentation: https://helmetjs.github.io
6. OWASP Cheat Sheet Series - Cross-Site Request Forgery Prevention: https://cheatsheetseries.owasp.org
7. VNPay Payment Gateway Documentation: https://sandbox.vnpayment.vn/apis/docs
8. MoMo Payment API Documentation: https://developers.momo.vn
9. Cloudinary Node.js SDK Documentation: https://cloudinary.com/documentation/node_integration
10. Resend Documentation: https://resend.com/docs
11. OpenAI API Documentation: https://platform.openai.com/docs
12. Tài liệu nội bộ project: `README.md`, `DESIGN.md`, `database/schema.sql`, `routes/`, `controllers/`, `models/`, `services/`, `middleware/`.

# PHÂN CÔNG CÔNG VIỆC

| STT | Mã SV | Họ và tên SV | Công việc | Xác nhận |
| --- | --- | --- | --- | --- |
| 1 | [Mã SV] | [Họ tên nhóm trưởng] | Phân tích yêu cầu, thiết kế CSDL, xây dựng backend auth/order/payment, tổng hợp báo cáo |  |
| 2 | [Mã SV] | [Họ tên thành viên] | Xây dựng giao diện storefront, catalog, giỏ hàng, checkout, profile |  |
| 3 | [Mã SV] | [Họ tên thành viên] | Xây dựng admin dashboard, quản lý sản phẩm, danh mục, sale, voucher, banner |  |
| 4 | [Mã SV] | [Họ tên thành viên] | Xây dựng chatbot/RAG, upload media, review, đổi trả, kiểm thử |  |

Ghi chú: Bảng phân công cần được nhóm cập nhật theo danh sách sinh viên thực tế trước khi nộp.
