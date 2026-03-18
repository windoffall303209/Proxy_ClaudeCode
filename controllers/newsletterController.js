/**
 * =============================================================================
 * NEWSLETTER CONTROLLER - Điều khiển đăng ký nhận tin khuyến mãi
 * =============================================================================
 */

const Newsletter = require('../models/Newsletter');
const emailService = require('../services/emailService');

/**
 * Đăng ký nhận tin khuyến mãi
 */
exports.subscribe = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng nhập email'
            });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Email không hợp lệ'
            });
        }

        // Lấy user_id nếu đã đăng nhập
        const userId = req.user ? req.user.id : null;

        const result = await Newsletter.subscribe(email, userId);

        if (!result.success) {
            return res.status(400).json(result);
        }

        // Gửi email xác nhận đăng ký nhận tin
        try {
            await emailService.sendNewsletterWelcomeEmail(email);
            console.log('✅ Newsletter welcome email sent to:', email);
        } catch (emailError) {
            console.error('⚠️ Failed to send newsletter welcome email:', emailError.message);
            // Không block response nếu gửi email thất bại
        }

        res.json(result);
    } catch (error) {
        console.error('Newsletter subscribe error:', error);
        res.status(500).json({
            success: false,
            message: 'Đã xảy ra lỗi. Vui lòng thử lại sau.'
        });
    }
};

/**
 * Hủy đăng ký nhận tin
 */
exports.unsubscribe = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng nhập email'
            });
        }

        const result = await Newsletter.unsubscribe(email);

        if (!result.success) {
            return res.status(400).json(result);
        }

        res.json(result);
    } catch (error) {
        console.error('Newsletter unsubscribe error:', error);
        res.status(500).json({
            success: false,
            message: 'Đã xảy ra lỗi. Vui lòng thử lại sau.'
        });
    }
};

/**
 * Kiểm tra trạng thái đăng ký (cho user đã đăng nhập)
 */
exports.checkStatus = async (req, res) => {
    try {
        if (!req.user) {
            return res.json({ subscribed: false });
        }

        const subscribed = await Newsletter.isUserSubscribed(req.user.id);
        res.json({ subscribed });
    } catch (error) {
        console.error('Newsletter check status error:', error);
        res.status(500).json({ subscribed: false });
    }
};
