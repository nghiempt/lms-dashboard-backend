import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { ProgressStatus } from '@prisma/client';

/** Heartbeat tiến độ khi học viên xem video. */
export class UpdateProgressDto {
  @IsString()
  lessonId!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  watchedSec?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  lastPositionSec?: number;

  @IsOptional()
  @IsEnum(ProgressStatus)
  status?: ProgressStatus;
}

/** Ghi phiên học để thống kê giờ học. */
export class RecordSessionDto {
  @IsOptional()
  @IsString()
  lessonId?: string;

  @IsInt()
  @Min(1)
  durationSec!: number;
}
