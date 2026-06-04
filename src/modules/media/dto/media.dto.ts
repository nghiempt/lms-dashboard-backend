import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { MediaType } from '@prisma/client';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

/** Bước 1: xin presigned URL để upload trực tiếp lên MinIO. */
export class PresignUploadDto {
  @IsString()
  fileName!: string;

  @IsString()
  contentType!: string;

  @IsOptional()
  @IsString()
  folder?: string; // avatars | courses | posts | documents...
}

/** Bước 2: xác nhận đã upload xong, lưu metadata vào DB. */
export class ConfirmUploadDto {
  @IsString()
  objectKey!: string;

  @IsString()
  fileName!: string;

  @IsEnum(MediaType)
  type!: MediaType;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @IsInt()
  sizeBytes?: number;

  @IsOptional()
  @IsString()
  folder?: string;
}

export class ListMediaQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(MediaType)
  type?: MediaType;

  @IsOptional()
  @IsString()
  folder?: string;
}
