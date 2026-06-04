import { Injectable } from '@nestjs/common';
import { EnrollmentStatus, ProgressStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RecordSessionDto, UpdateProgressDto } from './dto/progress.dto';

@Injectable()
export class ProgressService {
  constructor(private readonly prisma: PrismaService) {}

  // ====================================================
  //  ENROLLMENTS ("Khoá học của tôi")
  // ====================================================
  async myCourses(userId: string, status?: EnrollmentStatus) {
    const enrollments = await this.prisma.enrollment.findMany({
      where: { userId, ...(status ? { status } : {}) },
      orderBy: { enrolledAt: 'desc' },
      include: {
        course: {
          include: {
            chapters: { select: { _count: { select: { lessons: true } } } },
            _count: { select: { chapters: true } },
          },
        },
      },
    });

    return enrollments.map((e) => {
      const lessonCount = e.course.chapters.reduce(
        (sum, c) => sum + c._count.lessons,
        0,
      );
      return {
        id: e.id,
        status: e.status,
        progressPct: e.progressPct,
        enrolledAt: e.enrolledAt,
        expiresAt: e.expiresAt,
        completedAt: e.completedAt,
        course: {
          id: e.course.id,
          title: e.course.title,
          shortCode: e.course.shortCode,
          coverLabel: e.course.coverLabel,
          thumbnailUrl: e.course.thumbnailUrl,
          price: e.course.price,
          chapterCount: e.course._count.chapters,
          lessonCount,
        },
      };
    });
  }

