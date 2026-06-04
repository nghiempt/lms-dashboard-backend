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
import { ApiBearerAuth, ApiTags, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Prisma, UserRole } from '@prisma/client';
import { AuthUser, CurrentUser, Public, Roles } from '../../common/decorators';
import {
  paginate,
  PaginationQueryDto,
} from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';

// ---------- DTO ----------
class CreateGroupDto {
  @IsString() @MaxLength(200) name!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsInt() memberCount?: number;
  @IsOptional() @IsString() joinUrl?: string;
  @IsOptional() @IsString() iconUrl?: string;
  @IsOptional() @IsInt() order?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
class UpdateGroupDto extends PartialType(CreateGroupDto) {}

class CreatePostDto {
  @IsString() @MaxLength(250) title!: string;
  @IsOptional() @IsString() contentHtml?: string;
  @IsOptional() @IsString() authorName?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsInt() likeCount?: number;
  @IsOptional() @IsBoolean() isFeatured?: boolean;
}
class UpdatePostDto extends PartialType(CreatePostDto) {}

// ---------- SERVICE ----------
@Injectable()
class CommunityService {
  constructor(private readonly prisma: PrismaService) {}

  listGroups() {
    return this.prisma.communityGroup.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
    });
  }
  createGroup(dto: CreateGroupDto) {
    return this.prisma.communityGroup.create({ data: dto });
  }
  updateGroup(id: string, dto: UpdateGroupDto) {
    return this.prisma.communityGroup.update({ where: { id }, data: dto });
  }
  async removeGroup(id: string) {
    await this.prisma.communityGroup.delete({ where: { id } });
    return { deleted: true };
  }

  async listPosts(query: PaginationQueryDto & { featured?: string }) {
    const where: Prisma.PostWhereInput = { status: 'PUBLISHED' };
    if (query.featured === 'true') where.isFeatured = true;
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.post.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.post.count({ where }),
    ]);
    return paginate(rows, total, query.page, query.limit);
  }
  createPost(authorId: string, dto: CreatePostDto) {
    return this.prisma.post.create({ data: { ...dto, authorId } });
  }
  updatePost(id: string, dto: UpdatePostDto) {
    return this.prisma.post.update({ where: { id }, data: dto });
  }
  async removePost(id: string) {
    await this.prisma.post.delete({ where: { id } });
    return { deleted: true };
  }
}

// ---------- CONTROLLER ----------
@ApiTags('Community')
@Controller('community')
class CommunityController {
  constructor(private readonly community: CommunityService) {}

  // ----- PUBLIC / STUDENT -----
  @Public()
  @Get('groups')
  groups() {
    return this.community.listGroups();
  }

  @Public()
  @Get('posts')
  posts(
    @Query() query: PaginationQueryDto,
    @Query('featured') featured?: string,
  ) {
    return this.community.listPosts(Object.assign(query, { featured }));
  }

  // ----- ADMIN -----
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Post('groups')
  createGroup(@Body() dto: CreateGroupDto) {
    return this.community.createGroup(dto);
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Patch('groups/:id')
  updateGroup(@Param('id') id: string, @Body() dto: UpdateGroupDto) {
    return this.community.updateGroup(id, dto);
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Delete('groups/:id')
  removeGroup(@Param('id') id: string) {
    return this.community.removeGroup(id);
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Post('posts')
  createPost(@CurrentUser() user: AuthUser, @Body() dto: CreatePostDto) {
    return this.community.createPost(user.id, dto);
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Patch('posts/:id')
  updatePost(@Param('id') id: string, @Body() dto: UpdatePostDto) {
    return this.community.updatePost(id, dto);
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Delete('posts/:id')
  removePost(@Param('id') id: string) {
    return this.community.removePost(id);
  }
}

@Module({
  controllers: [CommunityController],
  providers: [CommunityService],
})
export class CommunityModule {}
