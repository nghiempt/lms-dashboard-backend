import { PartialType } from '@nestjs/swagger';
import {
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PostStatus } from '@prisma/client';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

// ---------- ARTICLE ----------
export class CreateArticleDto {
  @IsString()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  excerpt?: string;

  @IsOptional()
  @IsString()
  contentHtml?: string;

  @IsOptional()
  @IsString()
  coverUrl?: string;

  @IsOptional()
  @IsEnum(PostStatus)
  status?: PostStatus;
}

export class UpdateArticleDto extends PartialType(CreateArticleDto) {}

export class ListArticlesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(PostStatus)
  status?: PostStatus;
}

// ---------- LANDING SECTION ----------
export class UpsertLandingDto {
  @IsString()
  key!: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsObject()
  content!: Record<string, unknown>;

  @IsOptional()
  order?: number;

  @IsOptional()
  isActive?: boolean;
}
