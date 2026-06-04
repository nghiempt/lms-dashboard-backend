import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { AccessLogsService } from './access-logs.service';

@ApiTags('Access Logs (Admin)')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('access-logs')
export class AccessLogsController {
  constructor(private readonly logs: AccessLogsService) {}

  @Get()
  list(
    @Query() query: PaginationQueryDto,
    @Query('userId') userId?: string,
    @Query('lessonId') lessonId?: string,
  ) {
    return this.logs.list(Object.assign(query, { userId, lessonId }));
  }

  @Get('suspicious')
  suspicious(
    @Query('hours') hours?: string,
    @Query('threshold') threshold?: string,
  ) {
    return this.logs.suspiciousSharing(
      hours ? Number(hours) : 24,
      threshold ? Number(threshold) : 3,
    );
  }
}
