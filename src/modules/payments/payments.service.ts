import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderStatus, PaymentMethod } from '@prisma/client';
import { AppConfig } from '../../config/configuration';
import { PrismaService } from '../../prisma/prisma.service';
import { OrdersService } from '../orders/orders.service';

export interface SepayWebhookPayload {
  id?: number | string;
  gateway?: string;
  transactionDate?: string;
  accountNumber?: string;
  content?: string; // nội dung CK, chứa mã đơn (INV-xxxxxx)
  transferType?: 'in' | 'out';
  transferAmount?: number;
  referenceCode?: string;
  [k: string]: unknown;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  /**
   * Tạo thông tin thanh toán cho đơn: trả về tài khoản ngân hàng + QR SePay
   * (VietQR). Học viên chuyển khoản với nội dung = mã đơn để SePay đối soát.
   */
  async createPaymentInfo(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
    });
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng.');
    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException('Đơn hàng không ở trạng thái chờ thanh toán.');
    }

    const sepay = this.config.get('sepay', { infer: true });
    const amount = Number(order.total);
    const content = order.code; // nội dung CK

    // QR VietQR chuẩn (img.vietqr.io) — SePay lắng nghe biến động số dư
    const qrUrl =
      `https://qr.sepay.vn/img?acc=${sepay.bankAccount}` +
      `&bank=${sepay.bankName}&amount=${amount}&des=${encodeURIComponent(content)}`;

    // tạo bản ghi payment PENDING
    await this.prisma.payment.create({
      data: {
        orderId: order.id,
        userId,
        method: PaymentMethod.SEPAY,
        amount: order.total,
        referenceCode: content,
        bankAccount: sepay.bankAccount,
        bankName: sepay.bankName,
      },
    });

    return {
      orderCode: order.code,
      amount,
      currency: order.currency,
      transferContent: content,
      bank: {
        accountNumber: sepay.bankAccount,
        bankName: sepay.bankName,
        accountHolder: sepay.accountHolder,
      },
      qrUrl,
      expiresAt: order.expiresAt,
    };
  }

  /**
   * Trạng thái thanh toán của 1 đơn — dùng cho FE poll khi đang hiển thị QR.
   * Trả về gọn nhẹ để FE tự cập nhật UI sang "success" mà không cần F5.
   */
  async getPaymentStatus(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      select: { id: true, code: true, status: true, paidAt: true },
    });
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng.');
    return {
      orderId: order.id,
      orderCode: order.code,
      status: order.status,
      paid: order.status === OrderStatus.PAID,
      paidAt: order.paidAt,
    };
  }

  /**
   * Webhook SePay gọi về khi có biến động số dư.
   * Xác thực API key, parse mã đơn từ nội dung CK, fulfill order.
   * SePay gửi header: Authorization: Apikey <SEPAY_WEBHOOK_API_KEY>
   */
  async handleSepayWebhook(
    authorization: string | undefined,
    payload: SepayWebhookPayload,
  ) {
    const expected = this.config.get('sepay', { infer: true }).webhookApiKey;
    const provided = (authorization ?? '').replace(/^Apikey\s+/i, '').trim();
    if (!expected || provided !== expected) {
      throw new BadRequestException('Webhook không hợp lệ (sai API key).');
    }

    this.logger.log(
      `SePay webhook: id=${payload.id} type=${payload.transferType} ` +
        `amount=${payload.transferAmount} content="${payload.content}"`,
    );

    // chỉ xử lý giao dịch tiền vào
    if (payload.transferType && payload.transferType !== 'in') {
      return { success: true, message: 'Bỏ qua giao dịch tiền ra.' };
    }

    const code = this.extractOrderCode(payload.content ?? '');
    if (!code) {
      this.logger.warn(`Webhook không tìm thấy mã đơn: ${payload.content}`);
      return { success: true, message: 'Không khớp đơn hàng.' };
    }

    const order = await this.orders.findByCode(code);
    if (!order) {
      this.logger.warn(`Webhook: đơn ${code} không tồn tại.`);
      return { success: true, message: 'Đơn không tồn tại.' };
    }
    if (order.status === OrderStatus.PAID) {
      return { success: true, message: 'Đơn đã thanh toán.' };
    }

    // (tuỳ chọn) kiểm tra số tiền khớp
    if (
      payload.transferAmount &&
      Number(payload.transferAmount) < Number(order.total)
    ) {
      this.logger.warn(
        `Webhook: số tiền ${payload.transferAmount} < tổng đơn ${order.total}`,
      );
    }

    await this.orders.markPaid(order.id, PaymentMethod.SEPAY, {
      transactionId: String(payload.id ?? payload.referenceCode ?? ''),
      referenceCode: payload.referenceCode,
      rawPayload: payload,
    });

    this.logger.log(`Webhook: đã ghi nhận thanh toán đơn ${code}.`);
    return { success: true, message: `Đã ghi nhận thanh toán đơn ${code}.` };
  }

  /**
   * Lấy mã đơn (INV-XXXXXX) từ nội dung chuyển khoản.
   * Ngân hàng thường bỏ dấu gạch nối hoặc chèn khoảng trắng, nên chấp nhận
   * "INV-123456", "INV123456", "INV 123456" rồi chuẩn hoá lại "INV-123456".
   */
  private extractOrderCode(content: string): string | null {
    const match = content.toUpperCase().match(/INV[-\s]?(\d{6})/);
    if (!match) return null;
    return `INV-${match[1]}`;
  }
}
