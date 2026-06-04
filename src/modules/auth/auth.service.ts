import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthProvider, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import { AppConfig } from '../../config/configuration';
import { MailService } from '../../integrations/mail/mail.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';
import { DeviceContext, DevicesService } from '../devices/devices.service';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  GoogleLoginDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
} from './dto/auth.dto';
import { TokensService } from './tokens.service';

@Injectable()
export class AuthService {
  private readonly googleClient: OAuth2Client;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokensService,
    private readonly devices: DevicesService,
    private readonly config: ConfigService<AppConfig, true>,
    private readonly mail: MailService,
    private readonly activity: ActivityService,
  ) {
    const google = this.config.get('google', { infer: true });
    this.googleClient = new OAuth2Client(google.clientId);
  }

  private sanitize(user: {
    passwordHash?: string | null;
    [k: string]: unknown;
  }) {
    const { passwordHash, ...rest } = user;
    void passwordHash;
    return rest;
  }

  // ---------- REGISTER ----------
  async register(dto: RegisterDto, ctx: DeviceContext) {
    const exists = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (exists) throw new ConflictException('Email đã được sử dụng.');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        fullName: dto.fullName,
        role: 'STUDENT',
        status: UserStatus.PENDING,
        provider: AuthProvider.LOCAL,
      },
    });

    await this.sendVerificationEmail(user.email, user.fullName);

    // cấp token luôn để FE đưa thẳng vào dashboard (email vẫn cần verify để mở khoá đầy đủ)
    const device = await this.devices.registerOnLogin(user.id, user.role, ctx);
    const tokenPair = await this.tokens.issueTokens(user, device.id);

    return {
      user: this.sanitize(user),
      ...tokenPair,
      message:
        'Đăng ký thành công. Vui lòng kiểm tra email để xác thực tài khoản.',
    };
  }

  // ---------- LOGIN ----------
  async login(dto: LoginDto, ctx: DeviceContext) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng.');
    }
    if (user.status === UserStatus.LOCKED) {
      throw new UnauthorizedException(
        'Tài khoản đã bị khoá. Vui lòng liên hệ quản trị viên.',
      );
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Email hoặc mật khẩu không đúng.');

    // áp giới hạn thiết bị (có thể ném ForbiddenException)
    const device = await this.devices.registerOnLogin(user.id, user.role, ctx);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tokenPair = await this.tokens.issueTokens(user, device.id);
    await this.activity.log({
      userId: user.id,
      type: 'LOGIN',
      action: 'Đăng nhập',
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
    return { user: this.sanitize(user), device, ...tokenPair };
  }

  // ---------- GOOGLE ----------
  async googleLogin(dto: GoogleLoginDto, ctx: DeviceContext) {
    const google = this.config.get('google', { infer: true });
    const ticket = await this.googleClient.verifyIdToken({
      idToken: dto.idToken,
      audience: google.clientId,
    });
    const payload = ticket.getPayload();
    if (!payload?.email) {
      throw new UnauthorizedException('Google token không hợp lệ.');
    }

    const email = payload.email.toLowerCase();
    let user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email,
          fullName: payload.name ?? email.split('@')[0],
          avatarUrl: payload.picture,
          role: 'STUDENT',
          status: UserStatus.ACTIVE,
          provider: AuthProvider.GOOGLE,
          googleId: payload.sub,
          emailVerifiedAt: new Date(),
        },
      });
    } else if (!user.googleId) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { googleId: payload.sub, emailVerifiedAt: new Date() },
      });
    }

    if (user.status === UserStatus.LOCKED) {
      throw new UnauthorizedException('Tài khoản đã bị khoá.');
    }

    const device = await this.devices.registerOnLogin(user.id, user.role, ctx);
    const tokenPair = await this.tokens.issueTokens(user, device.id);
    return { user: this.sanitize(user), device, ...tokenPair };
  }

  // ---------- EMAIL VERIFICATION ----------
  private async sendVerificationEmail(email: string, name: string) {
    const token = await this.tokens.signMailToken(email, 'EMAIL_VERIFY', '24h');
    const link = `${this.config.get('app', { infer: true }).frontendUrl}/verify-email?token=${token}`;
    await this.mail.sendVerifyEmail(email, name, link);
  }

  async resendVerify(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (user && !user.emailVerifiedAt) {
      await this.sendVerificationEmail(user.email, user.fullName);
    }
    return { message: 'Nếu email tồn tại, liên kết xác thực đã được gửi.' };
  }

  async verifyEmail(token: string) {
    let email: string;
    try {
      email = await this.tokens.verifyMailToken(token, 'EMAIL_VERIFY');
    } catch {
      throw new BadRequestException('Token xác thực không hợp lệ hoặc hết hạn.');
    }
    const user = await this.prisma.user.update({
      where: { email },
      data: { emailVerifiedAt: new Date(), status: UserStatus.ACTIVE },
    });
    return { message: 'Xác thực email thành công.', email: user.email };
  }

  // ---------- FORGOT / RESET ----------
  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (user && user.passwordHash) {
      const token = await this.tokens.signMailToken(
        user.email,
        'PASSWORD_RESET',
        '1h',
      );
      const link = `${this.config.get('app', { infer: true }).frontendUrl}/reset-password?token=${token}`;
      await this.mail.sendResetPassword(user.email, user.fullName, link);
    }
    return {
      message: 'Nếu email tồn tại, liên kết đặt lại mật khẩu đã được gửi.',
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    let email: string;
    try {
      email = await this.tokens.verifyMailToken(dto.token, 'PASSWORD_RESET');
    } catch {
      throw new BadRequestException('Token đặt lại không hợp lệ hoặc hết hạn.');
    }
    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    const user = await this.prisma.user.update({
      where: { email },
      data: { passwordHash },
    });
    await this.tokens.revokeAllForUser(user.id); // đăng xuất mọi phiên
    return { message: 'Đặt lại mật khẩu thành công.' };
  }

  // ---------- CHANGE PASSWORD ----------
  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.passwordHash) {
      throw new BadRequestException(
        'Tài khoản chưa đặt mật khẩu (đăng nhập Google).',
      );
    }
    const ok = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!ok) throw new BadRequestException('Mật khẩu hiện tại không đúng.');

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
    return { message: 'Đổi mật khẩu thành công.' };
  }

  // ---------- REFRESH / LOGOUT ----------
  async refresh(refreshToken: string) {
    try {
      return await this.tokens.rotateRefresh(refreshToken);
    } catch (e) {
      throw new UnauthorizedException((e as Error).message);
    }
  }

  async logout(refreshToken: string) {
    await this.tokens.revokeRefresh(refreshToken);
    return { message: 'Đã đăng xuất.' };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { adminRoles: { include: { role: true } } },
    });
    if (!user) throw new UnauthorizedException();
    return this.sanitize(user);
  }
}
