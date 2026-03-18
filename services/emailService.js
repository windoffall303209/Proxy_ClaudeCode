const { Resend } = require('resend');
require('dotenv').config();

class EmailService {
    constructor() {
        this.resend = null;

        // Initialize Resend
        if (process.env.RESEND_API_KEY) {
            try {
                this.resend = new Resend(process.env.RESEND_API_KEY);
                console.log('✅ Resend email service initialized');
            } catch (error) {
                console.error('❌ Resend initialization failed:', error.message);
            }
        } else {
            console.error('❌ RESEND_API_KEY is not configured in .env');
        }
    }

    // Core send method - Resend only
    async sendEmail(to, subject, html) {
        if (!this.resend) {
            console.error('❌ Resend service is not initialized. Cannot send email.');
            return false;
        }

        try {
            console.log('📧 Sending email via Resend to:', to);
            const fromAddress = process.env.RESEND_FROM || 'onboarding@resend.dev';

            const result = await this.resend.emails.send({
                from: fromAddress,
                to: to,
                subject: subject,
                html: html
            });

            if (result.data) {
                console.log('✅ Email sent successfully to:', to);
                return true;
            }

            if (result.error) {
                console.error('❌ Resend error:', result.error.message);
                return false;
            }
        } catch (error) {
            console.error('❌ Email sending failed:', error.message);
        }

        return false;
    }

    // Send welcome email on registration
    async sendWelcomeEmail(user) {
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #333;">Xin chào ${user.full_name}!</h2>
                <p>Cảm ơn bạn đã đăng ký tài khoản tại Fashion Store.</p>
                <p>Chúng tôi rất vui khi bạn trở thành thành viên của cộng đồng thời trang của chúng tôi.</p>
                <h3>Ưu đãi đặc biệt cho thành viên mới:</h3>
                <ul>
                    <li>Giảm 10% cho đơn hàng đầu tiên</li>
                    <li>Miễn phí vận chuyển cho đơn từ 500.000đ</li>
                    <li>Tích điểm cho mỗi đơn hàng</li>
                </ul>
                <p>Bắt đầu mua sắm ngay hôm nay!</p>
                <a href="${process.env.BASE_URL || 'http://localhost:3000'}"
                   style="display: inline-block; padding: 10px 20px; background-color: #000; color: #fff; text-decoration: none; border-radius: 5px;">
                    Khám phá ngay
                </a>
                <br><br>
                <p style="color: #666; font-size: 12px;">
                    Fashion Store - Cửa hàng thời trang hàng đầu Việt Nam<br>
                    123 Nguyễn Huệ, Quận 1, TP. Hồ Chí Minh<br>
                    Hotline: 1900 123 456
                </p>
            </div>
        `;

        return await this.sendEmail(user.email, 'Chào mừng đến với Fashion Store!', html);
    }

    // Send order confirmation email
    async sendOrderConfirmation(order) {
        const itemsHtml = order.items.map(item => `
            <tr>
                <td style="padding: 10px; border-bottom: 1px solid #ddd;">
                    <img src="${item.product_image}" alt="${item.product_name}" style="width: 60px; height: 60px; object-fit: cover;">
                </td>
                <td style="padding: 10px; border-bottom: 1px solid #ddd;">${item.product_name}</td>
                <td style="padding: 10px; border-bottom: 1px solid #ddd;">${item.quantity}</td>
                <td style="padding: 10px; border-bottom: 1px solid #ddd;">${item.price.toLocaleString('vi-VN')}đ</td>
                <td style="padding: 10px; border-bottom: 1px solid #ddd;">${item.subtotal.toLocaleString('vi-VN')}đ</td>
            </tr>
        `).join('');

        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #333;">Cảm ơn bạn đã đặt hàng!</h2>
                <p>Xin chào ${order.user_name},</p>
                <p>Đơn hàng của bạn đã được xác nhận thành công.</p>

                <div style="background-color: #f5f5f5; padding: 15px; margin: 20px 0; border-radius: 5px;">
                    <h3 style="margin: 0 0 10px 0;">Thông tin đơn hàng</h3>
                    <p><strong>Mã đơn hàng:</strong> ${order.order_code}</p>
                    <p><strong>Ngày đặt:</strong> ${new Date(order.created_at).toLocaleString('vi-VN')}</p>
                    <p><strong>Phương thức thanh toán:</strong> ${this.getPaymentMethodText(order.payment_method)}</p>
                </div>

                <div style="background-color: #f5f5f5; padding: 15px; margin: 20px 0; border-radius: 5px;">
                    <h3 style="margin: 0 0 10px 0;">Địa chỉ giao hàng</h3>
                    <p><strong>${order.shipping_name}</strong></p>
                    <p>${order.shipping_phone}</p>
                    <p>${order.address_line}, ${order.ward ? order.ward + ', ' : ''}${order.district ? order.district + ', ' : ''}${order.city}</p>
                </div>

                <h3>Chi tiết đơn hàng</h3>
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background-color: #f5f5f5;">
                            <th style="padding: 10px; text-align: left;">Hình ảnh</th>
                            <th style="padding: 10px; text-align: left;">Sản phẩm</th>
                            <th style="padding: 10px; text-align: left;">SL</th>
                            <th style="padding: 10px; text-align: left;">Giá</th>
                            <th style="padding: 10px; text-align: left;">Tổng</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHtml}
                    </tbody>
                </table>

                <div style="margin-top: 20px; text-align: right;">
                    <p><strong>Tạm tính:</strong> ${order.total_amount.toLocaleString('vi-VN')}đ</p>
                    <p><strong>Phí vận chuyển:</strong> ${order.shipping_fee.toLocaleString('vi-VN')}đ</p>
                    <h3 style="color: #d32f2f;"><strong>Tổng cộng:</strong> ${order.final_amount.toLocaleString('vi-VN')}đ</h3>
                </div>

                <p style="margin-top: 30px;">Chúng tôi sẽ liên hệ với bạn sớm nhất để xác nhận đơn hàng.</p>
                <p>Cảm ơn bạn đã tin tưởng Fashion Store!</p>

                <br>
                <p style="color: #666; font-size: 12px;">
                    Nếu bạn có bất kỳ câu hỏi nào, vui lòng liên hệ:<br>
                    Email: info@fashionstore.vn<br>
                    Hotline: 1900 123 456
                </p>
            </div>
        `;

        return await this.sendEmail(order.user_email, `Xác nhận đơn hàng #${order.order_code}`, html);
    }

