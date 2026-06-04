import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../config/configuration';
import { PrismaService } from '../../prisma/prisma.service';

export interface DeviceContext {
  deviceId: string;
  deviceName?: string;
  userAgent?: string;
  ipAddress?: string;
}

/**
 * Quản lý thiết bị đăng nhập.
 * Chính sách: mỗi học viên tối đa MAX_DEVICES_PER_USER (mặc định 2) thiết bị.
 * Admin không bị giới hạn.
 */
@Injectable()
export class DevicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  /**
   * Đăng ký/cập nhật thiết bị khi login.
   * - Nếu thiết bị đã tồn tại -> cập nhật lastActiveAt.
   * - Nếu mới và đã đạt giới hạn -> ném ForbiddenException (FE hiển thị danh sách
   *   để học viên gỡ bớt, hoặc admin gỡ giúp).
   */
  async registerOnLogin(
    userId: string,
    role: string,
    ctx: DeviceContext,
  ): Promise<{ id: string; isNew: boolean }> {
    const existing = await this.prisma.device.findUnique({
      where: { userId_deviceId: { userId, deviceId: ctx.deviceId } },
    });

    if (existing) {
      await this.prisma.device.update({
        where: { id: existing.id },
        data: {
          lastActiveAt: new Date(),
          deviceName: ctx.deviceName ?? existing.deviceName,
          userAgent: ctx.userAgent ?? existing.userAgent,
          ipAddress: ctx.ipAddress ?? existing.ipAddress,
        },
      });
      return { id: existing.id, isNew: false };
    }

    if (role === 'STUDENT') {
      const max = this.config.get('device', { infer: true }).maxPerUser;
      const count = await this.prisma.device.count({ where: { userId } });
      if (count >= max) {
        throw new ForbiddenException(
          `Bạn đã đăng nhập tối đa ${max} thiết bị. Vui lòng gỡ bớt một thiết bị để tiếp tục.`,
        );
      }
    }

    const device = await this.prisma.device.create({
      data: {
        userId,
        deviceId: ctx.deviceId,
        deviceName: ctx.deviceName,
        userAgent: ctx.userAgent,
        ipAddress: ctx.ipAddress,
      },
    });
    return { id: device.id, isNew: true };
  }

  /** Danh sách thiết bị của 1 user (học viên xem của mình / admin xem bất kỳ). */
  async listForUser(userId: string) {
    return this.prisma.device.findMany({
      where: { userId },
      orderBy: { lastActiveAt: 'desc' },
    });
  }

  /** Gỡ thiết bị (đồng thời thu hồi refresh token gắn với thiết bị đó). */
  async remove(userId: string, deviceRecordId: string): Promise<void> {
    const device = await this.prisma.device.findFirst({
      where: { id: deviceRecordId, userId },
    });
    if (!device) throw new NotFoundException('Không tìm thấy thiết bị.');

    await this.prisma.$transaction([
      this.prisma.refreshToken.updateMany({
        where: { deviceId: device.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      this.prisma.device.delete({ where: { id: device.id } }),
    ]);
  }

  /** Admin gỡ thiết bị của học viên bất kỳ. */
  async adminRemove(deviceRecordId: string): Promise<void> {
    const device = await this.prisma.device.findUnique({
      where: { id: deviceRecordId },
    });
    if (!device) throw new NotFoundException('Không tìm thấy thiết bị.');
    await this.remove(device.userId, deviceRecordId);
  }
}
