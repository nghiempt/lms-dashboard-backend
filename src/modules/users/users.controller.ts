import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole, UserStatus } from '@prisma/client';
import { AuthUser, CurrentUser, Roles } from '../../common/decorators';
import {
  CreateStudentDto,
  ListStudentsQueryDto,
  UpdateNotificationPrefsDto,
  UpdateProfileDto,
  UpdateStudentDto,
} from './dto/users.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  // ----- STUDENT SELF -----
  @Get('me')
  myProfile(@CurrentUser() user: AuthUser) {
    return this.users.getProfile(user.id);
  }

  @Patch('me')
  updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(user.id, dto);
  }

  @Patch('me/notifications')
  updatePrefs(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateNotificationPrefsDto,
  ) {
    return this.users.updateNotificationPrefs(user.id, dto);
  }

  // ----- ADMIN -----
  @Get('students')
  @Roles(UserRole.ADMIN)
  list(@Query() query: ListStudentsQueryDto) {
    return this.users.listStudents(query);
  }

  @Get('students/:id')
  @Roles(UserRole.ADMIN)
  getOne(@Param('id') id: string) {
    return this.users.getStudent(id);
  }

  @Post('students')
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateStudentDto) {
    return this.users.createStudent(dto);
  }

  @Patch('students/:id')
  @Roles(UserRole.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateStudentDto) {
    return this.users.updateStudent(id, dto);
  }

  @Patch('students/:id/lock')
  @Roles(UserRole.ADMIN)
  lock(@Param('id') id: string) {
    return this.users.setStatus(id, UserStatus.LOCKED);
  }

  @Patch('students/:id/unlock')
  @Roles(UserRole.ADMIN)
  unlock(@Param('id') id: string) {
    return this.users.setStatus(id, UserStatus.ACTIVE);
  }

  @Delete('students/:id')
  @Roles(UserRole.ADMIN)
  remove(@Param('id') id: string) {
    return this.users.remove(id);
  }
}
