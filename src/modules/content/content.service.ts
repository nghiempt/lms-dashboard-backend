import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { paginate } from '../../common/dto/pagination.dto';
import { slugify } from '../../common/utils';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateArticleDto,
  ListArticlesQueryDto,
  UpdateArticleDto,
  UpsertLandingDto,
} from './dto/content.dto';

@Injectable()
export class ContentService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------- ARTICLES ----------
  async listArticles(query: ListArticlesQueryDto, publicOnly = false) {
    const where: Prisma.ArticleWhereInput = {};
    if (publicOnly) where.status = 'PUBLISHED';
    else if (query.status) where.status = query.status;
    if (query.search)
      where.title = { contains: query.search, mode: 'insensitive' };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.article.findMany({
        where,
        orderBy: { createdAt: query.sortOrder },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.article.count({ where }),
    ]);
    return paginate(rows, total, query.page, query.limit);
  }

  async getArticleBySlug(slug: string) {
    const article = await this.prisma.article.findUnique({ where: { slug } });
    if (!article) throw new NotFoundException('Không tìm thấy bài viết.');
    return article;
  }

  async createArticle(authorId: string, dto: CreateArticleDto) {
    return this.prisma.article.create({
      data: {
        ...dto,
        authorId,
        slug: await this.uniqueSlug(dto.title),
        publishedAt: dto.status === 'PUBLISHED' ? new Date() : null,
      },
    });
  }

  async updateArticle(id: string, dto: UpdateArticleDto) {
    return this.prisma.article.update({
      where: { id },
      data: {
        ...dto,
        publishedAt: dto.status === 'PUBLISHED' ? new Date() : undefined,
      },
    });
  }

  async removeArticle(id: string) {
    await this.prisma.article.delete({ where: { id } });
    return { deleted: true };
  }

  // ---------- LANDING SECTIONS ----------
  async getLanding() {
    return this.prisma.landingSection.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
    });
  }

  async listLandingAll() {
    return this.prisma.landingSection.findMany({ orderBy: { order: 'asc' } });
  }

  async upsertLanding(dto: UpsertLandingDto) {
    return this.prisma.landingSection.upsert({
      where: { key: dto.key },
      create: {
        key: dto.key,
        title: dto.title,
        content: dto.content as Prisma.InputJsonValue,
        order: dto.order ?? 0,
        isActive: dto.isActive ?? true,
      },
      update: {
        title: dto.title,
        content: dto.content as Prisma.InputJsonValue,
        order: dto.order,
        isActive: dto.isActive,
      },
    });
  }

  async removeLanding(key: string) {
    await this.prisma.landingSection.delete({ where: { key } });
    return { deleted: true };
  }

  private async uniqueSlug(title: string): Promise<string> {
    const base = slugify(title);
    let slug = base;
    let i = 1;
    while (await this.prisma.article.findUnique({ where: { slug } })) {
      slug = `${base}-${i++}`;
    }
    return slug;
  }
}
