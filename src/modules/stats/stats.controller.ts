import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators';
import { StatsService } from './stats.service';

@ApiTags('Stats (Admin)')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('stats')
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  @Get('overview')
  overview() {
    return this.stats.overview();
  }

  @Get('revenue')
  revenue(@Query('months') months?: string) {
    return this.stats.revenueByMonth(months ? Number(months) : 12);
  }

  @Get('top-courses')
  topCourses(@Query('limit') limit?: string) {
    return this.stats.topCourses(limit ? Number(limit) : 5);
  }

  @Get('student-growth')
  growth(@Query('months') months?: string) {
    return this.stats.studentGrowth(months ? Number(months) : 12);
  }
}
