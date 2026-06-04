import {
  Body,
  Controller,
  Delete,
  Get,
  Injectable,
  Module,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PartialType } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Public, Roles } from '../../common/decorators';
import { PrismaService } from '../../prisma/prisma.service';
import { ReorderDto } from '../courses/dto/courses.dto';

// ---------- DTO ----------
class CreateMenuDto {
  @IsString() @MaxLength(120) label!: string;
  @IsString() url!: string;
  @IsOptional() @IsString() parentId?: string;
  @IsOptional() @IsString() location?: string; // header | footer
  @IsOptional() @IsInt() order?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
class UpdateMenuDto extends PartialType(CreateMenuDto) {}

// ---------- SERVICE ----------
@Injectable()
class MenusService {
  constructor(private readonly prisma: PrismaService) {}

  /** Cây menu theo location (public dùng để render). */
  async tree(location = 'header') {
    const items = await this.prisma.menu.findMany({
      where: { location, isActive: true },
      orderBy: { order: 'asc' },
    });
    const byParent = new Map<string | null, typeof items>();
    for (const m of items) {
      const k = m.parentId;
      byParent.set(k, [...(byParent.get(k) ?? []), m]);
    }
    const build = (parentId: string | null): unknown[] =>
      (byParent.get(parentId) ?? []).map((m) => ({
        ...m,
        children: build(m.id),
      }));
    return build(null);
  }

  listAll() {
    return this.prisma.menu.findMany({ orderBy: { order: 'asc' } });
  }

  create(dto: CreateMenuDto) {
    return this.prisma.menu.create({ data: dto });
  }

  update(id: string, dto: UpdateMenuDto) {
    return this.prisma.menu.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.prisma.menu.delete({ where: { id } });
    return { deleted: true };
  }

  async reorder(ids: string[]) {
    await this.prisma.$transaction(
      ids.map((id, idx) =>
        this.prisma.menu.update({ where: { id }, data: { order: idx } }),
      ),
    );
    return { reordered: true };
  }
}

// ---------- CONTROLLER ----------
@ApiTags('Menus')
@Controller('menus')
class MenusController {
  constructor(private readonly menus: MenusService) {}

  @Public()
  @Get()
  tree(@Query('location') location?: string) {
    return this.menus.tree(location ?? 'header');
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Get('all')
  all() {
    return this.menus.listAll();
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Post()
  create(@Body() dto: CreateMenuDto) {
    return this.menus.create(dto);
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Patch('reorder')
  reorder(@Body() dto: ReorderDto) {
    return this.menus.reorder(dto.ids);
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateMenuDto) {
    return this.menus.update(id, dto);
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.menus.remove(id);
  }
}

@Module({
  controllers: [MenusController],
  providers: [MenusService],
})
export class MenusModule {}
