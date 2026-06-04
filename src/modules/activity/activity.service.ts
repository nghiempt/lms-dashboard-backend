import { Injectable, Logger } from '@nestjs/common';
import { ActivityType, Prisma } from '@prisma/client';
import { paginate, PaginationQueryDto } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';

export interface LogActivityInput {
  userId: string;
  type: ActivityType;
  action: string;
  ipAddress?: string;
  userAgent?: string;
  deviceLabel?: string;
  meta?: Record<string, unknown>;
}

@Injectable()
export class ActivityService {
  private readonly logger = new Logger(ActivityService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Ghi 1 hoạt động — không bao giờ throw để không chặn luồng chính. */
  async log(input: LogActivityInput): Promise<void> {
    try {
      await this.prisma.activityLog.create({
        data: {
          userId: input.userId,
          type: input.type,
          action: input.action,
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
          deviceLabel: input.deviceLabel ?? this.parseDevice(input.userAgent),
          meta: (input.meta as Prisma.InputJsonValue) ?? undefined,
        },
      });
    } catch (e) {
      this.logger.warn(`Không ghi được activity log: ${(e as Error).message}`);
    }
  }

  /** Admin: danh sách nhật ký hoạt động. */
  async list(
    query: PaginationQueryDto & { userId?: string; type?: ActivityType },
  ) {
    const where: Prisma.ActivityLogWhereInput = {};
    if (query.userId) where.userId = query.userId;
    if (query.type) where.type = query.type;

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: query.sortOrder },
        skip: query.skip,
        take: query.limit,
        include: {
          user: { select: { id: true, fullName: true, email: true } },
        },
      }),
      this.prisma.activityLog.count({ where }),
    ]);
    return paginate(rows, total, query.page, query.limit);
  }

  /** Suy ra nhãn thiết bị thô từ user-agent (đủ dùng cho hiển thị). */
  private parseDevice(ua?: string): string | undefined {
    if (!ua) return undefined;
    const browser = /Edg/.test(ua)
      ? 'Edge'
      : /Chrome/.test(ua)
        ? 'Chrome'
        : /Safari/.test(ua)
          ? 'Safari'
          : /Firefox/.test(ua)
            ? 'Firefox'
            : 'Khác';
    const os = /Windows/.test(ua)
      ? 'Windows'
      : /Mac OS/.test(ua)
        ? 'macOS'
        : /Android/.test(ua)
          ? 'Android'
          : /iPhone|iPad/.test(ua)
            ? 'iOS'
            : 'Khác';
    return `${browser} · ${os}`;
  }
}
