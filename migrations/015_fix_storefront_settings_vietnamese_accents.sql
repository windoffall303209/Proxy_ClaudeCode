-- Sửa các giá trị mặc định của Quản lí trang web nếu DB đã seed bản tiếng Việt không dấu.
UPDATE storefront_settings SET setting_value = 'Thời trang mặc đẹp mỗi ngày'
WHERE setting_key = 'site_tagline' AND setting_value = 'Thoi trang mac dep moi ngay';

UPDATE storefront_settings SET setting_value = 'Tìm áo polo, váy midi, quần jean...'
WHERE setting_key = 'search_placeholder' AND setting_value = 'Tim ao polo, vay midi, quan jean...';

UPDATE storefront_settings SET setting_value = 'Tìm sản phẩm yêu thích...'
WHERE setting_key = 'mobile_search_placeholder' AND setting_value = 'Tim san pham yeu thich...';

UPDATE storefront_settings SET setting_value = 'Trang chủ'
WHERE setting_key = 'home_link_label' AND setting_value = 'Trang chu';

UPDATE storefront_settings SET setting_value = 'Tất cả'
WHERE setting_key = 'all_products_label' AND setting_value = 'Tat ca';

UPDATE storefront_settings SET setting_value = 'Sale tới 50%'
WHERE setting_key = 'sale_link_label' AND setting_value = 'Sale toi 50%';

UPDATE storefront_settings SET setting_value = 'Tìm outfit cho cả gia đình'
WHERE setting_key = 'mobile_menu_slogan' AND setting_value = 'Tim outfit cho ca gia dinh';

UPDATE storefront_settings SET setting_value = 'Hỗ trợ tư vấn set đồ 1:1 qua hotline 1900 123 456'
WHERE setting_key = 'mobile_support_text' AND setting_value = 'Ho tro tu van set do 1:1 qua hotline 1900 123 456';

UPDATE storefront_settings SET setting_value = 'Bộ sưu tập mới / mặc đẹp mỗi ngày'
WHERE setting_key = 'hero_eyebrow' AND setting_value = 'Bo suu tap moi / mac dep moi ngay';

UPDATE storefront_settings SET setting_value = 'Chọn nhanh outfit đẹp cho nam, nữ và trẻ em.'
WHERE setting_key = 'hero_title' AND setting_value = 'Chon nhanh outfit dep cho nam, nu va tre em.';

UPDATE storefront_settings SET setting_value = 'Áo polo, sơ mi, váy, jeans và nhiều mẫu dễ mặc đã sẵn sàng để bạn mua ngay.'
WHERE setting_key = 'hero_copy' AND setting_value = 'Ao polo, so mi, vay, jeans va nhieu mau de mac da san sang de ban mua ngay.';

UPDATE storefront_settings SET setting_value = 'Mua bộ sưu tập mới'
WHERE setting_key = 'hero_primary_label' AND setting_value = 'Mua bo suu tap moi';

UPDATE storefront_settings SET setting_value = 'Xem khu sale'
WHERE setting_key = 'hero_secondary_label' AND setting_value = 'Xem khu sale';

UPDATE storefront_settings SET setting_value = 'Từ 499K'
WHERE setting_key = 'hero_stat_1_value' AND setting_value = 'Tu 499K';

UPDATE storefront_settings SET setting_value = 'Freeship toàn quốc'
WHERE setting_key = 'hero_stat_1_label' AND setting_value = 'Freeship toan quoc';

UPDATE storefront_settings SET setting_value = '30 ngày'
WHERE setting_key = 'hero_stat_2_value' AND setting_value = '30 ngay';

UPDATE storefront_settings SET setting_value = 'Đổi trả linh hoạt'
WHERE setting_key = 'hero_stat_2_label' AND setting_value = 'Doi tra linh hoat';

UPDATE storefront_settings SET setting_value = 'Hỗ trợ online'
WHERE setting_key = 'hero_stat_3_label' AND setting_value = 'Ho tro online';

UPDATE storefront_settings SET setting_value = 'Mua sắm theo nhu cầu của bạn.'
WHERE setting_key = 'home_categories_title' AND setting_value = 'Mua sam theo nhu cau cua ban.';

