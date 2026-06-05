import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { AppConfig } from '../../config/configuration';

/**
 * Gửi email qua SMTP (xác thực tài khoản, reset mật khẩu, thông báo).
 * Nếu chưa cấu hình SMTP -> log nội dung thay vì gửi (an toàn cho dev).
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private readonly config: ConfigService<AppConfig, true>) {
    const mail = this.config.get('mail', { infer: true });
    if (mail.host && mail.user) {
      this.transporter = nodemailer.createTransport({
        host: mail.host,
        port: mail.port,
        secure: mail.secure,
        auth: { user: mail.user, pass: mail.password },
        // Tránh treo request khi server không ra được SMTP (vd port 587 bị
        // chặn): fail nhanh thay vì chờ tới khi nginx cắt 504.
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 15_000,
      });
    } else {
      this.logger.warn('SMTP chưa cấu hình — email sẽ được log thay vì gửi.');
    }
  }

  private async send(to: string, subject: string, html: string): Promise<void> {
    const mail = this.config.get('mail', { infer: true });
    if (!this.transporter) {
      this.logger.log(`[MAIL:DEV] to=${to} subject="${subject}"`);
      return;
    }
    await this.transporter.sendMail({
      from: `"${mail.fromName}" <${mail.fromAddress}>`,
      to,
      subject,
      html,
    });
  }

  async sendVerifyEmail(to: string, name: string, link: string): Promise<void> {
    await this.send(
      to,
      'Xác thực tài khoản — VIDEO EDITOR LMS',
      `<p>Chào ${name},</p>
       <p>Nhấn vào liên kết bên dưới để xác thực email của bạn:</p>
       <p><a href="${link}">${link}</a></p>
       <p>Liên kết có hiệu lực trong 24 giờ.</p>`,
    );
  }

  async sendResetPassword(
    to: string,
    name: string,
    link: string,
  ): Promise<void> {
    await this.send(
      to,
      'Đặt lại mật khẩu — VIDEO EDITOR LMS',
      `<p>Chào ${name},</p>
       <p>Bạn vừa yêu cầu đặt lại mật khẩu. Nhấn vào liên kết:</p>
       <p><a href="${link}">${link}</a></p>
       <p>Nếu không phải bạn, hãy bỏ qua email này. Liên kết hiệu lực 1 giờ.</p>`,
    );
  }

  async sendOrderPaid(
    to: string,
    name: string,
    orderCode: string,
    amount: string,
  ): Promise<void> {
    await this.send(
      to,
      `Thanh toán thành công — ${orderCode}`,
      `<p>Chào ${name},</p>
       <p>Đơn hàng <b>${orderCode}</b> đã được thanh toán thành công với số tiền <b>${amount}đ</b>.</p>
       <p>Bạn có thể bắt đầu học ngay bây giờ. Chúc bạn học tốt!</p>`,
    );
  }

  async sendGenericNotification(
    to: string,
    title: string,
    body: string,
  ): Promise<void> {
    await this.send(to, title, `<p>${body}</p>`);
  }
}
