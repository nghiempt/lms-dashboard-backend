import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Request } from 'express';
import { AuthUser, CurrentUser, Public, Roles } from '../../common/decorators';
import { CoursesService } from './courses.service';
import {
  CreateChapterDto,
  CreateCourseDto,
  CreateLessonDto,
  LessonAccessGrantDto,
  ListCoursesQueryDto,
  ReorderDto,
  UpdateChapterDto,
  UpdateCourseDto,
  UpdateLessonDto,
} from './dto/courses.dto';

@ApiTags('Courses')
@Controller('courses')
export class CoursesController {
  constructor(private readonly courses: CoursesService) {}

  // ============ PUBLIC / STUDENT CATALOG ============
  @Public()
  @Get('catalog')
  catalog(@Query() query: ListCoursesQueryDto) {
    return this.courses.listPublic(query);
  }

  @ApiBearerAuth()
  @Get(':id/detail')
  studentDetail(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.courses.getStudentDetail(id, user.id);
  }

  @ApiBearerAuth()
  @Get('lessons/:lessonId/play')
  play(
    @Param('lessonId') lessonId: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.courses.playLesson(
      lessonId,
      { id: user.id, email: user.email },
      {
        deviceId: req.headers['x-device-id'] as string,
        ip: (req.headers['x-forwarded-for'] as string) ?? req.ip,
        userAgent: req.headers['user-agent'],
      },
    );
  }

  // ============ ADMIN — COURSE ============
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Get()
  list(@Query() query: ListCoursesQueryDto) {
    return this.courses.listAdmin(query);
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Get(':id')
  adminDetail(@Param('id') id: string) {
    return this.courses.getAdminDetail(id);
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Post()
  create(@Body() dto: CreateCourseDto) {
    return this.courses.create(dto);
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCourseDto) {
    return this.courses.update(id, dto);
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Patch(':id/publish')
  publish(@Param('id') id: string, @Body('publish') publish: boolean) {
    return this.courses.publish(id, publish ?? true);
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.courses.remove(id);
  }

  // ============ ADMIN — CHAPTER ============
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Post(':courseId/chapters')
  createChapter(
    @Param('courseId') courseId: string,
    @Body() dto: CreateChapterDto,
  ) {
    return this.courses.createChapter(courseId, dto);
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Patch('chapters/:id')
  updateChapter(@Param('id') id: string, @Body() dto: UpdateChapterDto) {
    return this.courses.updateChapter(id, dto);
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Delete('chapters/:id')
  removeChapter(@Param('id') id: string) {
    return this.courses.removeChapter(id);
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Patch(':courseId/chapters/reorder')
  reorderChapters(
    @Param('courseId') courseId: string,
    @Body() dto: ReorderDto,
  ) {
    return this.courses.reorderChapters(courseId, dto);
  }

  // ============ ADMIN — LESSON ============
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Post('chapters/:chapterId/lessons')
  createLesson(
    @Param('chapterId') chapterId: string,
    @Body() dto: CreateLessonDto,
  ) {
    return this.courses.createLesson(chapterId, dto);
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Patch('lessons/:id')
  updateLesson(@Param('id') id: string, @Body() dto: UpdateLessonDto) {
    return this.courses.updateLesson(id, dto);
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Delete('lessons/:id')
  removeLesson(@Param('id') id: string) {
    return this.courses.removeLesson(id);
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Patch('chapters/:chapterId/lessons/reorder')
  reorderLessons(
    @Param('chapterId') chapterId: string,
    @Body() dto: ReorderDto,
  ) {
    return this.courses.reorderLessons(chapterId, dto);
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Post('lessons/:id/video')
  prepareVideo(@Param('id') id: string) {
    return this.courses.prepareLessonVideo(id);
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Post('lessons/:id/access')
  setAccess(@Param('id') id: string, @Body() dto: LessonAccessGrantDto) {
    return this.courses.setLessonAccess(id, dto);
  }
}