UPDATE storefront_settings SET setting_value = 'Chọn nhanh theo nam, nữ và trẻ em để tìm đúng sản phẩm bạn cần.'
WHERE setting_key = 'home_categories_copy' AND setting_value = 'Chon nhanh theo nam, nu va tre em de tim dung san pham ban can.';

UPDATE storefront_settings SET setting_value = 'Hàng mới lên kệ hôm nay.'
WHERE setting_key = 'home_new_products_title' AND setting_value = 'Hang moi len ke hom nay.';

UPDATE storefront_settings SET setting_value = 'Những mẫu được chọn nhiều nhất.'
WHERE setting_key = 'home_best_sellers_title' AND setting_value = 'Nhung mau duoc chon nhieu nhat.';

UPDATE storefront_settings SET setting_value = 'Dễ mặc từ công sở đến cuối tuần.'
WHERE setting_key = 'home_editorial_title' AND setting_value = 'De mac tu cong so den cuoi tuan.';

UPDATE storefront_settings SET setting_value = 'Các nhóm sản phẩm được sắp theo những nhu cầu mặc thường ngày để bạn chọn nhanh hơn.'
WHERE setting_key = 'home_editorial_copy' AND setting_value = 'Cac nhom san pham duoc sap theo nhung nhu cau mac thuong ngay de ban chon nhanh hon.';

UPDATE storefront_settings SET setting_value = 'Khám phá ngay'
WHERE setting_key = 'popup_fallback_button_label' AND setting_value = 'Kham pha ngay';

UPDATE storefront_settings SET setting_value = 'Thương hiệu thời trang everyday theo tinh thần hiện đại, gọn gàng và dễ mặc. Chúng tôi ưu tiên chất liệu, phom dáng và trải nghiệm mua sắm mượt mà trên mọi thiết bị.'
WHERE setting_key = 'footer_description' AND setting_value = 'Thuong hieu thoi trang everyday theo tinh than hien dai, gon gang va de mac.';

UPDATE storefront_settings SET setting_value = 'Thương hiệu thời trang everyday theo tinh thần hiện đại, gọn gàng và dễ mặc. Chúng tôi ưu tiên chất liệu, phom dáng và trải nghiệm mua sắm mượt mà trên mọi thiết bị.'
WHERE setting_key = 'footer_description' AND setting_value = 'Thuong hieu thoi trang everyday theo tinh than hien dai, gon gang va de mac. Chung toi uu tien chat lieu, phom dang va trai nghiem mua sam muot ma tren moi thiet bi.';

UPDATE storefront_settings SET setting_value = '123 Nguyễn Huệ, Quận 1, TP.HCM'
WHERE setting_key = 'contact_address' AND setting_value = '123 Nguyen Hue, Quan 1, TP.HCM';

UPDATE storefront_settings SET setting_value = 'Mở cửa 8:00 - 22:00 mỗi ngày'
WHERE setting_key = 'opening_hours' AND setting_value = 'Mo cua 8:00 - 22:00 moi ngay';

UPDATE storefront_settings SET setting_value = 'Nhập email để nhận ưu đãi và bộ sưu tập mới sớm hơn'
WHERE setting_key = 'newsletter_title' AND setting_value = 'Nhap email de nhan uu dai va bo suu tap moi som hon';

UPDATE storefront_settings SET setting_value = 'Cập nhật BST mới, voucher độc quyền và gợi ý phối đồ theo mùa.'
WHERE setting_key = 'newsletter_copy' AND setting_value = 'Cap nhat BST moi, voucher doc quyen va goi y phoi do theo mua.';

UPDATE storefront_settings SET setting_value = 'Đăng ký ngay'
WHERE setting_key = 'newsletter_button_label' AND setting_value = 'Dang ky ngay';

UPDATE storefront_settings SET setting_value = 'Bạn đã đăng ký nhận tin khuyến mại thành công.'
WHERE setting_key = 'newsletter_success_text' AND setting_value = 'Ban da dang ky nhan tin khuyen mai thanh cong.';

UPDATE storefront_settings SET setting_value = 'Freeship đơn từ 499K'
WHERE setting_key = 'service_shipping_title' AND setting_value = 'Freeship don tu 499K';

UPDATE storefront_settings SET setting_value = 'Thông tin ưu đãi rõ ràng ngay từ trang đầu để bạn chốt đơn nhanh hơn.'
WHERE setting_key = 'service_shipping_copy' AND setting_value = 'Thong tin uu dai ro rang ngay tu trang dau de ban chot don nhanh hon.';

