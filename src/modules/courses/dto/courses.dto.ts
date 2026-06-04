import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import {
  CoursePricing,
  CourseStatus,
  LessonLevel,
  LessonType,
  VideoSource,
} from '@prisma/client';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

// ---------- COURSE ----------
export class CreateCourseDto {
  @IsString()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  shortCode?: string;

  @IsOptional()
  @IsString()
  subtitle?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  thumbnailUrl?: string;

  @IsOptional()
  @IsString()
  coverLabel?: string;

  @IsOptional()
  @IsEnum(CoursePricing)
  pricing?: CoursePricing;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  originalPrice?: number;

  @IsOptional()
  @IsEnum(CourseStatus)
  status?: CourseStatus;

  @IsOptional()
  @IsInt()
  accessDurationDays?: number;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @IsInt()
  order?: number;
}

export class UpdateCourseDto extends PartialType(CreateCourseDto) {}

export class ListCoursesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(CourseStatus)
  status?: CourseStatus;

  @IsOptional()
  @IsEnum(CoursePricing)
  pricing?: CoursePricing;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isFeatured?: boolean;
}

// ---------- CHAPTER ----------
export class CreateChapterDto {
  @IsString()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  order?: number;
}

export class UpdateChapterDto extends PartialType(CreateChapterDto) {}

// ---------- LESSON ----------
export class CreateLessonDto {
  @IsString()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(LessonType)
  type?: LessonType;

  @IsOptional()
  @IsEnum(VideoSource)
  videoSource?: VideoSource; // BUNNY | YOUTUBE

  @IsOptional()
  @IsString()
  bunnyVideoId?: string;

  @IsOptional()
  @IsString()
  videoUrl?: string; // YouTube id/url khi videoSource=YOUTUBE

  @IsOptional()
  @IsEnum(LessonLevel)
  level?: LessonLevel; // BASIC | ADVANCED

  @IsOptional()
  @IsInt()
  durationSec?: number;

  @IsOptional()
  @IsString()
  articleHtml?: string;

  @IsOptional()
  @IsBoolean()
  isPreview?: boolean;

  @IsOptional()
  @IsBoolean()
  isLocked?: boolean;

  @IsOptional()
  @IsInt()
  order?: number;
}

export class UpdateLessonDto extends PartialType(CreateLessonDto) {}

// ---------- LESSON ACCESS GRANT (mở/khoá riêng cho học viên) ----------
export class LessonAccessGrantDto {
  @IsString()
  userId!: string;

  @IsBoolean()
  unlocked!: boolean;
}

// ---------- REORDER ----------
export class ReorderDto {
  @IsString({ each: true })
  ids!: string[];
}