    // Send marketing campaign email
    async sendMarketingEmail(users, campaign) {
        const results = await Promise.all(users.map(async user => {
            const html = campaign.content.replace('{{name}}', user.full_name);
            const success = await this.sendEmail(user.email, campaign.subject, html);
            return { success, email: user.email };
        }));

        const successCount = results.filter(r => r.success).length;
        console.log(`✅ Marketing email sent: ${successCount}/${users.length}`);
        return { total: users.length, success: successCount };
    }

    // Send password reset email (legacy - with link)
    async sendPasswordResetEmail(user, resetToken) {
        const resetUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/auth/reset-password?token=${resetToken}`;

        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #333;">Đặt lại mật khẩu</h2>
                <p>Xin chào ${user.full_name},</p>
                <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.</p>
                <p>Vui lòng click vào nút bên dưới để đặt lại mật khẩu:</p>
                <a href="${resetUrl}"
                   style="display: inline-block; padding: 10px 20px; background-color: #d32f2f; color: #fff; text-decoration: none; border-radius: 5px; margin: 20px 0;">
                    Đặt lại mật khẩu
                </a>
                <p style="color: #666;">Link này sẽ hết hạn sau 1 giờ.</p>
                <p style="color: #666;">Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.</p>
            </div>
        `;

        return await this.sendEmail(user.email, 'Đặt lại mật khẩu - Fashion Store', html);
    }

    // Helper method
    getPaymentMethodText(method) {
        const methods = {
            'cod': 'Thanh toán khi nhận hàng (COD)',
            'vnpay': 'VNPay',
            'momo': 'MoMo'
        };
        return methods[method] || method;
    }

