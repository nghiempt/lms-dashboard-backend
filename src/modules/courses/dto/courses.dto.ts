import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
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

// ---------- SAVE TREE (lưu toàn bộ course + chapters + lessons atomic) ----------
export class SaveTreeLessonDto {
  @IsString()
  id!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsEnum(VideoSource)
  videoSource?: VideoSource;

  @IsOptional()
  @IsString()
  bunnyVideoId?: string | null;

  @IsOptional()
  @IsString()
  videoUrl?: string | null;

  @IsOptional()
  @IsEnum(LessonLevel)
  level?: LessonLevel;

  @IsOptional()
  @IsBoolean()
  isPreview?: boolean;

  @IsOptional()
  @IsBoolean()
  isLocked?: boolean;

  // gán bài vào nhóm bài (null = nằm trực tiếp dưới chương)
  @IsOptional()
  @IsString()
  sectionId?: string | null;
}

export class SaveTreeSectionDto {
  @IsString()
  id!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;
}

export class SaveTreeChapterDto {
  @IsString()
  id!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveTreeSectionDto)
  sections?: SaveTreeSectionDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveTreeLessonDto)
  lessons?: SaveTreeLessonDto[];
}

export class CreateSectionDto {
  @IsString()
  @MaxLength(200)
  title!: string;
}

export class SaveCourseTreeDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveTreeChapterDto)
  chapters?: SaveTreeChapterDto[];
}

// ---------- LESSON ACCESS GRANT (mở/khoá riêng cho học viên) ----------
export class LessonAccessGrantDto {
  @IsString()
  userId!: string;

  @IsBoolean()
  unlocked!: boolean;
}

// Mở/khoá hàng loạt: nhiều học viên × nhiều bài học.
export class LessonAccessBulkDto {
  @IsString({ each: true })
  userIds!: string[];

  @IsString({ each: true })
  lessonIds!: string[];

  @IsBoolean()
  unlocked!: boolean;
}

// ---------- REORDER ----------
export class ReorderDto {
  @IsString({ each: true })
  ids!: string[];
}
