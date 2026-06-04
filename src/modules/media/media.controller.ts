import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { MediaType, UserRole } from '@prisma/client';
import { AuthUser, CurrentUser, Roles } from '../../common/decorators';
import {
  ConfirmUploadDto,
  ListMediaQueryDto,
  PresignUploadDto,
} from './dto/media.dto';
import { MediaService } from './media.service';

interface UploadedFileLike {
  originalname: string;
  buffer: Buffer;
  mimetype: string;
  size: number;
}

@ApiTags('Media (MinIO)')
@ApiBearerAuth()
@Controller('media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  /** Học viên/admin: xin presigned URL để upload (vd. avatar). */
  @Post('presign')
  presign(@Body() dto: PresignUploadDto) {
    return this.media.presign(dto);
  }

  @Post('confirm')
  confirm(@CurrentUser() user: AuthUser, @Body() dto: ConfirmUploadDto) {
    return this.media.confirm(user.id, dto);
  }

  /** Upload trực tiếp qua server (multipart/form-data, field "file"). */
  @Post('upload')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: UploadedFileLike,
    @Body('folder') folder?: string,
    @Body('type') type?: MediaType,
  ) {
    return this.media.uploadDirect(
      user.id,
      file,
      folder ?? 'uploads',
      type ?? 'OTHER',
    );
  }

  /** Admin: quản lý kho media. */
  @Get()
  @Roles(UserRole.ADMIN)
  list(@Query() query: ListMediaQueryDto) {
    return this.media.list(query);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@Param('id') id: string) {
    return this.media.remove(id);
  }
}
