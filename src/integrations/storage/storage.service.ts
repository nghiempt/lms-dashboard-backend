import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuid } from 'uuid';
import { AppConfig } from '../../config/configuration';

export interface PresignedUpload {
  uploadUrl: string;
  objectKey: string;
  publicUrl: string;
  expiresIn: number;
}

/**
 * Quản lý file trên MinIO/S3.
 * Dùng presigned URL để FE upload trực tiếp (không qua server),
 * và presigned GET cho file private.
 */
@Injectable()
export class StorageService {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicUrl: string;
  private readonly presignExpires: number;

  constructor(private readonly config: ConfigService<AppConfig, true>) {
    const s3 = this.config.get('s3', { infer: true });
    this.bucket = s3.bucket;
    this.publicUrl = s3.publicUrl || `${s3.endpoint}/${s3.bucket}`;
    this.presignExpires = s3.presignExpires;
    this.client = new S3Client({
      endpoint: s3.endpoint,
      region: s3.region,
      forcePathStyle: s3.forcePathStyle,
      credentials: { accessKeyId: s3.accessKey, secretAccessKey: s3.secretKey },
    });
  }

  buildObjectKey(folder: string, fileName: string): string {
    const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `${folder}/${uuid()}-${safe}`;
  }

  publicUrlFor(objectKey: string): string {
    return `${this.publicUrl}/${objectKey}`;
  }

  /** Tạo presigned URL để FE PUT file trực tiếp lên bucket. */
  async createPresignedUpload(
    folder: string,
    fileName: string,
    contentType: string,
  ): Promise<PresignedUpload> {
    const objectKey = this.buildObjectKey(folder, fileName);
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: objectKey,
      ContentType: contentType,
    });
    const uploadUrl = await getSignedUrl(this.client, command, {
      expiresIn: this.presignExpires,
    });
    return {
      uploadUrl,
      objectKey,
      publicUrl: this.publicUrlFor(objectKey),
      expiresIn: this.presignExpires,
    };
  }

  /** Presigned GET cho file private. */
  async createPresignedDownload(objectKey: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: objectKey,
    });
    return getSignedUrl(this.client, command, {
      expiresIn: this.presignExpires,
    });
  }

  /** Upload trực tiếp từ server (dùng khi nhận multipart). */
  async uploadBuffer(
    folder: string,
    fileName: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<{ objectKey: string; publicUrl: string }> {
    const objectKey = this.buildObjectKey(folder, fileName);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
        Body: buffer,
        ContentType: contentType,
      }),
    );
    return { objectKey, publicUrl: this.publicUrlFor(objectKey) };
  }

  async delete(objectKey: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: objectKey }),
    );
  }
}