  // ====================================================
  //  LESSON PROGRESS
  // ====================================================
  async updateProgress(userId: string, dto: UpdateProgressDto) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: dto.lessonId },
      include: { chapter: true },
    });
    if (!lesson) throw new Error('Bài học không tồn tại.');

    const completed =
      dto.status === ProgressStatus.COMPLETED ||
      (lesson.durationSec &&
        dto.watchedSec &&
        dto.watchedSec >= lesson.durationSec * 0.9);

    const status: ProgressStatus = completed
      ? ProgressStatus.COMPLETED
      : ProgressStatus.IN_PROGRESS;

    const progress = await this.prisma.lessonProgress.upsert({
      where: { userId_lessonId: { userId, lessonId: dto.lessonId } },
      create: {
        userId,
        lessonId: dto.lessonId,
        watchedSec: dto.watchedSec ?? 0,
        lastPositionSec: dto.lastPositionSec ?? 0,
        status,
        completedAt: completed ? new Date() : null,
      },
      update: {
        watchedSec: dto.watchedSec ?? undefined,
        lastPositionSec: dto.lastPositionSec ?? undefined,
        status,
        completedAt: completed ? new Date() : undefined,
      },
    });

    await this.recomputeEnrollment(userId, lesson.chapter.courseId);
    return progress;
  }

  /** Tính lại % hoàn thành của enrollment dựa trên số lesson COMPLETED. */
  private async recomputeEnrollment(userId: string, courseId: string) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    if (!enrollment) return;

    const chapters = await this.prisma.chapter.findMany({
      where: { courseId },
      select: { id: true },
    });
    const chapterIds = chapters.map((c) => c.id);
    const totalLessons = await this.prisma.lesson.count({
      where: { chapterId: { in: chapterIds } },
    });
    if (totalLessons === 0) return;

    const lessons = await this.prisma.lesson.findMany({
      where: { chapterId: { in: chapterIds } },
      select: { id: true },
    });
    const lessonIds = lessons.map((l) => l.id);
    const completed = await this.prisma.lessonProgress.count({
      where: {
        userId,
        lessonId: { in: lessonIds },
        status: ProgressStatus.COMPLETED,
      },
    });

    const pct = Math.round((completed / totalLessons) * 100);
    const isDone = pct >= 100;
    await this.prisma.enrollment.update({
      where: { id: enrollment.id },
      data: {
        progressPct: pct,
        status: isDone ? EnrollmentStatus.COMPLETED : enrollment.status,
        completedAt: isDone ? enrollment.completedAt ?? new Date() : null,
      },
    });
  }

  // ====================================================
  //  STUDY SESSIONS
  // ====================================================
  async recordSession(userId: string, dto: RecordSessionDto) {
    return this.prisma.studySession.create({
      data: {
        userId,
        lessonId: dto.lessonId,
        durationSec: dto.durationSec,
        endedAt: new Date(),
      },
    });
  }

  // ====================================================
  //  DASHBOARD STATS (Tổng quan + Tiến độ học)
  // ====================================================
  async dashboardSummary(userId: string) {
    const [enrollments, videoLessons, watched, sessions] =
      await this.prisma.$transaction([
        this.prisma.enrollment.findMany({
          where: { userId },
          include: { course: true },
        }),
        this.prisma.lessonProgress.count({ where: { userId } }),
        this.prisma.lessonProgress.count({
          where: { userId, status: ProgressStatus.COMPLETED },
        }),
        this.prisma.studySession.findMany({
          where: { userId },
          select: { durationSec: true, startedAt: true },
        }),
      ]);

    // tổng số lesson trong các khoá đã mua
    const courseIds = enrollments.map((e) => e.courseId);
    const chapters = await this.prisma.chapter.findMany({
      where: { courseId: { in: courseIds } },
      select: { id: true },
    });
    const totalLessons = await this.prisma.lesson.count({
      where: { chapterId: { in: chapters.map((c) => c.id) } },
    });

    const totalSec = sessions.reduce((s, x) => s + x.durationSec, 0);
    const totalHours = +(totalSec / 3600).toFixed(1);
    const completionRate = totalLessons
      ? Math.round((watched / totalLessons) * 100)
      : 0;

    return {
      coursesBought: enrollments.length,
      totalHours,
      videosWatched: watched,
      videosRemaining: Math.max(0, totalLessons - watched),
      lessonsTouched: videoLessons,
      completionRate,
      courses: enrollments.map((e) => ({
        id: e.course.id,
        title: e.course.title,
        shortCode: e.course.shortCode,
        progressPct: e.progressPct,
        status: e.status,
        price: e.course.price,
      })),
    };
  }

  /** Giờ học theo từng ngày trong N ngày gần nhất (biểu đồ cột FE). */
  async weeklyStudy(userId: string, days = 7) {
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - (days - 1));

    const sessions = await this.prisma.studySession.findMany({
      where: { userId, startedAt: { gte: since } },
      select: { durationSec: true, startedAt: true },
    });

    const buckets = new Map<string, number>();
    for (let i = 0; i < days; i++) {
      const d = new Date(since);
      d.setDate(since.getDate() + i);
      buckets.set(this.dayKey(d), 0);
    }
    for (const s of sessions) {
      const key = this.dayKey(s.startedAt);
      if (buckets.has(key)) buckets.set(key, buckets.get(key)! + s.durationSec);
    }

    const data = [...buckets.entries()].map(([date, sec]) => ({
      date,
      hours: +(sec / 3600).toFixed(2),
    }));
    const totalHours = +(
      data.reduce((s, x) => s + x.hours, 0)
    ).toFixed(1);

    return { days, totalHours, data, streak: await this.studyStreak(userId) };
  }

  /** Chuỗi ngày học liên tục tính tới hôm nay. */
  private async studyStreak(userId: string): Promise<number> {
    const sessions = await this.prisma.studySession.findMany({
      where: { userId },
      select: { startedAt: true },
      orderBy: { startedAt: 'desc' },
      take: 365,
    });
    const dayset = new Set(sessions.map((s) => this.dayKey(s.startedAt)));
    let streak = 0;
    const cursor = new Date();
    cursor.setHours(0, 0, 0, 0);
    while (dayset.has(this.dayKey(cursor))) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }

  private dayKey(d: Date): string {
    return d.toISOString().slice(0, 10);
  }
}
