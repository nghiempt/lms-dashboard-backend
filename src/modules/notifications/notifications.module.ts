import {
  Body,
  Controller,
  Delete,
  Get,
  Injectable,
  Module,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PartialType } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  NotificationScope,
  NotificationType,
  Prisma,
  UserRole,
} from '@prisma/client';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AuthUser, CurrentUser, Roles } from '../../common/decorators';
import {
  paginate,
  PaginationQueryDto,
} from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';

// ---------- DTO ----------
class SendNotificationDto {
  @IsString() @MaxLength(200) title!: string;
  @IsString() body!: string;
  @IsOptional() @IsEnum(NotificationType) type?: NotificationType;
  @IsEnum(NotificationScope) scope!: NotificationScope; // ALL | USER | COURSE
  @IsOptional() @IsString() link?: string;
  /** bắt buộc khi scope = USER */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  userIds?: string[];
  /** bắt buộc khi scope = COURSE */
  @IsOptional() @IsString() courseId?: string;
  /** true = lưu nháp (chưa gửi tới người nhận) */
  @IsOptional() @IsBoolean() asDraft?: boolean;
}
class UpdateNotificationDto extends PartialType(SendNotificationDto) {}

// ---------- SERVICE ----------
@Injectable()
class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Tính danh sách người nhận theo scope. */
  private async resolveRecipients(dto: {
    scope: NotificationScope;
    userIds?: string[];
    courseId?: string;
  }): Promise<string[]> {
    if (dto.scope === NotificationScope.ALL) {
      const students = await this.prisma.user.findMany({
        where: { role: UserRole.STUDENT, status: 'ACTIVE' },
        select: { id: true },
      });
      return students.map((s) => s.id);
    }
    if (dto.scope === NotificationScope.COURSE) {
      if (!dto.courseId) return [];
      const enrolls = await this.prisma.enrollment.findMany({
        where: { courseId: dto.courseId },
        select: { userId: true },
      });
      return [...new Set(enrolls.map((e) => e.userId))];
    }
    return dto.userIds ?? []; // USER
  }

  /**
   * Admin tạo thông báo.
   * - asDraft=true: lưu nháp, không tạo recipients.
   * - ngược lại: gửi ngay tới recipients theo scope.
   */
  async send(senderId: string, dto: SendNotificationDto) {
    const draft = dto.asDraft === true;
    const targetIds = draft ? [] : await this.resolveRecipients(dto);

    const notification = await this.prisma.notification.create({
      data: {
        title: dto.title,
        body: dto.body,
        type: dto.type ?? NotificationType.SYSTEM,
        scope: dto.scope,
        courseId: dto.courseId,
        status: draft ? 'DRAFT' : 'SENT',
        sentAt: draft ? null : new Date(),
        link: dto.link,
        senderId,
        recipients: { create: targetIds.map((userId) => ({ userId })) },
      },
    });
    return { id: notification.id, status: notification.status, sentTo: targetIds.length };
  }

  /** Admin: danh sách thông báo đã tạo (gồm nháp). */
  async adminList(query: PaginationQueryDto) {
    const where: Prisma.NotificationWhereInput = {};
    if (query.search) where.title = { contains: query.search, mode: 'insensitive' };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: query.sortOrder },
        skip: query.skip,
        take: query.limit,
        include: { _count: { select: { recipients: true } } },
      }),
      this.prisma.notification.count({ where }),
    ]);
    return paginate(rows, total, query.page, query.limit);
  }

  /** Admin sửa thông báo — chỉ cho phép khi còn nháp (chưa gửi tới ai). */
  async adminUpdate(id: string, dto: UpdateNotificationDto) {
    const existing = await this.prisma.notification.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Không tìm thấy thông báo.');
    if (existing.status === 'SENT') {
      throw new BadRequestException(
        'Thông báo đã gửi không thể chỉnh sửa (người nhận đã nhận nội dung cũ).',
      );
    }
    return this.prisma.notification.update({
      where: { id },
      data: {
        title: dto.title,
        body: dto.body,
        type: dto.type,
        scope: dto.scope,
        courseId: dto.courseId,
        link: dto.link,
      },
    });
  }

  /** Admin gửi 1 thông báo nháp -> tạo recipients + đánh dấu SENT. */
  async adminSendDraft(id: string) {
    const n = await this.prisma.notification.findUnique({ where: { id } });
    if (!n) throw new NotFoundException('Không tìm thấy thông báo.');
    if (n.status === 'SENT') return { id, status: 'SENT', sentTo: 0 };

    const targetIds = await this.resolveRecipients({
      scope: n.scope,
      courseId: n.courseId ?? undefined,
    });
    await this.prisma.$transaction([
      this.prisma.notificationRecipient.createMany({
        data: targetIds.map((userId) => ({ notificationId: id, userId })),
        skipDuplicates: true,
      }),
      this.prisma.notification.update({
        where: { id },
        data: { status: 'SENT', sentAt: new Date() },
      }),
    ]);
    return { id, status: 'SENT', sentTo: targetIds.length };
  }

  async adminRemove(id: string) {
    await this.prisma.notification.delete({ where: { id } });
    return { deleted: true };
  }

  /** Học viên: danh sách thông báo của mình. */
  async myNotifications(
    userId: string,
    query: PaginationQueryDto & { unread?: string },
  ) {
    const where: Prisma.NotificationRecipientWhereInput = { userId };
    if (query.unread === 'true') where.isRead = false;

    const [rows, total, unreadCount] = await this.prisma.$transaction([
      this.prisma.notificationRecipient.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
        include: { notification: true },
      }),
      this.prisma.notificationRecipient.count({ where }),
      this.prisma.notificationRecipient.count({
        where: { userId, isRead: false },
      }),
    ]);

    const data = rows.map((r) => ({
      id: r.id,
      isRead: r.isRead,
      readAt: r.readAt,
      createdAt: r.createdAt,
      title: r.notification.title,
      body: r.notification.body,
      type: r.notification.type,
      link: r.notification.link,
    }));
    const result = paginate(data, total, query.page, query.limit);
    return { ...result, meta: { ...result.meta, unreadCount } };
  }

  async markRead(userId: string, recipientId: string) {
    await this.prisma.notificationRecipient.updateMany({
      where: { id: recipientId, userId },
      data: { isRead: true, readAt: new Date() },
    });
    return { read: true };
  }

  async markAllRead(userId: string) {
    await this.prisma.notificationRecipient.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    return { read: true };
  }
}

