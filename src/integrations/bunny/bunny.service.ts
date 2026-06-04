import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { AppConfig } from '../../config/configuration';

export interface SignedVideo {
  videoId: string;
  // iframe embed url có token + expiry
  embedUrl: string;
  // direct HLS playlist url có token (nếu cần custom player)
  hlsUrl: string;
  thumbnailUrl: string;
  expiresAt: Date;
  watermark: string;
}

/**
 * Bunny Stream: tạo URL phát video có thời hạn (token authentication)
 * + watermark theo tên/email học viên (chống chia sẻ).
 *
 * Token Authentication của Bunny: SHA256_base64url(authKey + path + expires).
 */
@Injectable()
export class BunnyService {
  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  private cfg() {
    return this.config.get('bunny', { infer: true });
  }

  /** Sinh token Bunny cho 1 path tới thời điểm expires (unix seconds). */
  private signToken(path: string, expires: number): string {
    const { tokenAuthKey } = this.cfg();
    const hash = crypto
      .createHash('sha256')
      .update(tokenAuthKey + path + expires)
      .digest('base64');
    // base64url
    return hash.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  /**
   * Tạo URL video có thời hạn + watermark.
   * watermarkText thường là email học viên để truy vết khi rò rỉ.
   */
  createSignedVideo(videoId: string, watermarkText: string): SignedVideo {
    const { libraryId, cdnHostname, urlExpires } = this.cfg();
    const expires = Math.floor(Date.now() / 1000) + urlExpires;

    const hlsPath = `/${videoId}/playlist.m3u8`;
    const hlsToken = this.signToken(hlsPath, expires);
    const wm = encodeURIComponent(watermarkText);

    const embedUrl =
      `https://iframe.mediadelivery.net/embed/${libraryId}/${videoId}` +
      `?token=${hlsToken}&expires=${expires}&watermark=${wm}`;
    const hlsUrl =
      `https://${cdnHostname}${hlsPath}?token=${hlsToken}&expires=${expires}`;
    const thumbnailUrl = `https://${cdnHostname}/${videoId}/thumbnail.jpg`;

    return {
      videoId,
      embedUrl,
      hlsUrl,
      thumbnailUrl,
      expiresAt: new Date(expires * 1000),
      watermark: watermarkText,
    };
  }

  /**
   * Tạo video object trên Bunny (admin upload). Trả về videoId để gắn vào Lesson.
   * Gọi Bunny API; nếu chưa cấu hình -> ném lỗi rõ ràng.
   */
  async createVideoObject(title: string): Promise<{ videoId: string }> {
    const { libraryId, apiKey } = this.cfg();
    if (!libraryId || !apiKey) {
      throw new Error('Bunny chưa được cấu hình (BUNNY_STREAM_*).');
    }
    const res = await fetch(
      `https://video.bunnycdn.com/library/${libraryId}/videos`,
      {
        method: 'POST',
        headers: {
          AccessKey: apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title }),
      },
    );
    if (!res.ok) {
      throw new Error(`Bunny tạo video thất bại: ${res.status}`);
    }
    const data = (await res.json()) as { guid: string };
    return { videoId: data.guid };
  }

  /** URL để FE upload trực tiếp file video lên Bunny (TUS/PUT). */
  getUploadInfo(videoId: string): { uploadUrl: string; apiKey: string } {
    const { libraryId, apiKey } = this.cfg();
    return {
      uploadUrl: `https://video.bunnycdn.com/library/${libraryId}/videos/${videoId}`,
      apiKey,
    };
  }
}
