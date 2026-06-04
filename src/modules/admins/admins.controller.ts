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
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators';
import { AdminsService } from './admins.service';
import {
  CreateAdminDto,
  CreateRoleDto,
  ListAdminsQueryDto,
  UpdateAdminRolesDto,
  UpdateRoleDto,
} from './dto/admins.dto';

@ApiTags('Admins & RBAC')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('admins')
export class AdminsController {
  constructor(private readonly admins: AdminsService) {}

  @Get()
  list(@Query() query: ListAdminsQueryDto) {
    return this.admins.listAdmins(query);
  }

  @Post()
  create(@Body() dto: CreateAdminDto) {
    return this.admins.createAdmin(dto);
  }

  @Patch(':id/roles')
  setRoles(@Param('id') id: string, @Body() dto: UpdateAdminRolesDto) {
    return this.admins.setAdminRoles(id, dto);
  }

  // ----- ROLES -----
  @Get('roles/all')
  listRoles() {
    return this.admins.listRoles();
  }

  @Post('roles')
  createRole(@Body() dto: CreateRoleDto) {
    return this.admins.createRole(dto);
  }

  @Patch('roles/:id')
  updateRole(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.admins.updateRole(id, dto);
  }

  @Delete('roles/:id')
  removeRole(@Param('id') id: string) {
    return this.admins.removeRole(id);
  }

  @Get('permissions/all')
  listPermissions() {
    return this.admins.listPermissions();
  }
}
