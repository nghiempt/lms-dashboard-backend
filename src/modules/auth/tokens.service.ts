import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AppConfig } from '../../config/configuration';
import { PrismaService } from '../../prisma/prisma.service';
import { addDays, randomToken, sha256 } from '../../common/utils';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

/**
 * Sinh & quản lý JWT access/refresh + token email (verify/reset).
 * Refresh token được băm SHA-256 trước khi lưu DB.
 */
@Injectable()
export class TokensService {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  private jwtCfg() {
    return this.config.get('jwt', { infer: true });
  }

  async issueTokens(
    user: { id: string; email: string; role: string },
    deviceId?: string,
  ): Promise<TokenPair> {
    const cfg = this.jwtCfg();
    const payload = { sub: user.id, email: user.email, role: user.role };

    const accessToken = await this.jwt.signAsync(payload, {
      secret: cfg.accessSecret,
      expiresIn: cfg.accessExpires,
    });

    const rawRefresh = randomToken(48);
    const refreshToken = await this.jwt.signAsync(
      { sub: user.id, jti: rawRefresh },
      { secret: cfg.refreshSecret, expiresIn: cfg.refreshExpires },
    );

    // lưu hash của rawRefresh để đối chiếu khi refresh
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        deviceId: deviceId ?? null,
        tokenHash: sha256(rawRefresh),
        expiresAt: addDays(new Date(), 7),
      },
    });

    return { accessToken, refreshToken, expiresIn: cfg.accessExpires };
  }

  /** Xác thực refresh token, xoay vòng (rotate) và trả cặp token mới. */
  async rotateRefresh(refreshToken: string): Promise<TokenPair> {
    const cfg = this.jwtCfg();
    let decoded: { sub: string; jti: string };
    try {
      decoded = await this.jwt.verifyAsync(refreshToken, {
        secret: cfg.refreshSecret,
      });
    } catch {
      throw new Error('Refresh token không hợp lệ hoặc đã hết hạn.');
    }

    const hash = sha256(decoded.jti);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hash },
    });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new Error('Phiên đăng nhập không hợp lệ.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: decoded.sub },
    });
    if (!user) throw new Error('Tài khoản không tồn tại.');

    // revoke token cũ rồi cấp mới (rotation)
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(
      { id: user.id, email: user.email, role: user.role },
      stored.deviceId ?? undefined,
    );
  }

  async revokeRefresh(refreshToken: string): Promise<void> {
    const cfg = this.jwtCfg();
    try {
      const decoded = await this.jwt.verifyAsync<{ jti: string }>(
        refreshToken,
        { secret: cfg.refreshSecret },
      );
      await this.prisma.refreshToken.updateMany({
        where: { tokenHash: sha256(decoded.jti), revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } catch {
      /* token đã hỏng -> bỏ qua */
    }
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Token email (verify/reset) — JWT ký bằng mailSecret, không lưu DB ở dạng raw. */
  async signMailToken(
    email: string,
    type: 'EMAIL_VERIFY' | 'PASSWORD_RESET',
    expiresIn: string,
  ): Promise<string> {
    return this.jwt.signAsync(
      { email, type },
      { secret: this.jwtCfg().mailSecret, expiresIn },
    );
  }

  async verifyMailToken(
    token: string,
    expectedType: 'EMAIL_VERIFY' | 'PASSWORD_RESET',
  ): Promise<string> {
    const decoded = await this.jwt.verifyAsync<{
      email: string;
      type: string;
    }>(token, { secret: this.jwtCfg().mailSecret });
    if (decoded.type !== expectedType) {
      throw new Error('Token không đúng loại.');
    }
    return decoded.email;
  }
}
