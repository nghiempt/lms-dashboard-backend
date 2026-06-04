import {
  ArrayUnique,
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export class CreateAdminDto {
  @IsString()
  @MaxLength(120)
  fullName!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  /** id các AdminRole gán cho admin này. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayUnique()
  roleIds?: string[];
}

export class UpdateAdminRolesDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayUnique()
  roleIds!: string[];
}

export class CreateRoleDto {
  @IsString()
  @MaxLength(60)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  /** key các permission. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissionKeys?: string[];
}

export class UpdateRoleDto {
  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissionKeys?: string[];
}

export class ListAdminsQueryDto extends PaginationQueryDto {}
