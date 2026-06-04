import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { paginate } from '../../common/dto/pagination.dto';
import { StorageService } from '../../integrations/storage/storage.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ConfirmUploadDto,
  ListMediaQueryDto,
  PresignUploadDto,
} from './dto/media.dto';

@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /** Trả presigned URL cho FE PUT file. */
  async presign(dto: PresignUploadDto) {
    return this.storage.createPresignedUpload(
      dto.folder ?? 'uploads',
      dto.fileName,
      dto.contentType,
    );
  }

  /** Lưu metadata sau khi FE upload thành công. */
  async confirm(uploaderId: string, dto: ConfirmUploadDto) {
    return this.prisma.media.create({
      data: {
        uploaderId,
        type: dto.type,
        fileName: dto.fileName,
        objectKey: dto.objectKey,
        url: this.storage.publicUrlFor(dto.objectKey),
        mimeType: dto.mimeType,
        sizeBytes: dto.sizeBytes,
        folder: dto.folder,
      },
    });
  }

  /** Upload trực tiếp qua server (multipart) — tiện cho avatar. */
  async uploadDirect(
    uploaderId: string,
    file: { originalname: string; buffer: Buffer; mimetype: string; size: number },
    folder = 'uploads',
    type: Prisma.MediaCreateInput['type'] = 'OTHER',
  ) {
    const { objectKey, publicUrl } = await this.storage.uploadBuffer(
      folder,
      file.originalname,
      file.buffer,
      file.mimetype,
    );
    return this.prisma.media.create({
      data: {
        uploaderId,
        type,
        fileName: file.originalname,
        objectKey,
        url: publicUrl,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        folder,
      },
    });
  }

  async list(query: ListMediaQueryDto) {
    const where: Prisma.MediaWhereInput = {};
    if (query.type) where.type = query.type;
    if (query.folder) where.folder = query.folder;
    if (query.search)
      where.fileName = { contains: query.search, mode: 'insensitive' };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.media.findMany({
        where,
        orderBy: { createdAt: query.sortOrder },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.media.count({ where }),
    ]);
    return paginate(rows, total, query.page, query.limit);
  }

  async remove(id: string) {
    const media = await this.prisma.media.findUnique({ where: { id } });
    if (!media) throw new NotFoundException('Không tìm thấy tệp.');
    await this.storage.delete(media.objectKey).catch(() => undefined);
    await this.prisma.media.delete({ where: { id } });
    return { deleted: true };
  }
}
