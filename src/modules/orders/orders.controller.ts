import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { AuthUser, CurrentUser, Roles } from '../../common/decorators';
import {
  ConfirmOrderDto,
  CreateOrderDto,
  ListOrdersQueryDto,
} from './dto/orders.dto';
import { OrdersService } from './orders.service';

@ApiTags('Orders')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  // ----- STUDENT -----
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateOrderDto) {
    return this.orders.create(user.id, dto);
  }

  @Get('my')
  myOrders(@CurrentUser() user: AuthUser, @Query() query: ListOrdersQueryDto) {
    return this.orders.myOrders(user.id, query);
  }

  @Get('my/summary')
  mySummary(@CurrentUser() user: AuthUser) {
    return this.orders.mySummary(user.id);
  }

  @Get('my/:id')
  getOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.orders.getOne(user.id, id);
  }

  @Patch('my/:id/cancel')
  cancel(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.orders.cancel(user.id, id);
  }

  // ----- ADMIN -----
  @Get()
  @Roles(UserRole.ADMIN)
  listAll(@Query() query: ListOrdersQueryDto) {
    return this.orders.listAll(query);
  }

  @Get('summary')
  @Roles(UserRole.ADMIN)
  summary() {
    return this.orders.adminSummary();
  }

  @Patch(':id/confirm')
  @Roles(UserRole.ADMIN)
  confirm(@Param('id') id: string, @Body() dto: ConfirmOrderDto) {
    return this.orders.adminConfirm(id, dto.referenceCode);
  }

  @Patch(':id/refund')
  @Roles(UserRole.ADMIN)
  refund(@Param('id') id: string) {
    return this.orders.adminRefund(id);
  }
}
