import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Public, Roles } from '../../common/decorators';
import { LandingCoursesService } from './landing-courses.service';
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

@ApiTags('Landing Page Courses')
@Controller()
export class LandingCoursesController {
  constructor(private readonly landing: LandingCoursesService) {}

  // ============ PUBLIC (Landing Page gọi) ============
  @Public()
  @Get('landing-courses')
  list() {
    return this.landing.listPublic();
  }

  @Public()
  @Get('landing-courses/:slug')
  bySlug(@Param('slug') slug: string) {
    return this.landing.getPublicBySlug(slug);
  }

  // ============ ADMIN — COURSE ============
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Get('admin/landing-courses')
  adminList() {
    return this.landing.listAdmin();
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Get('admin/landing-courses/:id')
  adminDetail(@Param('id') id: string) {
    return this.landing.getAdminDetail(id);
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Post('admin/landing-courses')
  create(@Body() dto: CreateLandingCourseDto) {
    return this.landing.create(dto);
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Patch('admin/landing-courses/:id')
  update(@Param('id') id: string, @Body() dto: UpdateLandingCourseDto) {
    return this.landing.update(id, dto);
  }

  /** Lưu toàn bộ card + chương + bài atomic (transaction). */
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Patch('admin/landing-courses/:id/tree')
  saveTree(@Param('id') id: string, @Body() dto: SaveLandingTreeDto) {
    return this.landing.saveTree(id, dto);
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Delete('admin/landing-courses/:id')
  remove(@Param('id') id: string) {
    return this.landing.remove(id);
  }

  // ============ ADMIN — CHAPTER ============
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Post('admin/landing-courses/:courseId/chapters')
  createChapter(
    @Param('courseId') courseId: string,
    @Body() dto: CreateLandingChapterDto,
  ) {
    return this.landing.createChapter(courseId, dto);
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Patch('admin/landing-courses/chapters/:id')
  updateChapter(
    @Param('id') id: string,
    @Body() dto: UpdateLandingChapterDto,
  ) {
    return this.landing.updateChapter(id, dto);
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Delete('admin/landing-courses/chapters/:id')
  removeChapter(@Param('id') id: string) {
    return this.landing.removeChapter(id);
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Patch('admin/landing-courses/:courseId/chapters/reorder')
  reorderChapters(
    @Param('courseId') courseId: string,
    @Body() dto: ReorderLandingDto,
  ) {
    return this.landing.reorderChapters(courseId, dto);
  }

  // ============ ADMIN — LESSON ============
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Post('admin/landing-courses/chapters/:chapterId/lessons')
  createLesson(
    @Param('chapterId') chapterId: string,
    @Body() dto: CreateLandingLessonDto,
  ) {
    return this.landing.createLesson(chapterId, dto);
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Patch('admin/landing-courses/lessons/:id')
  updateLesson(@Param('id') id: string, @Body() dto: UpdateLandingLessonDto) {
    return this.landing.updateLesson(id, dto);
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Delete('admin/landing-courses/lessons/:id')
  removeLesson(@Param('id') id: string) {
    return this.landing.removeLesson(id);
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Patch('admin/landing-courses/chapters/:chapterId/lessons/reorder')
  reorderLessons(
    @Param('chapterId') chapterId: string,
    @Body() dto: ReorderLandingDto,
  ) {
    return this.landing.reorderLessons(chapterId, dto);
  }
}