UPDATE storefront_settings SET setting_value = 'Đổi trả trong 30 ngày'
WHERE setting_key = 'service_return_title' AND setting_value = 'Doi tra trong 30 ngay';

UPDATE storefront_settings SET setting_value = 'Yên tâm thử size và đổi mẫu nếu chưa thật sự phù hợp.'
WHERE setting_key = 'service_return_copy' AND setting_value = 'Yen tam thu size va doi mau neu chua that su phu hop.';

UPDATE storefront_settings SET setting_value = 'Hỗ trợ qua hotline và chat'
WHERE setting_key = 'service_consult_title' AND setting_value = 'Ho tro qua hotline va chat';

UPDATE storefront_settings SET setting_value = 'Dễ hỏi size, hỏi phối đồ và theo dõi đơn hàng khi cần.'
WHERE setting_key = 'service_consult_copy' AND setting_value = 'De hoi size, hoi phoi do va theo doi don hang khi can.';

UPDATE storefront_settings SET setting_value = 'Thanh toán rõ ràng'
WHERE setting_key = 'service_payment_title' AND setting_value = 'Thanh toan ro rang';

UPDATE storefront_settings SET setting_value = 'COD, VNPay và MoMo hiển thị sớm để người mua dễ lựa chọn.'
WHERE setting_key = 'service_payment_copy' AND setting_value = 'COD, VNPay va MoMo hien thi som de nguoi mua de lua chon.';

UPDATE storefront_settings SET setting_value = '[{"label":"Vận chuyển","url":"/policy/shipping"},{"label":"Đổi trả","url":"/policy/return"},{"label":"Thanh toán","url":"/policy/payment"},{"label":"Bảo mật thông tin","url":"/policy/privacy"}]'
WHERE setting_key = 'policy_links' AND setting_value = '[{"label":"Van chuyen","url":"/policy/shipping"},{"label":"Doi tra","url":"/policy/return"},{"label":"Thanh toan","url":"/policy/payment"},{"label":"Bao mat thong tin","url":"/policy/privacy"}]';

UPDATE storefront_settings SET setting_value = 'WIND OF FALL | Thời trang mỗi ngày'
WHERE setting_key = 'seo_title' AND setting_value = 'WIND OF FALL | Thoi trang moi ngay';

UPDATE storefront_settings SET setting_value = 'WIND OF FALL - mua sắm thời trang everyday cho nam, nữ và trẻ em.'
WHERE setting_key = 'meta_description' AND setting_value = 'WIND OF FALL - mua sam thoi trang everyday cho nam, nu va tre em.';

UPDATE storefront_settings SET setting_value = 'thời trang, quần áo, wind of fall'
WHERE setting_key = 'meta_keywords' AND setting_value = 'thoi trang, quan ao, wind of fall';

UPDATE storefront_settings SET setting_value = 'Thời trang everyday hiện đại, dễ mặc và dễ mua.'
WHERE setting_key = 'og_description' AND setting_value = 'Thoi trang everyday hien dai, de mac va de mua.';

UPDATE storefront_settings SET setting_value = 'Xin chào! Tôi là trợ lý AI của WIND OF FALL.'
WHERE setting_key = 'chat_greeting' AND setting_value = 'Xin chao! Toi la tro ly AI cua WIND OF FALL.';

UPDATE storefront_settings SET setting_value = 'Bạn cần hỗ trợ gì?'
WHERE setting_key = 'chat_prompt_text' AND setting_value = 'Ban can ho tro gi?';

UPDATE storefront_settings SET setting_value = 'Cảm ơn bạn đã đồng hành cùng WIND OF FALL.'
WHERE setting_key = 'email_footer_text' AND setting_value = 'Cam on ban da dong hanh cung WIND OF FALL.';

UPDATE storefront_settings SET setting_value = 'Đơn hàng online cần thanh toán trong thời hạn quy định để được xử lý.'
WHERE setting_key = 'payment_reminder_text' AND setting_value = 'Don hang online can thanh toan trong thoi han quy dinh de duoc xu ly.';

