// Khai báo nguồn kiến thức tĩnh để chatbot RAG trả lời theo dữ liệu cửa hàng.
module.exports = [
    {
        sourceKey: 'store-overview',
        title: 'Thông tin cửa hàng WIND OF FALL',
        content: [
            'WIND OF FALL là cửa hàng thời trang chuyên sản phẩm nam và nữ.',
            'Chatbot có nhiệm vụ tư vấn sản phẩm, hướng dẫn mua hàng và trả lời các câu hỏi cơ bản của khách.',
            'Nếu cần hỗ trợ sâu hơn hoặc tình huống phức tạp, admin sẽ tiếp nhận để hỗ trợ thêm.'
        ].join(' ')
    },
    {
        sourceKey: 'payment-methods',
        title: 'Phương thức thanh toán',
        content: [
            'Cửa hàng hỗ trợ thanh toán COD, VNPay và MoMo.',
            'Khi tư vấn cho khách, chatbot chỉ được nói đúng các phương thức này và không tự ý bổ sung phương thức mới.'
        ].join(' ')
    },
    {
        sourceKey: 'shipping-coverage',
        title: 'Phạm vi giao hàng',
        content: [
            'WIND OF FALL giao hàng toàn quốc.',
            'Chatbot có thể thông báo cửa hàng giao hàng trên toàn quốc và mời khách liên hệ admin nếu cần hỗ trợ chi tiết hơn về đơn hàng.'
        ].join(' ')
    },
    {
        sourceKey: 'image-search-support',
        title: 'Tìm sản phẩm bằng hình ảnh',
        content: [
            'Khách có thể gửi ảnh sản phẩm trong khung chat để chatbot tìm các mẫu gần nhất trong catalog.',
            'Nếu catalog không có sản phẩm cùng loại hoặc đủ gần, chatbot phải nói rõ là chưa có mẫu phù hợp thay vì gợi ý sai.'
        ].join(' ')
    }
];
