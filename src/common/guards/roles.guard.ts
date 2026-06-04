import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { AuthUser, PERMISSIONS_KEY, ROLES_KEY } from '../decorators';

/**
 * Kiểm tra role + permission. Dùng sau JwtAuthGuard.
 * - @Roles(UserRole.ADMIN) -> chỉ admin.
 * - @RequirePermissions('course.create') -> admin có quyền tương ứng
 *   (SUPER_ADMIN bỏ qua kiểm tra permission).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    const requiredPerms = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles?.length && !requiredPerms?.length) return true;

    const user = context.switchToHttp().getRequest().user as AuthUser;
    if (!user) throw new ForbiddenException('Không có quyền truy cập.');

    if (requiredRoles?.length && !requiredRoles.includes(user.role)) {
      throw new ForbiddenException('Bạn không có quyền với tài nguyên này.');
    }

    if (requiredPerms?.length) {
      const isSuper = user.permissions?.includes('*');
      const ok =
        isSuper || requiredPerms.every((p) => user.permissions?.includes(p));
      if (!ok) {
        throw new ForbiddenException('Thiếu quyền: ' + requiredPerms.join(', '));
      }
    }

    return true;
  }
}