// ---------- CONTROLLER ----------
@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  // ----- STUDENT -----
  @Get('me')
  mine(
    @CurrentUser() user: AuthUser,
    @Query() query: PaginationQueryDto,
    @Query('unread') unread?: string,
  ) {
    return this.notifications.myNotifications(
      user.id,
      Object.assign(query, { unread }),
    );
  }

  @Patch('me/:id/read')
  read(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.notifications.markRead(user.id, id);
  }

  @Patch('me/read-all')
  readAll(@CurrentUser() user: AuthUser) {
    return this.notifications.markAllRead(user.id);
  }

  // ----- ADMIN -----
  @Roles(UserRole.ADMIN)
  @Get('admin')
  adminList(@Query() query: PaginationQueryDto) {
    return this.notifications.adminList(query);
  }

  @Roles(UserRole.ADMIN)
  @Post('send')
  send(@CurrentUser() user: AuthUser, @Body() dto: SendNotificationDto) {
    return this.notifications.send(user.id, dto);
  }

  @Roles(UserRole.ADMIN)
  @Patch('admin/:id')
  adminUpdate(@Param('id') id: string, @Body() dto: UpdateNotificationDto) {
    return this.notifications.adminUpdate(id, dto);
  }

  @Roles(UserRole.ADMIN)
  @Post('admin/:id/send')
  sendDraft(@Param('id') id: string) {
    return this.notifications.adminSendDraft(id);
  }

  @Roles(UserRole.ADMIN)
  @Delete('admin/:id')
  adminRemove(@Param('id') id: string) {
    return this.notifications.adminRemove(id);
  }
}

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService],
})
export class NotificationsModule {}
