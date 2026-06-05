import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

// ---------- COURSE (card + header) ----------
export class CreateLandingCourseDto {
  @IsString()
  @MaxLength(120)
  slug!: string;

  @IsString()
  @MaxLength(200)
  title!: string;

  @IsString()
  @MaxLength(50)
  price!: string; // giữ nguyên văn: "5.890.000"

  @IsOptional()
  @IsString()
  @MaxLength(20)
  currency?: string;

  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  badge?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  features?: string[];

  @IsOptional()
  @IsString()
  tag?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  accessLabel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  supportLabel?: string;

  @IsOptional()
  @IsString()
  ctaUrl?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  order?: number;
}

export class UpdateLandingCourseDto extends PartialType(
  CreateLandingCourseDto,
) {}

// ---------- CHAPTER ----------
export class CreateLandingChapterDto {
  @IsString()
  @MaxLength(120)
  label!: string;

  @IsString()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  order?: number;
}

export class UpdateLandingChapterDto extends PartialType(
  CreateLandingChapterDto,
) {}

// ---------- LESSON ----------
export class CreateLandingLessonDto {
  @IsString()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  videoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  duration?: string;

  @IsOptional()
  @IsInt()
  order?: number;
}

export class UpdateLandingLessonDto extends PartialType(
  CreateLandingLessonDto,
) {}

// ---------- SAVE TREE (lưu toàn bộ khoá + chương + bài atomic) ----------
export class SaveLandingTreeLessonDto {
  @IsString()
  id!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  videoUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  duration?: string | null;
}

export class SaveLandingTreeChapterDto {
  @IsString()
  id!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveLandingTreeLessonDto)
  lessons?: SaveLandingTreeLessonDto[];
}

export class SaveLandingTreeDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  price?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  currency?: string;

  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  badge?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  features?: string[];

  @IsOptional()
  @IsString()
  tag?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  accessLabel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  supportLabel?: string;

  @IsOptional()
  @IsString()
  ctaUrl?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveLandingTreeChapterDto)
  chapters?: SaveLandingTreeChapterDto[];
}

// ---------- REORDER ----------
export class ReorderLandingDto {
  @IsString({ each: true })
  ids!: string[];
}
