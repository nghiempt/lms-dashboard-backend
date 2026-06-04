import { ArrayMinSize, IsArray, IsEnum, IsOptional, IsString } from 'class-validator';
import { OrderStatus } from '@prisma/client';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

/** Học viên tạo đơn mua khoá học. */
export class CreateOrderDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  courseIds!: string[];

  @IsOptional()
  @IsString()
  note?: string;
}

export class ListOrdersQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  /** admin lọc theo học viên cụ thể */
  @IsOptional()
  @IsString()
  userId?: string;
}

/** Admin xác nhận đơn (chuyển khoản thủ công). */
export class ConfirmOrderDto {
  @IsOptional()
  @IsString()
  referenceCode?: string;
}
