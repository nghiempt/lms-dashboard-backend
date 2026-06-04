import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderStatus, UserRole } from '@prisma/client';
import { AppConfig } from '../../config/configuration';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class StatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  /** Tổng quan cho dashboard admin. */
  async overview() {
    const [
      students,
      activeStudents,
      courses,
      publishedCourses,
      orders,
      paidOrders,
      revenue,
    ] = await this.prisma.$transaction([
      this.prisma.user.count({ where: { role: UserRole.STUDENT } }),
      this.prisma.user.count({
        where: { role: UserRole.STUDENT, status: 'ACTIVE' },
      }),
      this.prisma.course.count(),
      this.prisma.course.count({ where: { status: 'PUBLISHED' } }),
      this.prisma.order.count(),
      this.prisma.order.count({ where: { status: OrderStatus.PAID } }),
      this.prisma.order.aggregate({
        where: { status: OrderStatus.PAID },
        _sum: { total: true },
      }),
    ]);

    // doanh thu & đơn mới trong tháng hiện tại
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const [revenueMonth, newOrdersMonth] = await this.prisma.$transaction([
      this.prisma.order.aggregate({
        where: { status: OrderStatus.PAID, paidAt: { gte: startOfMonth } },
        _sum: { total: true },
      }),
      this.prisma.order.count({ where: { createdAt: { gte: startOfMonth } } }),
    ]);

    return {
      students,
      activeStudents,
      courses,
      publishedCourses,
      orders,
      paidOrders,
      totalRevenue: Number(revenue._sum.total ?? 0),
      revenueThisMonth: Number(revenueMonth._sum.total ?? 0),
      newOrdersThisMonth: newOrdersMonth,
      ga: { measurementId: this.config.get('ga', { infer: true }).measurementId },
    };
  }

  /** Doanh thu theo tháng trong N tháng gần nhất. */
  async revenueByMonth(months = 12) {
    const since = new Date();
    since.setDate(1);
    since.setHours(0, 0, 0, 0);
    since.setMonth(since.getMonth() - (months - 1));

    const orders = await this.prisma.order.findMany({
      where: { status: OrderStatus.PAID, paidAt: { gte: since } },
      select: { total: true, paidAt: true },
    });

    const buckets = new Map<string, { revenue: number; count: number }>();
    for (let i = 0; i < months; i++) {
      const d = new Date(since);
      d.setMonth(since.getMonth() + i);
      buckets.set(this.monthKey(d), { revenue: 0, count: 0 });
    }
    for (const o of orders) {
      if (!o.paidAt) continue;
      const key = this.monthKey(o.paidAt);
      const b = buckets.get(key);
      if (b) {
        b.revenue += Number(o.total);
        b.count += 1;
      }
    }

    return {
      months,
      data: [...buckets.entries()].map(([month, v]) => ({ month, ...v })),
    };
  }

  /** Top khoá học theo doanh thu / số lượt mua. */
  async topCourses(limit = 5) {
    const grouped = await this.prisma.orderItem.groupBy({
      by: ['courseId', 'title'],
      _sum: { price: true },
      _count: { _all: true },
      orderBy: { _sum: { price: 'desc' } },
      take: limit,
    });
    // số học viên (enrollment) theo từng khoá trong top
    const ids = grouped.map((g) => g.courseId);
    const studentGroups = await this.prisma.enrollment.groupBy({
      by: ['courseId'],
      where: { courseId: { in: ids } },
      _count: { _all: true },
      orderBy: { courseId: 'asc' },
    });
    const studentMap = new Map(
      studentGroups.map((g) => [g.courseId, g._count._all]),
    );

    return grouped.map((g) => ({
      courseId: g.courseId,
      title: g.title,
      revenue: Number(g._sum.price ?? 0),
      sales: g._count._all,
      studentsCount: studentMap.get(g.courseId) ?? 0,
    }));
  }

  /** Tăng trưởng học viên theo tháng. */
  async studentGrowth(months = 12) {
    const since = new Date();
    since.setDate(1);
    since.setHours(0, 0, 0, 0);
    since.setMonth(since.getMonth() - (months - 1));

    const users = await this.prisma.user.findMany({
      where: { role: UserRole.STUDENT, createdAt: { gte: since } },
      select: { createdAt: true },
    });
    const buckets = new Map<string, number>();
    for (let i = 0; i < months; i++) {
      const d = new Date(since);
      d.setMonth(since.getMonth() + i);
      buckets.set(this.monthKey(d), 0);
    }
    for (const u of users) {
      const key = this.monthKey(u.createdAt);
      if (buckets.has(key)) buckets.set(key, buckets.get(key)! + 1);
    }
    return {
      months,
      data: [...buckets.entries()].map(([month, count]) => ({ month, count })),
    };
  }

  private monthKey(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
}
