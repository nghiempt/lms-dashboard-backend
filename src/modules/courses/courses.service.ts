import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { paginate } from '../../common/dto/pagination.dto';
import { slugify } from '../../common/utils';
import { BunnyService } from '../../integrations/bunny/bunny.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';
import {
  CreateChapterDto,
  CreateCourseDto,
  CreateLessonDto,
  LessonAccessBulkDto,
  LessonAccessGrantDto,
  ListCoursesQueryDto,
  ReorderDto,
  SaveCourseTreeDto,
  UpdateChapterDto,
  UpdateCourseDto,
  UpdateLessonDto,
} from './dto/courses.dto';

@Injectable()
export class CoursesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bunny: BunnyService,
    private readonly activity: ActivityService,
  ) {}

  // ====================================================
  //  ADMIN — COURSE CRUD
  // ====================================================
  async listAdmin(query: ListCoursesQueryDto) {
    const where: Prisma.CourseWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.pricing) where.pricing = query.pricing;
    if (typeof query.isFeatured === 'boolean') where.isFeatured = query.isFeatured;
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { shortCode: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.course.findMany({
        where,
        orderBy: { [query.sortBy ?? 'createdAt']: query.sortOrder },
        skip: query.skip,
        take: query.limit,
        include: {
          _count: { select: { chapters: true, enrollments: true } },
          chapters: { select: { _count: { select: { lessons: true } } } },
        },
      }),
      this.prisma.course.count({ where }),
    ]);

    // doanh thu theo khoá (tổng giá order item của các đơn đã thanh toán)
    const ids = rows.map((r) => r.id);
    const revenueGroups = await this.prisma.orderItem.groupBy({
      by: ['courseId'],
      where: { courseId: { in: ids }, order: { status: 'PAID' } },
      _sum: { price: true },
      orderBy: { courseId: 'asc' },
    });
    const revenueMap = new Map(
      revenueGroups.map((g) => [g.courseId, Number(g._sum.price ?? 0)]),
    );

    const data = rows.map((c) => {
      const lessonCount = c.chapters.reduce(
        (s, ch) => s + ch._count.lessons,
        0,
      );
      const { chapters, _count, ...rest } = c;
      void chapters;
      return {
        ...rest,
        chapterCount: _count.chapters,
        lessonCount,
        studentsCount: _count.enrollments,
        revenue: revenueMap.get(c.id) ?? 0,
      };
    });
    return paginate(data, total, query.page, query.limit);
  }

  async create(dto: CreateCourseDto) {
    return this.prisma.course.create({
      data: {
        ...dto,
        slug: await this.uniqueSlug(dto.title),
        price: dto.price ?? 0,
      },
    });
  }

  async update(id: string, dto: UpdateCourseDto) {
    await this.ensureCourse(id);
    return this.prisma.course.update({ where: { id }, data: dto });
  }

  async publish(id: string, publish: boolean) {
    await this.ensureCourse(id);
    return this.prisma.course.update({
      where: { id },
      data: {
        status: publish ? 'PUBLISHED' : 'DRAFT',
        publishedAt: publish ? new Date() : null,
      },
    });
  }

  async remove(id: string) {
    await this.prisma.course.delete({ where: { id } });
    return { deleted: true };
  }

  /**
   * Lưu toàn bộ cây khoá học (course + chapters + lessons) trong MỘT transaction.
   * Thay cho việc FE gọi N+1 PATCH tuần tự (ghi một phần khi lỗi giữa chừng).
   * Nếu bất kỳ bước nào lỗi → rollback toàn bộ, dữ liệu không bị ghi dở.
   */
  async saveTree(id: string, dto: SaveCourseTreeDto) {
    await this.ensureCourse(id);

    // Xác thực id chapter/lesson thuộc đúng khoá học trước khi ghi.
    const existing = await this.prisma.course.findUnique({
      where: { id },
      include: { chapters: { include: { lessons: true, sections: true } } },
    });
    if (!existing) throw new NotFoundException('Không tìm thấy khoá học.');

    const chapterIds = new Set(existing.chapters.map((c) => c.id));
    const lessonIds = new Set(
      existing.chapters.flatMap((c) => c.lessons.map((l) => l.id)),
    );
    // map chương → tập section id hợp lệ (để xác thực gán bài & đổi tên nhóm)
    const sectionsByChapter = new Map(
      existing.chapters.map((c) => [c.id, new Set(c.sections.map((s) => s.id))]),
    );

    const ops: Prisma.PrismaPromise<unknown>[] = [];

    const courseData: Prisma.CourseUpdateInput = {};
    if (dto.title !== undefined) {
      if (!dto.title.trim())
        throw new BadRequestException('Tiêu đề khoá học không được để trống.');
      courseData.title = dto.title.trim();
    }
    if (dto.price !== undefined) courseData.price = dto.price;
    if (dto.description !== undefined) courseData.description = dto.description;
    if (Object.keys(courseData).length) {
      ops.push(this.prisma.course.update({ where: { id }, data: courseData }));
    }

    for (const ch of dto.chapters ?? []) {
      if (!chapterIds.has(ch.id)) {
        throw new BadRequestException(
          `Chương ${ch.id} không thuộc khoá học này.`,
        );
      }
      const chData: Prisma.ChapterUpdateInput = {};
      if (ch.title !== undefined) {
        if (!ch.title.trim())
          throw new BadRequestException('Tên chương không được để trống.');
        chData.title = ch.title.trim();
      }
      if (Object.keys(chData).length) {
        ops.push(
          this.prisma.chapter.update({ where: { id: ch.id }, data: chData }),
        );
      }

      const validSections = sectionsByChapter.get(ch.id) ?? new Set<string>();
      for (const sec of ch.sections ?? []) {
        if (!validSections.has(sec.id)) {
          throw new BadRequestException(`Nhóm bài ${sec.id} không thuộc chương này.`);
        }
        if (sec.title !== undefined) {
          if (!sec.title.trim())
            throw new BadRequestException('Tên nhóm bài không được để trống.');
          ops.push(
            this.prisma.section.update({ where: { id: sec.id }, data: { title: sec.title.trim() } }),
          );
        }
      }

      for (const l of ch.lessons ?? []) {
        if (!lessonIds.has(l.id)) {
          throw new BadRequestException(
            `Bài học ${l.id} không thuộc khoá học này.`,
          );
        }
        const lData: Prisma.LessonUpdateInput = {};
        if (l.title !== undefined) {
          if (!l.title.trim())
            throw new BadRequestException('Tên bài học không được để trống.');
          lData.title = l.title.trim();
        }
        if (l.videoSource !== undefined) lData.videoSource = l.videoSource;
        if (l.bunnyVideoId !== undefined) lData.bunnyVideoId = l.bunnyVideoId;
        if (l.videoUrl !== undefined) lData.videoUrl = l.videoUrl;
        if (l.level !== undefined) lData.level = l.level;
        if (l.isPreview !== undefined) lData.isPreview = l.isPreview;
        if (l.isLocked !== undefined) lData.isLocked = l.isLocked;
        if (l.sectionId !== undefined) {
          if (l.sectionId && !validSections.has(l.sectionId)) {
            throw new BadRequestException('Nhóm bài không hợp lệ cho bài học này.');
          }
          lData.section = l.sectionId
            ? { connect: { id: l.sectionId } }
            : { disconnect: true };
        }
        if (Object.keys(lData).length) {
          ops.push(
            this.prisma.lesson.update({ where: { id: l.id }, data: lData }),
          );
        }
      }
    }

    if (ops.length) await this.prisma.$transaction(ops);
    return this.getAdminDetail(id);
  }

  /** Cấu trúc đầy đủ course cho admin (chapters + lessons). */
  async getAdminDetail(id: string) {
    const course = await this.prisma.course.findUnique({
      where: { id },
      include: {
        chapters: {
          orderBy: { order: 'asc' },
          include: {
            lessons: { orderBy: { order: 'asc' } },
            sections: { orderBy: { order: 'asc' } },
          },
        },
      },
    });
    if (!course) throw new NotFoundException('Không tìm thấy khoá học.');
    return course;
  }

  // ====================================================
  //  ADMIN — SECTION (Nhóm bài)
  // ====================================================
  async createSection(chapterId: string, title: string) {
    const chapter = await this.prisma.chapter.findUnique({ where: { id: chapterId } });
    if (!chapter) throw new NotFoundException('Không tìm thấy chương.');
    const last = await this.prisma.section.findFirst({
      where: { chapterId },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    return this.prisma.section.create({
      data: { chapterId, title: title?.trim() || 'Nhóm bài mới', order: (last?.order ?? -1) + 1 },
    });
  }

  async removeSection(id: string) {
    // Lesson.sectionId tự set null nhờ FK onDelete: SetNull → bài học không bị xóa.
    await this.prisma.section.delete({ where: { id } });
    return { deleted: true };
  }

  // ====================================================
  //  ADMIN — CHAPTER
  // ====================================================
  async createChapter(courseId: string, dto: CreateChapterDto) {
    await this.ensureCourse(courseId);
    const order = dto.order ?? (await this.nextChapterOrder(courseId));
    return this.prisma.chapter.create({ data: { ...dto, courseId, order } });
  }

  async updateChapter(id: string, dto: UpdateChapterDto) {
    return this.prisma.chapter.update({ where: { id }, data: dto });
  }

  async removeChapter(id: string) {
    await this.prisma.chapter.delete({ where: { id } });
    return { deleted: true };
  }

  async reorderChapters(courseId: string, dto: ReorderDto) {
    await this.prisma.$transaction(
      dto.ids.map((id, idx) =>
        this.prisma.chapter.update({
          where: { id },
          data: { order: idx },
        }),
      ),
    );
    return { reordered: true };
  }

  // ====================================================
  //  ADMIN — LESSON
  // ====================================================
  async createLesson(chapterId: string, dto: CreateLessonDto) {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id: chapterId },
    });
    if (!chapter) throw new NotFoundException('Không tìm thấy chương.');
    const order = dto.order ?? (await this.nextLessonOrder(chapterId));
    return this.prisma.lesson.create({ data: { ...dto, chapterId, order } });
  }

  async updateLesson(id: string, dto: UpdateLessonDto) {
    return this.prisma.lesson.update({ where: { id }, data: dto });
  }

  async removeLesson(id: string) {
    await this.prisma.lesson.delete({ where: { id } });
    return { deleted: true };
  }

  async reorderLessons(chapterId: string, dto: ReorderDto) {
    await this.prisma.$transaction(
      dto.ids.map((id, idx) =>
        this.prisma.lesson.update({ where: { id }, data: { order: idx } }),
      ),
    );
    return { reordered: true };
  }

  /** Tạo video object trên Bunny để admin upload, gắn vào lesson. */
  async prepareLessonVideo(lessonId: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
    });
    if (!lesson) throw new NotFoundException('Không tìm thấy bài học.');
    const { videoId } = await this.bunny.createVideoObject(lesson.title);
    await this.prisma.lesson.update({
      where: { id: lessonId },
      data: { bunnyVideoId: videoId },
    });
    return { ...this.bunny.getUploadInfo(videoId), videoId };
  }

  /** Mở/khoá 1 bài học cho học viên cụ thể. */
  async setLessonAccess(lessonId: string, dto: LessonAccessGrantDto) {
    await this.prisma.lessonAccessGrant.upsert({
      where: { lessonId_userId: { lessonId, userId: dto.userId } },
      create: { lessonId, userId: dto.userId, unlocked: dto.unlocked },
      update: { unlocked: dto.unlocked },
    });
    return { lessonId, userId: dto.userId, unlocked: dto.unlocked };
  }

  /** Mở/khoá hàng loạt: mọi cặp (học viên × bài học). */
  async setLessonAccessBulk(dto: LessonAccessBulkDto) {
    const ops = dto.userIds.flatMap((userId) =>
      dto.lessonIds.map((lessonId) =>
        this.prisma.lessonAccessGrant.upsert({
          where: { lessonId_userId: { lessonId, userId } },
          create: { lessonId, userId, unlocked: dto.unlocked },
          update: { unlocked: dto.unlocked },
        }),
      ),
    );
    await this.prisma.$transaction(ops);
    return { count: ops.length, unlocked: dto.unlocked };
  }

  // ====================================================
  //  STUDENT — CATALOG & DETAIL
  // ====================================================
  /** Catalog công khai (chỉ khoá đã PUBLISHED). */
  async listPublic(query: ListCoursesQueryDto) {
    const where: Prisma.CourseWhereInput = { status: 'PUBLISHED' };
    if (query.pricing) where.pricing = query.pricing;
    if (typeof query.isFeatured === 'boolean') where.isFeatured = query.isFeatured;
    if (query.search) {
      where.title = { contains: query.search, mode: 'insensitive' };
    }
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.course.findMany({
        where,
        orderBy: { order: 'asc' },
        skip: query.skip,
        take: query.limit,
        include: { _count: { select: { chapters: true } } },
      }),
      this.prisma.course.count({ where }),
    ]);
    return paginate(rows, total, query.page, query.limit);
  }

  /**
   * Chi tiết khoá học cho học viên: chapters + lessons kèm trạng thái khoá
   * và tiến độ. Quyết định locked: chưa mua & không phải preview -> khoá;
   * có grant riêng thì override.
   */
  async getStudentDetail(courseId: string, userId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: {
        chapters: {
          orderBy: { order: 'asc' },
          include: {
            lessons: { orderBy: { order: 'asc' } },
            sections: { orderBy: { order: 'asc' } },
          },
        },
      },
    });
    if (!course || course.status !== 'PUBLISHED') {
      throw new NotFoundException('Không tìm thấy khoá học.');
    }

    const enrollment = await this.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    const enrolled = !!enrollment && !this.isExpired(enrollment.expiresAt);

    const lessonIds = course.chapters.flatMap((c) =>
      c.lessons.map((l) => l.id),
    );
    const [grants, progresses] = await this.prisma.$transaction([
      this.prisma.lessonAccessGrant.findMany({
        where: { userId, lessonId: { in: lessonIds } },
      }),
      this.prisma.lessonProgress.findMany({
        where: { userId, lessonId: { in: lessonIds } },
      }),
    ]);
    const grantMap = new Map(grants.map((g) => [g.lessonId, g.unlocked]));
    const progMap = new Map(progresses.map((p) => [p.lessonId, p]));

    const chapters = course.chapters.map((ch) => ({
      id: ch.id,
      title: ch.title,
      description: ch.description,
      order: ch.order,
      sections: ch.sections.map((s) => ({ id: s.id, title: s.title })),
      lessons: ch.lessons.map((ls) => {
        const grant = grantMap.get(ls.id);
        const locked = this.resolveLock(enrolled, ls.isPreview, ls.isLocked, grant);
        const prog = progMap.get(ls.id);
        return {
          id: ls.id,
          title: ls.title,
          type: ls.type,
          durationSec: ls.durationSec,
          isPreview: ls.isPreview,
          sectionId: ls.sectionId,
          locked,
          progress: prog
            ? { status: prog.status, watchedSec: prog.watchedSec, lastPositionSec: prog.lastPositionSec }
            : { status: 'NOT_STARTED', watchedSec: 0, lastPositionSec: 0 },
        };
      }),
    }));

    return {
      id: course.id,
      slug: course.slug,
      title: course.title,
      shortCode: course.shortCode,
      subtitle: course.subtitle,
      description: course.description,
      thumbnailUrl: course.thumbnailUrl,
      pricing: course.pricing,
      price: course.price,
      enrolled,
      enrollment: enrollment
        ? {
            status: enrollment.status,
            progressPct: enrollment.progressPct,
            expiresAt: enrollment.expiresAt,
          }
        : null,
      chapters,
    };
  }

  /**
   * Lấy dữ liệu phát bài học (signed video URL + watermark) cho học viên.
   * Đồng thời ghi VideoAccessLog (nhật ký truy cập).
   */
  async playLesson(
    lessonId: string,
    user: { id: string; email: string },
    ctx: { deviceId?: string; ip?: string; userAgent?: string },
  ) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        chapter: { include: { course: true } },
        attachments: { include: { media: true } },
      },
    });
    if (!lesson) throw new NotFoundException('Không tìm thấy bài học.');

    const courseId = lesson.chapter.courseId;
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: user.id, courseId } },
    });
    const enrolled = !!enrollment && !this.isExpired(enrollment.expiresAt);

    const grant = await this.prisma.lessonAccessGrant.findUnique({
      where: { lessonId_userId: { lessonId, userId: user.id } },
    });
    const locked = this.resolveLock(
      enrolled,
      lesson.isPreview,
      lesson.isLocked,
      grant?.unlocked,
    );
    if (locked) {
      throw new ForbiddenException(
        'Bạn chưa có quyền truy cập bài học này. Vui lòng mua khoá học.',
      );
    }

    let video: unknown = null;
    if (lesson.type === 'VIDEO') {
      if (lesson.videoSource === 'YOUTUBE' && lesson.videoUrl) {
        // YouTube: trả id/url để FE nhúng (không có watermark/token)
        video = { source: 'YOUTUBE', youtubeId: lesson.videoUrl };
      } else if (lesson.bunnyVideoId) {
        // Bunny: signed URL có thời hạn + watermark = email học viên (chống chia sẻ)
        video = {
          source: 'BUNNY',
          ...this.bunny.createSignedVideo(lesson.bunnyVideoId, user.email),
        };
      }
      // nhật ký truy cập video
      await this.prisma.videoAccessLog.create({
        data: {
          userId: user.id,
          lessonId: lesson.id,
          bunnyVideoId: lesson.bunnyVideoId,
          deviceId: ctx.deviceId,
          ipAddress: ctx.ip,
          userAgent: ctx.userAgent,
          watermark: user.email,
        },
      });
    }

    // cập nhật last accessed
    if (enrollment) {
      await this.prisma.enrollment.update({
        where: { id: enrollment.id },
        data: { lastAccessedAt: new Date() },
      });
    }

    await this.activity.log({
      userId: user.id,
      type: 'VIEW_LESSON',
      action: `Xem bài "${lesson.title}"`,
      ipAddress: ctx.ip,
      userAgent: ctx.userAgent,
      meta: { lessonId: lesson.id, courseId },
    });

    return {
      id: lesson.id,
      title: lesson.title,
      type: lesson.type,
      description: lesson.description,
      articleHtml: lesson.type === 'ARTICLE' ? lesson.articleHtml : null,
      durationSec: lesson.durationSec,
      video,
      attachments: lesson.attachments.map((a) => ({
        id: a.id,
        title: a.title,
        url: a.media?.url ?? a.url,
      })),
    };
  }

  // ====================================================
  //  HELPERS
  // ====================================================
  private resolveLock(
    enrolled: boolean,
    isPreview: boolean,
    isLocked: boolean,
    grant?: boolean,
  ): boolean {
    if (grant === true) return false; // mở khoá riêng
    if (grant === false) return true; // khoá riêng
    if (isPreview) return false;
    if (!enrolled) return true;
    return isLocked;
  }

  private isExpired(expiresAt: Date | null): boolean {
    return !!expiresAt && expiresAt < new Date();
  }

  private async ensureCourse(id: string) {
    const c = await this.prisma.course.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Không tìm thấy khoá học.');
    return c;
  }

  private async uniqueSlug(title: string): Promise<string> {
    const base = slugify(title);
    let slug = base;
    let i = 1;
    while (await this.prisma.course.findUnique({ where: { slug } })) {
      slug = `${base}-${i++}`;
    }
    return slug;
  }

  private async nextChapterOrder(courseId: string): Promise<number> {
    const last = await this.prisma.chapter.findFirst({
      where: { courseId },
      orderBy: { order: 'desc' },
    });
    return (last?.order ?? -1) + 1;
  }

  private async nextLessonOrder(chapterId: string): Promise<number> {
    const last = await this.prisma.lesson.findFirst({
      where: { chapterId },
      orderBy: { order: 'desc' },
    });
    return (last?.order ?? -1) + 1;
  }
}
