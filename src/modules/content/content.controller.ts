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
import { AuthUser, CurrentUser, Public, Roles } from '../../common/decorators';
import { ContentService } from './content.service';
import {
  CreateArticleDto,
  ListArticlesQueryDto,
  UpdateArticleDto,
  UpsertLandingDto,
} from './dto/content.dto';

@ApiTags('Content (Articles & Landing)')
@Controller()
export class ContentController {
  constructor(private readonly content: ContentService) {}

  // ---------- PUBLIC ----------
  @Public()
  @Get('articles')
  publicArticles(@Query() query: ListArticlesQueryDto) {
    return this.content.listArticles(query, true);
  }

  @Public()
  @Get('articles/:slug')
  articleBySlug(@Param('slug') slug: string) {
    return this.content.getArticleBySlug(slug);
  }

  @Public()
  @Get('landing')
  landing() {
    return this.content.getLanding();
  }

  // ---------- ADMIN ----------
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Get('admin/articles')
  adminArticles(@Query() query: ListArticlesQueryDto) {
    return this.content.listArticles(query, false);
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Post('admin/articles')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateArticleDto) {
    return this.content.createArticle(user.id, dto);
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Patch('admin/articles/:id')
  update(@Param('id') id: string, @Body() dto: UpdateArticleDto) {
    return this.content.updateArticle(id, dto);
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Delete('admin/articles/:id')
  remove(@Param('id') id: string) {
    return this.content.removeArticle(id);
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Get('admin/landing')
  landingAll() {
    return this.content.listLandingAll();
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Post('admin/landing')
  upsertLanding(@Body() dto: UpsertLandingDto) {
    return this.content.upsertLanding(dto);
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Delete('admin/landing/:key')
  removeLanding(@Param('key') key: string) {
    return this.content.removeLanding(key);
  }
}
