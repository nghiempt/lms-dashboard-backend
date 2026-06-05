import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EnrollmentStatus,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import { paginate } from '../../common/dto/pagination.dto';
import { addDays, generateCode } from '../../common/utils';
import { MailService } from '../../integrations/mail/mail.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';
import {
  CreateOrderDto,
  ListOrdersQueryDto,
} from './dto/orders.dto';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly activity: ActivityService,
  ) {}

  // ====================================================
  //  CREATE (CHECKOUT)
  // ====================================================
  async create(userId: string, dto: CreateOrderDto) {
    const courses = await this.prisma.course.findMany({
      where: { id: { in: dto.courseIds }, status: 'PUBLISHED' },
    });
    if (courses.length !== dto.courseIds.length) {
      throw new BadRequestException('Một số khoá học không hợp lệ.');
    }

    // bỏ những khoá đã sở hữu
    const owned = await this.prisma.enrollment.findMany({
      where: { userId, courseId: { in: dto.courseIds } },
      select: { courseId: true },
    });
    const ownedSet = new Set(owned.map((o) => o.courseId));
    const toBuy = courses.filter((c) => !ownedSet.has(c.id));
    if (toBuy.length === 0) {
      throw new BadRequestException('Bạn đã sở hữu tất cả khoá học này.');
    }

    const subtotal = toBuy.reduce((s, c) => s + Number(c.price), 0);

    const order = await this.prisma.order.create({
      data: {
        code: generateCode('INV'),
        userId,
        status: OrderStatus.PENDING,
        subtotal,
        discount: 0,
        total: subtotal,
        note: dto.note,
        expiresAt: addDays(new Date(), 1),
        items: {
          create: toBuy.map((c) => ({
            courseId: c.id,
            title: c.title,
            price: c.price,
          })),
        },
      },
      include: { items: true },
    });

    // khoá miễn phí -> fulfill ngay
    if (subtotal === 0) {
      await this.markPaid(order.id, PaymentMethod.FREE);
      return this.getOne(userId, order.id);
    }
    return order;
  }

  // ====================================================
  //  FULFILLMENT — gọi khi thanh toán thành công
  // ====================================================
  async markPaid(
    orderId: string,
    method: PaymentMethod,
    meta?: { transactionId?: string; referenceCode?: string; rawPayload?: unknown },
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { course: true } }, user: true },
    });
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng.');
    if (order.status === OrderStatus.PAID) return order; // idempotent

    await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.PAID, paidAt: new Date() },
      });

      // Đối soát: nếu đã có payment PENDING (tạo ở bước checkout/QR) thì cập
      // nhật chính bản ghi đó -> SUCCESS, tránh tạo payment trùng và đảm bảo
      // bản ghi mà UI đang theo dõi chuyển trạng thái.
      const pending = await tx.payment.findFirst({
        where: { orderId, status: PaymentStatus.PENDING },
        orderBy: { createdAt: 'desc' },
      });
      const paymentData = {
        method,
        status: PaymentStatus.SUCCESS,
        amount: order.total,
        transactionId: meta?.transactionId,
        referenceCode: meta?.referenceCode,
        rawPayload: (meta?.rawPayload as Prisma.InputJsonValue) ?? undefined,
        paidAt: new Date(),
      };
      if (pending) {
        await tx.payment.update({
          where: { id: pending.id },
          data: paymentData,
        });
      } else {
        await tx.payment.create({
          data: { orderId, userId: order.userId, ...paymentData },
        });
      }

      // tạo enrollment cho từng khoá
      for (const item of order.items) {
        const expiresAt = item.course.accessDurationDays
          ? addDays(new Date(), item.course.accessDurationDays)
          : null;
        await tx.enrollment.upsert({
          where: {
            userId_courseId: { userId: order.userId, courseId: item.courseId },
          },
          create: {
            userId: order.userId,
            courseId: item.courseId,
            orderId,
            status: EnrollmentStatus.LEARNING,
            expiresAt,
          },
          update: { status: EnrollmentStatus.LEARNING, expiresAt },
        });
      }
    });

    // email xác nhận
    await this.mail.sendOrderPaid(
      order.user.email,
      order.user.fullName,
      order.code,
      Number(order.total).toLocaleString('vi-VN'),
    );

    await this.activity.log({
      userId: order.userId,
      type: 'PURCHASE',
      action: `Mua ${order.items.map((i) => i.title).join(', ')}`,
      meta: { orderCode: order.code, total: Number(order.total) },
    });

    return this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, payments: true },
    });
  }

  // ====================================================
  //  STUDENT QUERIES (Payment tab)
  // ====================================================
  async myOrders(userId: string, query: ListOrdersQueryDto) {
    const where: Prisma.OrderWhereInput = { userId };
    if (query.status) where.status = query.status;
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: query.sortOrder },
        skip: query.skip,
        take: query.limit,
        include: { items: true, payments: true },
      }),
      this.prisma.order.count({ where }),
    ]);
    return paginate(rows, total, query.page, query.limit);
  }

  async getOne(userId: string, id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, userId },
      include: { items: true, payments: true },
    });
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng.');
    return order;
  }

  /** Tổng quan thanh toán của học viên (3 stat card ở Payment tab). */
  async mySummary(userId: string) {
    const [paidAgg, ownedCount, pendingCount] = await this.prisma.$transaction([
      this.prisma.order.aggregate({
        where: { userId, status: OrderStatus.PAID },
        _sum: { total: true },
      }),
      this.prisma.enrollment.count({ where: { userId } }),
      this.prisma.order.count({
        where: { userId, status: OrderStatus.PENDING },
      }),
    ]);
    return {
      totalPaid: Number(paidAgg._sum.total ?? 0),
      coursesOwned: ownedCount,
      pendingInvoices: pendingCount,
    };
  }

  async cancel(userId: string, id: string) {
    const order = await this.getOne(userId, id);
    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException('Chỉ huỷ được đơn đang chờ thanh toán.');
    }
    return this.prisma.order.update({
      where: { id },
      data: { status: OrderStatus.CANCELLED },
    });
  }

  // ====================================================
  //  ADMIN
  // ====================================================
  async listAll(query: ListOrdersQueryDto) {
    const where: Prisma.OrderWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.userId) where.userId = query.userId;
    if (query.search) where.code = { contains: query.search, mode: 'insensitive' };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: query.sortOrder },
        skip: query.skip,
        take: query.limit,
        include: {
          items: true,
          payments: true,
          user: { select: { id: true, fullName: true, email: true } },
        },
      }),
      this.prisma.order.count({ where }),
    ]);
    return paginate(rows, total, query.page, query.limit);
  }

  /** Admin xác nhận chuyển khoản thủ công. */
  async adminConfirm(id: string, referenceCode?: string) {
    return this.markPaid(id, PaymentMethod.BANK_TRANSFER, { referenceCode });
  }

  /** Admin hoàn tiền 1 đơn đã thanh toán. */
  async adminRefund(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng.');
    if (order.status !== OrderStatus.PAID) {
      throw new BadRequestException('Chỉ hoàn tiền đơn đã thanh toán.');
    }
    await this.prisma.$transaction([
      this.prisma.order.update({
        where: { id },
        data: { status: OrderStatus.REFUNDED },
      }),
      this.prisma.payment.updateMany({
        where: { orderId: id },
        data: { status: PaymentStatus.REFUNDED },
      }),
      // gỡ quyền học các khoá trong đơn
      this.prisma.enrollment.updateMany({
        where: {
          userId: order.userId,
          courseId: { in: order.items.map((i) => i.courseId) },
        },
        data: { status: EnrollmentStatus.EXPIRED },
      }),
    ]);
    return this.prisma.order.findUnique({
      where: { id },
      include: { items: true, payments: true },
    });
  }

  /** Tổng quan đơn hàng cho admin (4 thẻ ở /admin/orders). */
  async adminSummary() {
    const [revenue, successCount, pendingCount, refundCount] =
      await this.prisma.$transaction([
        this.prisma.order.aggregate({
          where: { status: OrderStatus.PAID },
          _sum: { total: true },
        }),
        this.prisma.order.count({ where: { status: OrderStatus.PAID } }),
        this.prisma.order.count({ where: { status: OrderStatus.PENDING } }),
        this.prisma.order.count({ where: { status: OrderStatus.REFUNDED } }),
      ]);
    return {
      totalRevenue: Number(revenue._sum.total ?? 0),
      successCount,
      pendingCount,
      refundCount,
    };
  }

  async findByCode(code: string) {
    return this.prisma.order.findUnique({ where: { code } });
  }
}
