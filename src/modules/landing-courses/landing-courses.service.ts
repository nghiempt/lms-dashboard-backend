import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateLandingChapterDto,
  CreateLandingCourseDto,
  CreateLandingLessonDto,
  ReorderLandingDto,
  SaveLandingTreeDto,
  UpdateLandingChapterDto,
  UpdateLandingCourseDto,
  UpdateLandingLessonDto,
} from './dto/landing-courses.dto';

const courseTreeInclude = {
  chapters: {
    orderBy: { order: 'asc' },
    include: { lessons: { orderBy: { order: 'asc' } } },
  },
} satisfies Prisma.LandingCourseInclude;

type CourseWithTree = Prisma.LandingCourseGetPayload<{
  include: typeof courseTreeInclude;
}>;

const pad2 = (n: number) => String(n).padStart(2, '0');

@Injectable()
export class LandingCoursesService {
  constructor(private readonly prisma: PrismaService) {}

  // ====================================================
  //  PUBLIC — cho Landing Page
  // ====================================================
  /** Danh sách khoá đang bật, kèm chương + bài (đã map sang shape LP). */
  async listPublic() {
    const rows = await this.prisma.landingCourse.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      include: courseTreeInclude,
    });
    return rows.map((c) => this.toPublic(c));
  }

  async getPublicBySlug(slug: string) {
    const course = await this.prisma.landingCourse.findUnique({
      where: { slug },
      include: courseTreeInclude,
    });
    if (!course || !course.isActive) {
      throw new NotFoundException('Không tìm thấy khoá học.');
    }
    return this.toPublic(course);
  }

  /** Map sang đúng cấu trúc Landing Page đang dùng (PLANS + CourseDetail). */
  private toPublic(c: CourseWithTree) {
    const lessonTotal = c.chapters.reduce(
      (sum, ch) => sum + ch.lessons.length,
      0,
    );
    return {
      slug: c.slug,
      title: c.title,
      price: c.price,
      currency: c.currency,
      featured: c.featured,
      badge: c.badge,
      features: this.features(c.features),
      tag: c.tag,
      accessLabel: c.accessLabel,
      supportLabel: c.supportLabel,
      ctaUrl: c.ctaUrl,
      href: `/course/${c.slug}`,
      chaptersLabel: String(c.chapters.length),
      lessonsLabel: String(lessonTotal),
      chapters: c.chapters.map((ch, i) => ({
        no: pad2(i + 1),
        label: ch.label,
        name: ch.name,
        desc: ch.description ?? '',
        count: `${ch.lessons.length} bài giảng`,
        lessons: ch.lessons.map((l, j) => ({
          no: pad2(j + 1),
          title: l.title,
          dur: l.duration ?? '',
          videoUrl: l.videoUrl ?? '',
        })),
      })),
    };
  }

  private features(value: Prisma.JsonValue): string[] {
    return Array.isArray(value) ? value.map((v) => String(v)) : [];
  }

  // ====================================================
  //  ADMIN — COURSE
  // ====================================================
  listAdmin() {
    return this.prisma.landingCourse.findMany({
      orderBy: { order: 'asc' },
      include: courseTreeInclude,
    });
  }

  async getAdminDetail(id: string) {
    const course = await this.prisma.landingCourse.findUnique({
      where: { id },
      include: courseTreeInclude,
    });
    if (!course) throw new NotFoundException('Không tìm thấy khoá học.');
    return course;
  }

  create(dto: CreateLandingCourseDto) {
    return this.prisma.landingCourse.create({
      data: {
        ...dto,
        features: (dto.features ?? []) as Prisma.InputJsonValue,
      },
    });
  }

  async update(id: string, dto: UpdateLandingCourseDto) {
    await this.ensureCourse(id);
    const { features, ...rest } = dto;
    return this.prisma.landingCourse.update({
      where: { id },
      data: {
        ...rest,
        ...(features !== undefined
          ? { features: features as Prisma.InputJsonValue }
          : {}),
      },
    });
  }

  async remove(id: string) {
    await this.prisma.landingCourse.delete({ where: { id } });
    return { deleted: true };
  }

  /**
   * Lưu toàn bộ cây (card + chương + bài) trong MỘT transaction.
   * Chỉ cập nhật field gửi lên; id chương/bài phải thuộc đúng khoá.
   */
  async saveTree(id: string, dto: SaveLandingTreeDto) {
    const existing = await this.prisma.landingCourse.findUnique({
      where: { id },
      include: { chapters: { include: { lessons: true } } },
    });
    if (!existing) throw new NotFoundException('Không tìm thấy khoá học.');

    const chapterIds = new Set(existing.chapters.map((c) => c.id));
    const lessonIds = new Set(
      existing.chapters.flatMap((c) => c.lessons.map((l) => l.id)),
    );

    const ops: Prisma.PrismaPromise<unknown>[] = [];

    // ----- card / header -----
    const courseData: Prisma.LandingCourseUpdateInput = {};
    if (dto.title !== undefined) {
      if (!dto.title.trim())
        throw new BadRequestException('Tiêu đề khoá học không được để trống.');
      courseData.title = dto.title.trim();
    }
    if (dto.price !== undefined) courseData.price = dto.price;
    if (dto.currency !== undefined) courseData.currency = dto.currency;
    if (dto.featured !== undefined) courseData.featured = dto.featured;
    if (dto.badge !== undefined) courseData.badge = dto.badge;
    if (dto.features !== undefined)
      courseData.features = dto.features as Prisma.InputJsonValue;
    if (dto.tag !== undefined) courseData.tag = dto.tag;
    if (dto.accessLabel !== undefined) courseData.accessLabel = dto.accessLabel;
    if (dto.supportLabel !== undefined)
      courseData.supportLabel = dto.supportLabel;
    if (dto.ctaUrl !== undefined) courseData.ctaUrl = dto.ctaUrl;
    if (Object.keys(courseData).length) {
      ops.push(
        this.prisma.landingCourse.update({ where: { id }, data: courseData }),
      );
    }

    // ----- chapters / lessons -----
    for (const ch of dto.chapters ?? []) {
      if (!chapterIds.has(ch.id)) {
        throw new BadRequestException(
          `Chương ${ch.id} không thuộc khoá học này.`,
        );
      }
      const chData: Prisma.LandingCourseChapterUpdateInput = {};
      if (ch.label !== undefined) {
        if (!ch.label.trim())
          throw new BadRequestException('Nhãn chương không được để trống.');
        chData.label = ch.label.trim();
      }
      if (ch.name !== undefined) {
        if (!ch.name.trim())
          throw new BadRequestException('Tên chương không được để trống.');
        chData.name = ch.name.trim();
      }
      if (ch.description !== undefined) chData.description = ch.description;
      if (Object.keys(chData).length) {
        ops.push(
          this.prisma.landingCourseChapter.update({
            where: { id: ch.id },
            data: chData,
          }),
        );
      }

      for (const l of ch.lessons ?? []) {
        if (!lessonIds.has(l.id)) {
          throw new BadRequestException(
            `Bài giảng ${l.id} không thuộc khoá học này.`,
          );
        }
        const lData: Prisma.LandingCourseLessonUpdateInput = {};
        if (l.title !== undefined) {
          if (!l.title.trim())
            throw new BadRequestException('Tên bài giảng không được để trống.');
          lData.title = l.title.trim();
        }
        if (l.videoUrl !== undefined) lData.videoUrl = l.videoUrl;
        if (l.duration !== undefined) lData.duration = l.duration;
        if (Object.keys(lData).length) {
          ops.push(
            this.prisma.landingCourseLesson.update({
              where: { id: l.id },
              data: lData,
            }),
          );
        }
      }
    }

    if (ops.length) await this.prisma.$transaction(ops);
    return this.getAdminDetail(id);
  }

  // ====================================================
  //  ADMIN — CHAPTER
  // ====================================================
  async createChapter(courseId: string, dto: CreateLandingChapterDto) {
    await this.ensureCourse(courseId);
    const order = dto.order ?? (await this.nextChapterOrder(courseId));
    return this.prisma.landingCourseChapter.create({
      data: { ...dto, courseId, order },
    });
  }

  updateChapter(id: string, dto: UpdateLandingChapterDto) {
    return this.prisma.landingCourseChapter.update({
      where: { id },
      data: dto,
    });
  }

  async removeChapter(id: string) {
    await this.prisma.landingCourseChapter.delete({ where: { id } });
    return { deleted: true };
  }

  async reorderChapters(courseId: string, dto: ReorderLandingDto) {
    await this.prisma.$transaction(
      dto.ids.map((id, idx) =>
        this.prisma.landingCourseChapter.update({
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
  async createLesson(chapterId: string, dto: CreateLandingLessonDto) {
    const chapter = await this.prisma.landingCourseChapter.findUnique({
      where: { id: chapterId },
    });
    if (!chapter) throw new NotFoundException('Không tìm thấy chương.');
    const order = dto.order ?? (await this.nextLessonOrder(chapterId));
    return this.prisma.landingCourseLesson.create({
      data: { ...dto, chapterId, order },
    });
  }

  updateLesson(id: string, dto: UpdateLandingLessonDto) {
    return this.prisma.landingCourseLesson.update({
      where: { id },
      data: dto,
    });
  }

  async removeLesson(id: string) {
    await this.prisma.landingCourseLesson.delete({ where: { id } });
    return { deleted: true };
  }

  async reorderLessons(chapterId: string, dto: ReorderLandingDto) {
    await this.prisma.$transaction(
      dto.ids.map((id, idx) =>
        this.prisma.landingCourseLesson.update({
          where: { id },
          data: { order: idx },
        }),
      ),
    );
    return { reordered: true };
  }

  // ====================================================
  //  HELPERS
  // ====================================================
  private async ensureCourse(id: string) {
    const c = await this.prisma.landingCourse.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Không tìm thấy khoá học.');
    return c;
  }

  private async nextChapterOrder(courseId: string): Promise<number> {
    const last = await this.prisma.landingCourseChapter.findFirst({
      where: { courseId },
      orderBy: { order: 'desc' },
    });
    return (last?.order ?? -1) + 1;
  }

  private async nextLessonOrder(chapterId: string): Promise<number> {
    const last = await this.prisma.landingCourseLesson.findFirst({
      where: { chapterId },
      orderBy: { order: 'desc' },
    });
    return (last?.order ?? -1) + 1;
  }
}