UPDATE storefront_settings SET setting_value = 'Website đang bảo trì, vui lòng quay lại sau.'
WHERE setting_key = 'maintenance_message' AND setting_value = 'Website dang bao tri, vui long quay lai sau.';

UPDATE storefront_settings SET draft_value = 'Thời trang mặc đẹp mỗi ngày'
WHERE setting_key = 'site_tagline' AND draft_value = 'Thoi trang mac dep moi ngay';

UPDATE storefront_settings SET draft_value = 'Tìm áo polo, váy midi, quần jean...'
WHERE setting_key = 'search_placeholder' AND draft_value = 'Tim ao polo, vay midi, quan jean...';

UPDATE storefront_settings SET draft_value = 'Tìm sản phẩm yêu thích...'
WHERE setting_key = 'mobile_search_placeholder' AND draft_value = 'Tim san pham yeu thich...';

UPDATE storefront_settings SET draft_value = 'Trang chủ'
WHERE setting_key = 'home_link_label' AND draft_value = 'Trang chu';

UPDATE storefront_settings SET draft_value = 'Tất cả'
WHERE setting_key = 'all_products_label' AND draft_value = 'Tat ca';

UPDATE storefront_settings SET draft_value = 'Sale tới 50%'
WHERE setting_key = 'sale_link_label' AND draft_value = 'Sale toi 50%';

UPDATE storefront_settings SET draft_value = 'Tìm outfit cho cả gia đình'
WHERE setting_key = 'mobile_menu_slogan' AND draft_value = 'Tim outfit cho ca gia dinh';

UPDATE storefront_settings SET draft_value = 'Hỗ trợ tư vấn set đồ 1:1 qua hotline 1900 123 456'
WHERE setting_key = 'mobile_support_text' AND draft_value = 'Ho tro tu van set do 1:1 qua hotline 1900 123 456';

UPDATE storefront_settings SET draft_value = 'Bộ sưu tập mới / mặc đẹp mỗi ngày'
WHERE setting_key = 'hero_eyebrow' AND draft_value = 'Bo suu tap moi / mac dep moi ngay';

UPDATE storefront_settings SET draft_value = 'Chọn nhanh outfit đẹp cho nam, nữ và trẻ em.'
WHERE setting_key = 'hero_title' AND draft_value = 'Chon nhanh outfit dep cho nam, nu va tre em.';

UPDATE storefront_settings SET draft_value = 'Áo polo, sơ mi, váy, jeans và nhiều mẫu dễ mặc đã sẵn sàng để bạn mua ngay.'
WHERE setting_key = 'hero_copy' AND draft_value = 'Ao polo, so mi, vay, jeans va nhieu mau de mac da san sang de ban mua ngay.';

UPDATE storefront_settings SET draft_value = 'Mua bộ sưu tập mới'
WHERE setting_key = 'hero_primary_label' AND draft_value = 'Mua bo suu tap moi';

UPDATE storefront_settings SET draft_value = 'Xem khu sale'
WHERE setting_key = 'hero_secondary_label' AND draft_value = 'Xem khu sale';

UPDATE storefront_settings SET draft_value = 'Từ 499K'
WHERE setting_key = 'hero_stat_1_value' AND draft_value = 'Tu 499K';

UPDATE storefront_settings SET draft_value = 'Freeship toàn quốc'
WHERE setting_key = 'hero_stat_1_label' AND draft_value = 'Freeship toan quoc';

UPDATE storefront_settings SET draft_value = '30 ngày'
WHERE setting_key = 'hero_stat_2_value' AND draft_value = '30 ngay';

UPDATE storefront_settings SET draft_value = 'Đổi trả linh hoạt'
WHERE setting_key = 'hero_stat_2_label' AND draft_value = 'Doi tra linh hoat';

UPDATE storefront_settings SET draft_value = 'Hỗ trợ online'
WHERE setting_key = 'hero_stat_3_label' AND draft_value = 'Ho tro online';

UPDATE storefront_settings SET draft_value = 'Mua sắm theo nhu cầu của bạn.'
WHERE setting_key = 'home_categories_title' AND draft_value = 'Mua sam theo nhu cau cua ban.';

UPDATE storefront_settings SET draft_value = 'Chọn nhanh theo nam, nữ và trẻ em để tìm đúng sản phẩm bạn cần.'
WHERE setting_key = 'home_categories_copy' AND draft_value = 'Chon nhanh theo nam, nu va tre em de tim dung san pham ban can.';

