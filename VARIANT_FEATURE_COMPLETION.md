# Trạng thái hiện tại của tính năng product variant image

File này thay thế ghi chú cũ từng mô tả feature "ảnh theo màu của biến thể" là đã hoàn tất.
Sau khi đối chiếu lại code hiện tại, trạng thái đúng là như sau.

## Những gì đã có trong code

### Database
- Có migration `migrations/001_add_image_id_to_variants.sql`.
- Migration thêm cột `image_id` vào bảng `product_variants`.

### Backend hiện tại
- `models/Product.js` đang có các method:
  - `getVariants(productId)`
  - `addVariant(productId, variantData)`
  - `deleteVariant(variantId)`
- `controllers/adminController.js` đang expose:
  - `getProductVariants`
  - `addProductVariant`
  - `deleteProductVariant`
- `routes/adminRoutes.js` hiện chỉ có các endpoint CRUD variant cơ bản.

## Những gì chưa có trong code hiện tại

Các thành phần dưới đây từng được ghi là hoàn tất trong tài liệu cũ, nhưng hiện không tồn tại trong code đang chạy:
- `assignImageToVariant(...)`
- `updateVariantImage(...)`
- `removeImageFromVariant(...)`
- `getImageByColor(...)`
- Các route:
  - `PUT /admin/products/variants/:variantId/image`
  - `POST /admin/products/variants/:variantId/image`
  - `DELETE /admin/products/variants/:variantId/image`
- Frontend tự động đổi ảnh theo màu variant ở mức hoàn chỉnh end-to-end.

## Kết luận

Tính năng variant hiện tại là "CRUD biến thể cơ bản".
Tính năng "gắn ảnh riêng cho từng variant và đổi ảnh theo màu" mới dừng ở mức chuẩn bị schema, chưa phải feature hoàn tất trong code hiện tại.

## Nếu muốn hoàn thiện sau này

Cần bổ sung đồng bộ cả 4 phần:
1. Model methods để đọc/ghi `image_id`.
2. Admin controller + routes để gắn/xóa ảnh cho variant.
3. UI admin để chọn ảnh cho từng variant.
4. Frontend product detail để đổi ảnh theo variant đang chọn.