import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { paginate } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateAdminDto,
  CreateRoleDto,
  ListAdminsQueryDto,
  UpdateAdminRolesDto,
  UpdateRoleDto,
} from './dto/admins.dto';

@Injectable()
export class AdminsService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------- ADMIN ACCOUNTS ----------
  async listAdmins(query: ListAdminsQueryDto) {
    const where: Prisma.UserWhereInput = { role: UserRole.ADMIN };
    if (query.search) {
      where.OR = [
        { email: { contains: query.search, mode: 'insensitive' } },
        { fullName: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          fullName: true,
          status: true,
          lastLoginAt: true,
          createdAt: true,
          adminRoles: { include: { role: true } },
        },
        orderBy: { createdAt: query.sortOrder },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.user.count({ where }),
    ]);
    return paginate(rows, total, query.page, query.limit);
  }

  async createAdmin(dto: CreateAdminDto) {
    const passwordHash = await bcrypt.hash(dto.password, 10);
    return this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        fullName: dto.fullName,
        passwordHash,
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
        adminRoles: dto.roleIds?.length
          ? { create: dto.roleIds.map((roleId) => ({ roleId })) }
          : undefined,
      },
      select: { id: true, email: true, fullName: true, role: true },
    });
  }

  async setAdminRoles(userId: string, dto: UpdateAdminRolesDto) {
    await this.prisma.adminRoleAssignment.deleteMany({ where: { userId } });
    await this.prisma.adminRoleAssignment.createMany({
      data: dto.roleIds.map((roleId) => ({ userId, roleId })),
      skipDuplicates: true,
    });
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        adminRoles: { include: { role: true } },
      },
    });
  }

  // ---------- ROLES ----------
  async listRoles() {
    return this.prisma.adminRole.findMany({
      include: { permissions: { include: { permission: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async createRole(dto: CreateRoleDto) {
    const permIds = await this.resolvePermissionIds(dto.permissionKeys);
    return this.prisma.adminRole.create({
      data: {
        name: dto.name,
        description: dto.description,
        permissions: { create: permIds.map((permissionId) => ({ permissionId })) },
      },
      include: { permissions: { include: { permission: true } } },
    });
  }

  async updateRole(id: string, dto: UpdateRoleDto) {
    const role = await this.prisma.adminRole.findUnique({ where: { id } });
    if (!role) throw new NotFoundException('Không tìm thấy vai trò.');

    if (dto.permissionKeys) {
      const permIds = await this.resolvePermissionIds(dto.permissionKeys);
      await this.prisma.adminRolePermission.deleteMany({ where: { roleId: id } });
      await this.prisma.adminRolePermission.createMany({
        data: permIds.map((permissionId) => ({ roleId: id, permissionId })),
        skipDuplicates: true,
      });
    }
    return this.prisma.adminRole.update({
      where: { id },
      data: { description: dto.description },
      include: { permissions: { include: { permission: true } } },
    });
  }

  async removeRole(id: string) {
    await this.prisma.adminRole.delete({ where: { id } });
    return { deleted: true };
  }

  async listPermissions() {
    return this.prisma.permission.findMany({ orderBy: { key: 'asc' } });
  }

  private async resolvePermissionIds(keys?: string[]): Promise<string[]> {
    if (!keys?.length) return [];
    const perms = await this.prisma.permission.findMany({
      where: { key: { in: keys } },
      select: { id: true },
    });
    return perms.map((p) => p.id);
  }
}
