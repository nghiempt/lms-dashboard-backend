import {
  Body,
  Controller,
  Get,
  Injectable,
  Module,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { UserRole } from '@prisma/client';
import { Public, Roles } from '../../common/decorators';
import { PrismaService } from '../../prisma/prisma.service';

// ---------- DTO ----------
class SettingItemDto {
  @IsString() key!: string;
  @IsOptional() @IsString() value?: string;
  @IsOptional() @IsString() group?: string;
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsString() label?: string;
}
class BulkUpsertSettingsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SettingItemDto)
  items!: SettingItemDto[];
}

// ---------- SERVICE ----------
@Injectable()
class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Lấy cấu hình; có thể lọc theo group. Trả dạng key-value gọn cho FE. */
  async getAll(group?: string) {
    const rows = await this.prisma.systemSetting.findMany({
      where: group ? { group } : undefined,
      orderBy: { group: 'asc' },
    });
    const map: Record<string, unknown> = {};
    for (const r of rows) map[r.key] = this.cast(r.value, r.type);
    return { items: rows, map };
  }

  /**
   * Cấu hình công khai cho FE (site name, social, hotline...).
   * Chỉ trả group an toàn, loại trừ secret thanh toán/email.
   */
  async getPublic() {
    const rows = await this.prisma.systemSetting.findMany({
      where: { group: { in: ['general', 'social', 'contact'] } },
    });
    const map: Record<string, unknown> = {};
    for (const r of rows) map[r.key] = this.cast(r.value, r.type);
    return map;
  }

  async bulkUpsert(dto: BulkUpsertSettingsDto) {
    await this.prisma.$transaction(
      dto.items.map((item) =>
        this.prisma.systemSetting.upsert({
          where: { key: item.key },
          create: {
            key: item.key,
            value: item.value,
            group: item.group ?? 'general',
            type: item.type ?? 'string',
            label: item.label,
          },
          update: {
            value: item.value,
            group: item.group,
            type: item.type,
            label: item.label,
          },
        }),
      ),
    );
    return this.getAll();
  }

  private cast(value: string | null, type: string): unknown {
    if (value === null) return null;
    if (type === 'number') return Number(value);
    if (type === 'boolean') return value === 'true';
    if (type === 'json') {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return value;
  }
}

// ---------- CONTROLLER ----------
@ApiTags('System Settings')
@Controller('settings')
class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  /** FE public config (không cần đăng nhập). */
  @Public()
  @Get('public')
  publicConfig() {
    return this.settings.getPublic();
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Get()
  all(@Query('group') group?: string) {
    return this.settings.getAll(group);
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Post()
  bulkUpsert(@Body() dto: BulkUpsertSettingsDto) {
    return this.settings.bulkUpsert(dto);
  }
}

@Module({
  controllers: [SettingsController],
  providers: [SettingsService],
})
export class SettingsModule {}
