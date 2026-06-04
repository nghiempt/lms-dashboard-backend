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
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { DocumentKind, Prisma, UserRole } from '@prisma/client';
import { AuthUser, CurrentUser, Roles } from '../../common/decorators';
import {
  paginate,
  PaginationQueryDto,
} from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';

// ---------- DTO ----------
class CreateDocumentDto {
  @IsString() @MaxLength(200) title!: string;
  @IsOptional() @IsString() description?: string;
  @IsEnum(DocumentKind) kind!: DocumentKind;
  @IsOptional() @IsString() url?: string;
  @IsOptional() @IsString() mediaId?: string;
  @IsOptional() @IsString() contentHtml?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() fileType?: string; // "PDF", "LUT · .cube"...
  @IsOptional() @IsInt() sizeBytes?: number;
  @IsOptional() @IsString() courseId?: string; // thuộc khoá nào (null=tất cả)
  @IsOptional() @IsBoolean() isPublic?: boolean;
  @IsOptional() @IsInt() order?: number;
}
class UpdateDocumentDto extends PartialType(CreateDocumentDto) {}
class ListDocumentsQueryDto extends PaginationQueryDto {
  @IsOptional() @IsString() category?: string;
}

// ---------- SERVICE ----------
@Injectable()
class DocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListDocumentsQueryDto, publicOnly: boolean) {
    const where: Prisma.DocumentWhereInput = {};
    if (publicOnly) where.isPublic = true;
    if (query.category) where.category = query.category;
    if (query.search)
      where.title = { contains: query.search, mode: 'insensitive' };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.document.findMany({
        where,
        orderBy: { order: 'asc' },
        skip: query.skip,
        take: query.limit,
        include: { media: true, course: { select: { id: true, title: true } } },
      }),
      this.prisma.document.count({ where }),
    ]);
    return paginate(rows, total, query.page, query.limit);
  }

  create(createdById: string, dto: CreateDocumentDto) {
    return this.prisma.document.create({ data: { ...dto, createdById } });
  }
  update(id: string, dto: UpdateDocumentDto) {
    return this.prisma.document.update({ where: { id }, data: dto });
  }
  async remove(id: string) {
    await this.prisma.document.delete({ where: { id } });
    return { deleted: true };
  }

  /** Tăng lượt tải + trả về link tải. */
  async download(id: string) {
    const doc = await this.prisma.document.update({
      where: { id },
      data: { downloadCount: { increment: 1 } },
      include: { media: true },
    });
    return { url: doc.media?.url ?? doc.url, downloadCount: doc.downloadCount };
  }
}

// ---------- CONTROLLER ----------
@ApiTags('Documents (Kho tài liệu)')
@ApiBearerAuth()
@Controller('documents')
class DocumentsController {
  constructor(private readonly docs: DocumentsService) {}

  /** Học viên: tài liệu công khai. */
  @Get()
  myDocs(@Query() query: ListDocumentsQueryDto) {
    return this.docs.list(query, true);
  }

  /** Học viên/admin: tải tài liệu (tăng lượt tải). */
  @Post(':id/download')
  download(@Param('id') id: string) {
    return this.docs.download(id);
  }

  @Roles(UserRole.ADMIN)
  @Get('admin')
  adminList(@Query() query: ListDocumentsQueryDto) {
    return this.docs.list(query, false);
  }

  @Roles(UserRole.ADMIN)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateDocumentDto) {
    return this.docs.create(user.id, dto);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateDocumentDto) {
    return this.docs.update(id, dto);
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.docs.remove(id);
  }
}

@Module({
  controllers: [DocumentsController],
  providers: [DocumentsService],
})
export class DocumentsModule {}