UPDATE storefront_settings SET draft_value = 'Hàng mới lên kệ hôm nay.'
WHERE setting_key = 'home_new_products_title' AND draft_value = 'Hang moi len ke hom nay.';

UPDATE storefront_settings SET draft_value = 'Những mẫu được chọn nhiều nhất.'
WHERE setting_key = 'home_best_sellers_title' AND draft_value = 'Nhung mau duoc chon nhieu nhat.';

UPDATE storefront_settings SET draft_value = 'Dễ mặc từ công sở đến cuối tuần.'
WHERE setting_key = 'home_editorial_title' AND draft_value = 'De mac tu cong so den cuoi tuan.';

UPDATE storefront_settings SET draft_value = 'Các nhóm sản phẩm được sắp theo những nhu cầu mặc thường ngày để bạn chọn nhanh hơn.'
WHERE setting_key = 'home_editorial_copy' AND draft_value = 'Cac nhom san pham duoc sap theo nhung nhu cau mac thuong ngay de ban chon nhanh hon.';

UPDATE storefront_settings SET draft_value = 'Khám phá ngay'
WHERE setting_key = 'popup_fallback_button_label' AND draft_value = 'Kham pha ngay';

UPDATE storefront_settings SET draft_value = 'Thương hiệu thời trang everyday theo tinh thần hiện đại, gọn gàng và dễ mặc. Chúng tôi ưu tiên chất liệu, phom dáng và trải nghiệm mua sắm mượt mà trên mọi thiết bị.'
WHERE setting_key = 'footer_description' AND draft_value = 'Thuong hieu thoi trang everyday theo tinh than hien dai, gon gang va de mac.';

UPDATE storefront_settings SET draft_value = 'Thương hiệu thời trang everyday theo tinh thần hiện đại, gọn gàng và dễ mặc. Chúng tôi ưu tiên chất liệu, phom dáng và trải nghiệm mua sắm mượt mà trên mọi thiết bị.'
WHERE setting_key = 'footer_description' AND draft_value = 'Thuong hieu thoi trang everyday theo tinh than hien dai, gon gang va de mac. Chung toi uu tien chat lieu, phom dang va trai nghiem mua sam muot ma tren moi thiet bi.';

UPDATE storefront_settings SET draft_value = '123 Nguyễn Huệ, Quận 1, TP.HCM'
WHERE setting_key = 'contact_address' AND draft_value = '123 Nguyen Hue, Quan 1, TP.HCM';

UPDATE storefront_settings SET draft_value = 'Mở cửa 8:00 - 22:00 mỗi ngày'
WHERE setting_key = 'opening_hours' AND draft_value = 'Mo cua 8:00 - 22:00 moi ngay';

UPDATE storefront_settings SET draft_value = 'Nhập email để nhận ưu đãi và bộ sưu tập mới sớm hơn'
WHERE setting_key = 'newsletter_title' AND draft_value = 'Nhap email de nhan uu dai va bo suu tap moi som hon';

UPDATE storefront_settings SET draft_value = 'Cập nhật BST mới, voucher độc quyền và gợi ý phối đồ theo mùa.'
WHERE setting_key = 'newsletter_copy' AND draft_value = 'Cap nhat BST moi, voucher doc quyen va goi y phoi do theo mua.';

UPDATE storefront_settings SET draft_value = 'Đăng ký ngay'
WHERE setting_key = 'newsletter_button_label' AND draft_value = 'Dang ky ngay';

UPDATE storefront_settings SET draft_value = 'Bạn đã đăng ký nhận tin khuyến mại thành công.'
WHERE setting_key = 'newsletter_success_text' AND draft_value = 'Ban da dang ky nhan tin khuyen mai thanh cong.';

UPDATE storefront_settings SET draft_value = 'Freeship đơn từ 499K'
WHERE setting_key = 'service_shipping_title' AND draft_value = 'Freeship don tu 499K';

UPDATE storefront_settings SET draft_value = 'Thông tin ưu đãi rõ ràng ngay từ trang đầu để bạn chốt đơn nhanh hơn.'
WHERE setting_key = 'service_shipping_copy' AND draft_value = 'Thong tin uu dai ro rang ngay tu trang dau de ban chot don nhanh hon.';

