import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { paginate, PaginationQueryDto } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AccessLogsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Admin: nhật ký truy cập video, lọc theo user/lesson. */
  async list(
    query: PaginationQueryDto & { userId?: string; lessonId?: string },
  ) {
    const where: Prisma.VideoAccessLogWhereInput = {};
    if (query.userId) where.userId = query.userId;
    if (query.lessonId) where.lessonId = query.lessonId;

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.videoAccessLog.findMany({
        where,
        orderBy: { accessedAt: query.sortOrder },
        skip: query.skip,
        take: query.limit,
        include: {
          user: { select: { id: true, fullName: true, email: true } },
          lesson: { select: { id: true, title: true } },
        },
      }),
      this.prisma.videoAccessLog.count({ where }),
    ]);
    return paginate(rows, total, query.page, query.limit);
  }

  /** Phát hiện chia sẻ tài khoản: nhiều IP/thiết bị khác nhau trong khoảng ngắn. */
  async suspiciousSharing(hours = 24, distinctThreshold = 3) {
    const since = new Date(Date.now() - hours * 3600 * 1000);
    const logs = await this.prisma.videoAccessLog.findMany({
      where: { accessedAt: { gte: since } },
      select: { userId: true, ipAddress: true, deviceId: true },
    });
    const map = new Map<string, { ips: Set<string>; devices: Set<string> }>();
    for (const l of logs) {
      const e = map.get(l.userId) ?? { ips: new Set(), devices: new Set() };
      if (l.ipAddress) e.ips.add(l.ipAddress);
      if (l.deviceId) e.devices.add(l.deviceId);
      map.set(l.userId, e);
    }
    const flagged = [...map.entries()]
      .filter(
        ([, v]) =>
          v.ips.size >= distinctThreshold || v.devices.size >= distinctThreshold,
      )
      .map(([userId, v]) => ({
        userId,
        distinctIps: v.ips.size,
        distinctDevices: v.devices.size,
      }));
    return { hours, distinctThreshold, flagged };
  }
}