    // Send email verification code (6 digits)
    async sendVerificationEmail(user, verificationCode) {
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <h1 style="color: #000; margin: 0;">WIND OF FALL</h1>
                    <p style="color: #666; margin: 5px 0;">Thời Trang Cao Cấp</p>
                </div>

                <h2 style="color: #333; text-align: center;">Xác nhận địa chỉ email</h2>

                <p>Xin chào <strong>${user.full_name}</strong>,</p>
                <p>Cảm ơn bạn đã đăng ký tài khoản tại WIND OF FALL. Vui lòng sử dụng mã xác nhận bên dưới để hoàn tất quá trình đăng ký:</p>

                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px; text-align: center; margin: 30px 0;">
                    <p style="color: #fff; margin: 0 0 10px 0; font-size: 14px;">Mã xác nhận của bạn</p>
                    <div style="background: #fff; display: inline-block; padding: 15px 40px; border-radius: 8px;">
                        <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #333;">${verificationCode}</span>
                    </div>
                </div>

                <p style="color: #e53935; font-weight: 500;">Mã này sẽ hết hạn sau 10 phút.</p>

                <p style="color: #666;">Nếu bạn không yêu cầu xác nhận email này, vui lòng bỏ qua email này.</p>

                <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

                <p style="color: #999; font-size: 12px; text-align: center;">
                    WIND OF FALL - Thời Trang Cao Cấp<br>
                    Email này được gửi tự động, vui lòng không trả lời.
                </p>
            </div>
        `;

        return await this.sendEmail(user.email, 'Xác nhận email - WIND OF FALL', html);
    }

    // Send password reset code (6 digits)
    async sendPasswordResetCode(user, resetCode) {
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <h1 style="color: #000; margin: 0;">WIND OF FALL</h1>
                    <p style="color: #666; margin: 5px 0;">Thời Trang Cao Cấp</p>
                </div>

                <h2 style="color: #333; text-align: center;">Đặt lại mật khẩu</h2>

                <p>Xin chào <strong>${user.full_name}</strong>,</p>
                <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn. Vui lòng sử dụng mã xác nhận bên dưới:</p>

                <div style="background: linear-gradient(135deg, #e53935 0%, #ff5252 100%); padding: 30px; border-radius: 10px; text-align: center; margin: 30px 0;">
                    <p style="color: #fff; margin: 0 0 10px 0; font-size: 14px;">Mã đặt lại mật khẩu</p>
                    <div style="background: #fff; display: inline-block; padding: 15px 40px; border-radius: 8px;">
                        <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #333;">${resetCode}</span>
                    </div>
                </div>

                <p style="color: #e53935; font-weight: 500;">⚠️ Mã này sẽ hết hạn sau 10 phút.</p>

                <p style="color: #666;">Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này. Tài khoản của bạn vẫn an toàn.</p>

                <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

                <p style="color: #999; font-size: 12px; text-align: center;">
                    WIND OF FALL - Thời Trang Cao Cấp<br>
                    Email này được gửi tự động, vui lòng không trả lời.
                </p>
            </div>
        `;

        return await this.sendEmail(user.email, 'Đặt lại mật khẩu - WIND OF FALL', html);
    }

    // Send newsletter subscription confirmation email
    async sendNewsletterWelcomeEmail(email) {
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <h1 style="color: #000; margin: 0;">WIND OF FALL</h1>
                    <p style="color: #666; margin: 5px 0;">Thời Trang Cao Cấp</p>
                </div>

                <div style="background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); padding: 30px; border-radius: 10px; text-align: center; margin: 20px 0;">
                    <div style="font-size: 48px; margin-bottom: 10px;">🎉</div>
                    <h2 style="color: #fff; margin: 0;">Đăng ký thành công!</h2>
                </div>

                <p style="font-size: 16px; color: #333;">Xin chào bạn,</p>
                <p style="font-size: 15px; color: #555; line-height: 1.6;">
                    Cảm ơn bạn đã đăng ký nhận tin khuyến mãi từ <strong>WIND OF FALL</strong>! 
                    Từ giờ, bạn sẽ là người đầu tiên nhận được những thông tin về:
                </p>

                <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <ul style="list-style: none; padding: 0; margin: 0;">
                        <li style="padding: 8px 0; font-size: 15px; color: #333;">🏷️ Chương trình <strong>giảm giá độc quyền</strong></li>
                        <li style="padding: 8px 0; font-size: 15px; color: #333;">👗 Bộ sưu tập <strong>mới nhất</strong> mỗi mùa</li>
                        <li style="padding: 8px 0; font-size: 15px; color: #333;">🎁 Ưu đãi đặc biệt dành riêng cho thành viên</li>
                        <li style="padding: 8px 0; font-size: 15px; color: #333;">🔥 Flash sale và sự kiện <strong>hot</strong></li>
                    </ul>
                </div>

                <div style="text-align: center; margin: 30px 0;">
                    <a href="${process.env.BASE_URL || 'http://localhost:3000'}"
                       style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #000 0%, #333 100%); color: #fff; text-decoration: none; border-radius: 8px; font-size: 15px; font-weight: 600;">
                        Khám phá ngay
                    </a>
                </div>

                <p style="font-size: 14px; color: #888; line-height: 1.5;">
                    Nếu bạn muốn ngừng nhận tin, bạn có thể hủy đăng ký bất cứ lúc nào.
                </p>

                <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

                <p style="color: #999; font-size: 12px; text-align: center;">
                    WIND OF FALL - Thời Trang Cao Cấp<br>
                    Email này được gửi tự động, vui lòng không trả lời.
                </p>
            </div>
        `;

        return await this.sendEmail(email, 'Cảm ơn bạn đã đăng ký nhận tin - WIND OF FALL', html);
    }
}

module.exports = new EmailService();