UPDATE storefront_settings SET draft_value = 'Đổi trả trong 30 ngày'
WHERE setting_key = 'service_return_title' AND draft_value = 'Doi tra trong 30 ngay';

UPDATE storefront_settings SET draft_value = 'Yên tâm thử size và đổi mẫu nếu chưa thật sự phù hợp.'
WHERE setting_key = 'service_return_copy' AND draft_value = 'Yen tam thu size va doi mau neu chua that su phu hop.';

UPDATE storefront_settings SET draft_value = 'Hỗ trợ qua hotline và chat'
WHERE setting_key = 'service_consult_title' AND draft_value = 'Ho tro qua hotline va chat';

UPDATE storefront_settings SET draft_value = 'Dễ hỏi size, hỏi phối đồ và theo dõi đơn hàng khi cần.'
WHERE setting_key = 'service_consult_copy' AND draft_value = 'De hoi size, hoi phoi do va theo doi don hang khi can.';

UPDATE storefront_settings SET draft_value = 'Thanh toán rõ ràng'
WHERE setting_key = 'service_payment_title' AND draft_value = 'Thanh toan ro rang';

UPDATE storefront_settings SET draft_value = 'COD, VNPay và MoMo hiển thị sớm để người mua dễ lựa chọn.'
WHERE setting_key = 'service_payment_copy' AND draft_value = 'COD, VNPay va MoMo hien thi som de nguoi mua de lua chon.';

UPDATE storefront_settings SET draft_value = '[{"label":"Vận chuyển","url":"/policy/shipping"},{"label":"Đổi trả","url":"/policy/return"},{"label":"Thanh toán","url":"/policy/payment"},{"label":"Bảo mật thông tin","url":"/policy/privacy"}]'
WHERE setting_key = 'policy_links' AND draft_value = '[{"label":"Van chuyen","url":"/policy/shipping"},{"label":"Doi tra","url":"/policy/return"},{"label":"Thanh toan","url":"/policy/payment"},{"label":"Bao mat thong tin","url":"/policy/privacy"}]';

UPDATE storefront_settings SET draft_value = 'WIND OF FALL | Thời trang mỗi ngày'
WHERE setting_key = 'seo_title' AND draft_value = 'WIND OF FALL | Thoi trang moi ngay';

UPDATE storefront_settings SET draft_value = 'WIND OF FALL - mua sắm thời trang everyday cho nam, nữ và trẻ em.'
WHERE setting_key = 'meta_description' AND draft_value = 'WIND OF FALL - mua sam thoi trang everyday cho nam, nu va tre em.';

UPDATE storefront_settings SET draft_value = 'thời trang, quần áo, wind of fall'
WHERE setting_key = 'meta_keywords' AND draft_value = 'thoi trang, quan ao, wind of fall';

UPDATE storefront_settings SET draft_value = 'Thời trang everyday hiện đại, dễ mặc và dễ mua.'
WHERE setting_key = 'og_description' AND draft_value = 'Thoi trang everyday hien dai, de mac va de mua.';

UPDATE storefront_settings SET draft_value = 'Xin chào! Tôi là trợ lý AI của WIND OF FALL.'
WHERE setting_key = 'chat_greeting' AND draft_value = 'Xin chao! Toi la tro ly AI cua WIND OF FALL.';

UPDATE storefront_settings SET draft_value = 'Bạn cần hỗ trợ gì?'
WHERE setting_key = 'chat_prompt_text' AND draft_value = 'Ban can ho tro gi?';

UPDATE storefront_settings SET draft_value = 'Cảm ơn bạn đã đồng hành cùng WIND OF FALL.'
WHERE setting_key = 'email_footer_text' AND draft_value = 'Cam on ban da dong hanh cung WIND OF FALL.';

UPDATE storefront_settings SET draft_value = 'Đơn hàng online cần thanh toán trong thời hạn quy định để được xử lý.'
WHERE setting_key = 'payment_reminder_text' AND draft_value = 'Don hang online can thanh toan trong thoi han quy dinh de duoc xu ly.';

UPDATE storefront_settings SET draft_value = 'Website đang bảo trì, vui lòng quay lại sau.'
WHERE setting_key = 'maintenance_message' AND draft_value = 'Website dang bao tri, vui long quay lai sau.';
