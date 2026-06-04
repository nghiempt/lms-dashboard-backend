import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { EnrollmentStatus } from '@prisma/client';
import { AuthUser, CurrentUser } from '../../common/decorators';
import { RecordSessionDto, UpdateProgressDto } from './dto/progress.dto';
import { ProgressService } from './progress.service';

@ApiTags('Progress & Learning')
@ApiBearerAuth()
@Controller()
export class ProgressController {
  constructor(private readonly progress: ProgressService) {}

  /** Khoá học của tôi (tab Courses + Dashboard table). */
  @Get('my/courses')
  myCourses(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: EnrollmentStatus,
  ) {
    return this.progress.myCourses(user.id, status);
  }

  /** Số liệu tổng quan (Dashboard stats + donut). */
  @Get('my/dashboard')
  dashboard(@CurrentUser() user: AuthUser) {
    return this.progress.dashboardSummary(user.id);
  }

  /** Biểu đồ giờ học N ngày + streak (Progress tab). */
  @Get('my/study-stats')
  studyStats(
    @CurrentUser() user: AuthUser,
    @Query('days') days?: string,
  ) {
    return this.progress.weeklyStudy(user.id, days ? Number(days) : 7);
  }

  /** Cập nhật tiến độ bài học (heartbeat). */
  @Post('my/progress')
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateProgressDto) {
    return this.progress.updateProgress(user.id, dto);
  }

  /** Ghi nhận thời lượng học (study session). */
  @Post('my/study-session')
  recordSession(
    @CurrentUser() user: AuthUser,
    @Body() dto: RecordSessionDto,
  ) {
    return this.progress.recordSession(user.id, dto);
  }
}
