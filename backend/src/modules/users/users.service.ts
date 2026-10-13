import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { UserStatus, UserPermissionEffect } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { PasswordService } from "../auth/services/password.service";
import { AuthService } from "../auth/services/auth.service";
import { CreateUserDto, UpdateUserDto } from "./dto/user-crud.dto";
import { UserDto } from "../auth/dto/auth-response.dto";

const USER_INCLUDE = {
  role: {
    include: {
      rolePermissions: {
        include: { permission: true },
      },
    },
  },
  userPermissions: {
    include: { permission: true },
  },
} as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly authService: AuthService,
  ) {}

  private mapToUserDto(user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone?: string | null;
    agencyId?: string | null;
    status: UserStatus;
    role: {
      code: string;
      rolePermissions: { permission: { code: string } }[];
    } | null;
    userPermissions: {
      permission: { code: string };
      effect: UserPermissionEffect;
    }[];
  }): UserDto {
    const effectiveRole = user.role ?? {
      code: "SUPPORT",
      rolePermissions: [],
    };

    const effectiveUser = {
      ...user,
      isActive: user.status === UserStatus.ACTIVE,
      role: effectiveRole,
    };

    const permissions =
      this.authService.calculateEffectivePermissions(effectiveUser);
    return this.authService.toUserDto(effectiveUser, permissions);
  }

  async findAll(): Promise<UserDto[]> {
    const users = await this.prisma.user.findMany({
      include: USER_INCLUDE,
      orderBy: { createdAt: "desc" },
    });

    return users.map((user) => this.mapToUserDto(user));
  }

  async findById(id: string): Promise<UserDto> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: USER_INCLUDE,
    });

    if (!user) {
      throw new NotFoundException("Utilisateur non trouvé");
    }

    return this.mapToUserDto(user);
  }

  async create(dto: CreateUserDto): Promise<UserDto> {
    const normalizedEmail = dto.email.trim().toLowerCase();

    const existing = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      throw new ConflictException("Un utilisateur avec cet email existe déjà");
    }

    const role = await this.prisma.role.findUnique({
      where: { id: dto.roleId },
    });

    if (!role) {
      throw new BadRequestException("Le rôle spécifié est introuvable");
    }

    const passwordHash = await this.passwordService.hashPassword(dto.password);

    const user = await this.prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        fullName: `${dto.firstName} ${dto.lastName}`.trim(),
        phone: dto.phone ?? null,
        agencyId: dto.agencyId ?? null,
        roleId: dto.roleId,
        status: UserStatus.ACTIVE,
      },
      include: USER_INCLUDE,
    });

    return this.mapToUserDto(user);
  }

  async update(id: string, dto: UpdateUserDto): Promise<UserDto> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException("Utilisateur non trouvé");
    }

    const nextFullName = [
      dto.firstName ?? user.fullName.split(/\s+/)[0] ?? "",
      dto.lastName ?? user.fullName.split(/\s+/).slice(1).join(" ") ?? "",
    ]
      .filter(Boolean)
      .join(" ");

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.firstName || dto.lastName ? { fullName: nextFullName } : {}),
        phone: dto.phone ?? undefined,
        agencyId: dto.agencyId ?? undefined,
        roleId: dto.roleId ?? undefined,
      },
      include: USER_INCLUDE,
    });

    if (dto.roleId && dto.roleId !== user.roleId) {
      await this.authService.revokeAllSessions(id);
    }

    return this.mapToUserDto(updated);
  }

  async toggleActive(id: string, isActive: boolean): Promise<UserDto> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException("Utilisateur non trouvé");
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: { status: isActive ? UserStatus.ACTIVE : UserStatus.INACTIVE },
      include: USER_INCLUDE,
    });

    if (!isActive) {
      await this.authService.revokeAllSessions(id);
    }

    return this.mapToUserDto(updated);
  }

  async getUserSessions(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("Utilisateur non trouvé");
    }

    const tokens = await this.prisma.refreshToken.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    return tokens.map((t) => ({
      id: t.familyId || t.id,
      refreshTokenId: t.id,
      familyId: t.familyId,
      ipAddress: t.ipAddress,
      userAgent: t.userAgent,
      expiresAt: t.expiresAt,
      isRevoked: t.isRevoked || t.expiresAt < new Date(),
      createdAt: t.createdAt,
    }));
  }

  async revokeUserSession(userId: string, sessionId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("Utilisateur non trouvé");
    }

    await this.authService.revokeSession(userId, sessionId);
    return { message: "Session révoquée avec succès" };
  }

  async getUserPermissions(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: USER_INCLUDE,
    });
    if (!user) {
      throw new NotFoundException("Utilisateur non trouvé");
    }

    const rolePerms =
      user.role?.rolePermissions.map((rp) => rp.permission.code) || [];
    const overrides = user.userPermissions.map((up) => ({
      permissionId: up.permission.id,
      code: up.permission.code,
      name: up.permission.name,
      effect: up.effect,
    }));
    const effective = this.authService.calculateEffectivePermissions({
      role: user.role || { rolePermissions: [] },
      userPermissions: user.userPermissions,
    });

    return {
      userId: user.id,
      role: user.role?.code || null,
      rolePermissions: rolePerms,
      overrides,
      effectivePermissions: effective,
    };
  }

  async overrideUserPermission(
    userId: string,
    permissionCode: string,
    effect: UserPermissionEffect,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("Utilisateur non trouvé");
    }

    const perm = await this.prisma.permission.findUnique({
      where: { code: permissionCode },
    });
    if (!perm) {
      throw new NotFoundException(`Permission ${permissionCode} introuvable`);
    }

    await this.prisma.userPermission.upsert({
      where: {
        userId_permissionId: {
          userId,
          permissionId: perm.id,
        },
      },
      update: { effect },
      create: {
        userId,
        permissionId: perm.id,
        effect,
      },
    });

    await this.authService.revokeAllSessions(userId);

    return this.getUserPermissions(userId);
  }

  async deleteUserPermissionOverride(userId: string, permissionCode: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("Utilisateur non trouvé");
    }

    const perm = await this.prisma.permission.findUnique({
      where: { code: permissionCode },
    });
    if (!perm) {
      throw new NotFoundException(`Permission ${permissionCode} introuvable`);
    }

    await this.prisma.userPermission.deleteMany({
      where: {
        userId,
        permissionId: perm.id,
      },
    });

    await this.authService.revokeAllSessions(userId);

    return this.getUserPermissions(userId);
  }
}
