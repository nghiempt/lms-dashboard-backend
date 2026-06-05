import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser, Public } from '../../common/decorators';
import {
  PaymentsService,
  SepayWebhookPayload,
} from './payments.service';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  /** Học viên: lấy thông tin/QR thanh toán cho 1 đơn. */
  @ApiBearerAuth()
  @Post('orders/:orderId/checkout')
  checkout(@CurrentUser() user: AuthUser, @Param('orderId') orderId: string) {
    return this.payments.createPaymentInfo(user.id, orderId);
  }

  /** Học viên: poll trạng thái thanh toán của đơn (để FE tự cập nhật UI). */
  @ApiBearerAuth()
  @Get('orders/:orderId/status')
  status(@CurrentUser() user: AuthUser, @Param('orderId') orderId: string) {
    return this.payments.getPaymentStatus(user.id, orderId);
  }

  /** Webhook SePay (public, xác thực bằng API key trong header). */
  @Public()
  @HttpCode(200)
  @Post('sepay/webhook')
  sepayWebhook(
    @Headers('authorization') authorization: string,
    @Body() payload: SepayWebhookPayload,
  ) {
    return this.payments.handleSepayWebhook(authorization, payload);
  }
}
