import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ActivityType, UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { ActivityService } from './activity.service';

@ApiTags('Activity Logs (Admin)')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('activity')
export class ActivityController {
  constructor(private readonly activity: ActivityService) {}

  @Get()
  list(
    @Query() query: PaginationQueryDto,
    @Query('userId') userId?: string,
    @Query('type') type?: ActivityType,
  ) {
    return this.activity.list(Object.assign(query, { userId, type }));
  }
}
