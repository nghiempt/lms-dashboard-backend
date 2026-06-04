import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { paginate } from '../../common/dto/pagination.dto';
import { randomToken } from '../../common/utils';
import { MailService } from '../../integrations/mail/mail.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateStudentDto,
  ListStudentsQueryDto,
  UpdateNotificationPrefsDto,
  UpdateProfileDto,
  UpdateStudentDto,
} from './dto/users.dto';

const PUBLIC_SELECT = {
  id: true,
  email: true,
  fullName: true,
  phone: true,
  avatarUrl: true,
  bio: true,
  role: true,
  status: true,
  provider: true,
  emailVerifiedAt: true,
  lastLoginAt: true,
  notifyEmail: true,
  notifyStudyReminder: true,
  notifyCommunity: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  // ---------- STUDENT SELF ----------
  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: PUBLIC_SELECT,
    });
    if (!user) throw new NotFoundException('Không tìm thấy người dùng.');
    return user;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    return this.prisma.user.update({
      where: { id: userId },
      data: dto,
      select: PUBLIC_SELECT,
    });
  }

  async updateNotificationPrefs(
    userId: string,
    dto: UpdateNotificationPrefsDto,
  ) {
    return this.prisma.user.update({
      where: { id: userId },
      data: dto,
      select: PUBLIC_SELECT,
    });
  }

  // ---------- ADMIN MANAGE STUDENTS ----------
  async listStudents(query: ListStudentsQueryDto) {
    const where: Prisma.UserWhereInput = { role: UserRole.STUDENT };
    if (query.status) where.status = query.status;
    if (query.search) {
      where.OR = [
        { email: { contains: query.search, mode: 'insensitive' } },
        { fullName: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const orderBy: Prisma.UserOrderByWithRelationInput = {
      [query.sortBy ?? 'createdAt']: query.sortOrder,
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: PUBLIC_SELECT,
        orderBy,
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    // tính aggregate theo lô cho các học viên trong trang: số khoá, % tiến độ TB, tổng chi tiêu
    const ids = rows.map((r) => r.id);
    const [enrollGroups, progressEnrolls, spentGroups] = await Promise.all([
      this.prisma.enrollment.groupBy({
        by: ['userId'],
        where: { userId: { in: ids } },
        _count: { _all: true },
        orderBy: { userId: 'asc' },
      }),
      this.prisma.enrollment.findMany({
        where: { userId: { in: ids } },
        select: { userId: true, progressPct: true },
      }),
      this.prisma.order.groupBy({
        by: ['userId'],
        where: { userId: { in: ids }, status: 'PAID' },
        _sum: { total: true },
        orderBy: { userId: 'asc' },
      }),
    ]);

    const countMap = new Map(enrollGroups.map((g) => [g.userId, g._count._all]));
    const spentMap = new Map(
      spentGroups.map((g) => [g.userId, Number(g._sum.total ?? 0)]),
    );
    const progAgg = new Map<string, { sum: number; n: number }>();
    for (const e of progressEnrolls) {
      const cur = progAgg.get(e.userId) ?? { sum: 0, n: 0 };
      cur.sum += e.progressPct;
      cur.n += 1;
      progAgg.set(e.userId, cur);
    }

    const data = rows.map((r) => {
      const p = progAgg.get(r.id);
      return {
        ...r,
        courseCount: countMap.get(r.id) ?? 0,
        avgProgress: p && p.n ? Math.round(p.sum / p.n) : null,
        totalSpent: spentMap.get(r.id) ?? 0,
      };
    });
    return paginate(data, total, query.page, query.limit);
  }

  async getStudent(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, role: UserRole.STUDENT },
      select: {
        ...PUBLIC_SELECT,
        devices: true,
        enrollments: {
          include: { course: { select: { id: true, title: true, shortCode: true, price: true } } },
          orderBy: { enrolledAt: 'desc' },
        },
      },
    });
    if (!user) throw new NotFoundException('Không tìm thấy học viên.');

    const spent = await this.prisma.order.aggregate({
      where: { userId: id, status: 'PAID' },
      _sum: { total: true },
    });

    return {
      ...user,
      courseCount: user.enrollments.length,
      totalSpent: Number(spent._sum.total ?? 0),
      courses: user.enrollments.map((e) => ({
        id: e.course.id,
        title: e.course.title,
        shortCode: e.course.shortCode,
        progressPct: e.progressPct,
        status: e.status,
        price: e.course.price,
        enrolledAt: e.enrolledAt,
      })),
    };
  }

  async createStudent(dto: CreateStudentDto) {
    const rawPassword = dto.password ?? randomToken(6);
    const passwordHash = await bcrypt.hash(rawPassword, 10);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        fullName: dto.fullName,
        phone: dto.phone,
        passwordHash,
        role: UserRole.STUDENT,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
      },
      select: PUBLIC_SELECT,
    });
    // gửi mật khẩu tạm cho học viên
    await this.mail.sendGenericNotification(
      user.email,
      'Tài khoản học viên của bạn',
      `Tài khoản đã được tạo. Mật khẩu tạm: <b>${rawPassword}</b>. Vui lòng đăng nhập và đổi mật khẩu.`,
    );
    return user;
  }

  async updateStudent(id: string, dto: UpdateStudentDto) {
    const data: Prisma.UserUpdateInput = { ...dto };
    if (dto.password) {
      data.passwordHash = await bcrypt.hash(dto.password, 10);
      delete (data as Record<string, unknown>).password;
    }
    return this.prisma.user.update({
      where: { id },
      data,
      select: PUBLIC_SELECT,
    });
  }

  /** Khoá / mở khoá tài khoản học viên. */
  async setStatus(id: string, status: UserStatus) {
    const user = await this.prisma.user.update({
      where: { id },
      data: { status },
      select: PUBLIC_SELECT,
    });
    if (status === UserStatus.LOCKED) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    return user;
  }

  async remove(id: string) {
    await this.prisma.user.delete({ where: { id } });
    return { deleted: true };
  }
}
