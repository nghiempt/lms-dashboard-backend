import {
  Controller,
  Delete,
  Get,
  Param,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { AuthUser, CurrentUser, Roles } from '../../common/decorators';
import { DevicesService } from './devices.service';

@ApiTags('Devices')
@ApiBearerAuth()
@Controller('devices')
export class DevicesController {
  constructor(private readonly devices: DevicesService) {}

  /** Học viên: danh sách thiết bị của chính mình. */
  @Get('me')
  myDevices(@CurrentUser() user: AuthUser) {
    return this.devices.listForUser(user.id);
  }

  /** Học viên: gỡ một thiết bị của mình. */
  @Delete('me/:id')
  removeMine(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.devices.remove(user.id, id).then(() => ({ removed: true }));
  }

  /** Admin: xem thiết bị của 1 học viên. */
  @Get('admin')
  @Roles(UserRole.ADMIN)
  byUser(@Query('userId') userId: string) {
    return this.devices.listForUser(userId);
  }

  /** Admin: gỡ thiết bị bất kỳ. */
  @Delete('admin/:id')
  @Roles(UserRole.ADMIN)
  adminRemove(@Param('id') id: string) {
    return this.devices.adminRemove(id).then(() => ({ removed: true }));
  }
}
