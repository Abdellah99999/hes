import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { RedisService } from "../../redis/redis.service";
import { PasswordService } from "./password.service";
import { TokenService } from "./token.service";
import { AuditService } from "./audit.service";
import { TotpService } from "./totp.service";
import { LoginDto } from "../dto/login.dto";
import {
  ForgotPasswordDto,
  ResetPasswordDto,
} from "../dto/forgot-password.dto";
import {
  AuthResponseDto,
  UserDto,
  MessageResponseDto,
} from "../dto/auth-response.dto";
import { TwoFactorSetupResponseDto } from "../dto/two-factor.dto";
import { JwtPayload } from "../domain/auth.types";
import { AuditEventType, UserPermissionEffect } from "@prisma/client";
import * as crypto from "crypto";

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly MAX_FAILED_ATTEMPTS = 5;
  private readonly LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
  private readonly REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly auditService: AuditService,
    private readonly totpService: TotpService,
  ) {}

  /**
   * Calculates effective permissions for a user:
   * Effective = (Role Permissions U User Grants) \ User Denies
   */
  calculateEffectivePermissions(user: {
    role: {
      rolePermissions: { permission: { code: string } }[];
    };
    userPermissions: {
      permission: { code: string };
      effect: UserPermissionEffect;
    }[];
  }): string[] {
    const permissionsSet = new Set<string>();

    // 1. Add all role permissions
    for (const rp of user.role.rolePermissions) {
      permissionsSet.add(rp.permission.code);
    }

    // 2. Apply user-specific overrides
    for (const up of user.userPermissions) {
      if (up.effect === UserPermissionEffect.GRANT) {
        permissionsSet.add(up.permission.code);
      } else if (up.effect === UserPermissionEffect.DENY) {
        permissionsSet.delete(up.permission.code);
      }
    }

    return Array.from(permissionsSet);
  }

  /**
   * Sanitizes a user entity into UserDto (ensuring passwordHash is NEVER exposed)
   */
  toUserDto(
    user: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      phone?: string | null;
      agencyId?: string | null;
      isActive: boolean;
      role: { code: string };
      twoFactorEnabled?: boolean;
    },
    effectivePermissions: string[],
  ): UserDto {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone ?? null,
      role: user.role.code,
      agencyId: user.agencyId ?? null,
      isActive: user.isActive,
      permissions: effectivePermissions,
      twoFactorEnabled: user.twoFactorEnabled ?? false,
    };
  }

  /**
   * Authenticates user credentials with rate-limiting & lockout checks.
   */
  async login(
    dto: LoginDto,
    ip?: string,
    userAgent?: string,
  ): Promise<AuthResponseDto> {
    const normalizedEmail = dto.email.trim().toLowerCase();

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
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
      },
    });

    // Dummy hash comparison to prevent timing attack enumeration if user is missing
    if (!user) {
      await this.passwordService.verifyPassword(
        "$argon2id$v=19$m=65536,t=3,p=4$dummySaltString123$dummyHashOutputValue12345678901234567890",
        dto.password,
      );
      await this.auditService.logEvent({
        eventType: AuditEventType.LOGIN_FAILED,
        identifier: normalizedEmail,
        ipAddress: ip,
        userAgent,
        metadata: { reason: "User not found" },
      });
      throw new UnauthorizedException("Identifiants invalides");
    }

    // Check account lockout
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await this.auditService.logEvent({
        eventType: AuditEventType.LOGIN_FAILED,
        userId: user.id,
        identifier: normalizedEmail,
        ipAddress: ip,
        userAgent,
        metadata: { reason: "Account locked", lockedUntil: user.lockedUntil },
      });
      throw new UnauthorizedException(
        "Compte temporairement verrouillé suite à de multiples échecs. Veuillez patienter 15 minutes.",
      );
    }

    // Check if account is active
    if (!user.isActive) {
      await this.auditService.logEvent({
        eventType: AuditEventType.LOGIN_FAILED,
        userId: user.id,
        identifier: normalizedEmail,
        ipAddress: ip,
        userAgent,
        metadata: { reason: "Account inactive" },
      });
      throw new UnauthorizedException("Identifiants invalides");
    }

    // Verify Argon2id password
    const isPasswordValid = await this.passwordService.verifyPassword(
      user.passwordHash,
      dto.password,
    );

    if (!isPasswordValid) {
      const newFailedAttempts = user.failedAttempts + 1;
      const willLock = newFailedAttempts >= this.MAX_FAILED_ATTEMPTS;
      const lockedUntil = willLock
        ? new Date(Date.now() + this.LOCKOUT_DURATION_MS)
        : null;

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedAttempts: newFailedAttempts,
          lockedUntil,
        },
      });

      await this.auditService.logEvent({
        eventType: AuditEventType.LOGIN_FAILED,
        userId: user.id,
        identifier: normalizedEmail,
        ipAddress: ip,
        userAgent,
        metadata: {
          failedAttempts: newFailedAttempts,
          locked: willLock,
        },
      });

      throw new UnauthorizedException("Identifiants invalides");
    }

    // Reset failed attempts & update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });

    if (!user.role) {
      throw new UnauthorizedException("Rôle utilisateur non assigné");
    }

    const permissions = this.calculateEffectivePermissions({
      ...user,
      role: user.role,
    });
    const familyId = crypto.randomUUID();

    // 2FA obligatoire pour ADMIN, SUPER_ADMIN et FINANCE (Comptable)
    const is2faMandatoryRole =
      user.role.code === "ADMIN" ||
      user.role.code === "SUPER_ADMIN" ||
      user.role.code === "FINANCE";
    const requires2fa = is2faMandatoryRole || user.twoFactorEnabled;

    if (requires2fa) {
      if (!user.twoFactorEnabled) {
        // Non enrôlé : délivre un jeton restreint limité aux endpoints d'enrôlement 2FA
        const restrictedToken = await this.tokenService.generateAccessToken({
          sub: user.id,
          email: user.email,
          role: user.role.code,
          agencyId: user.agencyId ?? null,
          tokenVersion: user.tokenVersion,
          permissions: ["auth:2fa:enroll"],
          sessionId: familyId,
          isRestricted2fa: true,
        });

        await this.auditService.logEvent({
          eventType: AuditEventType.LOGIN_SUCCESS,
          userId: user.id,
          identifier: normalizedEmail,
          ipAddress: ip,
          userAgent,
          metadata: { role: user.role.code, twoFactor: "ENROLLMENT_REQUIRED" },
        });

        return {
          user: this.toUserDto({ ...user, role: user.role }, permissions),
          tokens: {
            accessToken: restrictedToken,
            refreshToken: "",
            expiresIn: 900,
            tokenType: "Bearer",
            sessionId: familyId,
          },
          requires2fa: true,
          twoFactorEnrolled: false,
        };
      }

      // Si enrôlé : code TOTP exigé avant les jetons complets
      const tempToken = await this.tokenService.generateAccessToken({
        sub: user.id,
        email: user.email,
        role: user.role.code,
        agencyId: user.agencyId ?? null,
        tokenVersion: user.tokenVersion,
        permissions: ["auth:2fa:verify"],
        sessionId: familyId,
        isRestricted2fa: true,
      });

      return {
        user: this.toUserDto({ ...user, role: user.role }, permissions),
        requires2fa: true,
        twoFactorEnrolled: true,
        tempToken,
      };
    }

    const tokens = await this.tokenService.generateTokenPair(
      {
        sub: user.id,
        email: user.email,
        role: user.role.code,
        agencyId: user.agencyId ?? null,
        tokenVersion: user.tokenVersion,
        permissions,
        sessionId: familyId,
      },
      familyId,
    );

    // Store hashed refresh token in database
    const tokenHash = this.tokenService.hashToken(tokens.refreshToken);
    await this.prisma.refreshToken.create({
      data: {
        tokenHash,
        userId: user.id,
        familyId,
        expiresAt: new Date(Date.now() + this.REFRESH_TOKEN_TTL_MS),
        ipAddress: ip ?? null,
        userAgent: userAgent ?? null,
      },
    });

    await this.auditService.logEvent({
      eventType: AuditEventType.LOGIN_SUCCESS,
      userId: user.id,
      identifier: normalizedEmail,
      ipAddress: ip,
      userAgent,
      metadata: { role: user.role.code },
    });

    return {
      user: this.toUserDto({ ...user, role: user.role }, permissions),
      tokens,
    };
  }

  /**
   * Refreshes access token with family-based reuse detection.
   */
  async refresh(
    rawRefreshToken: string,
    ip?: string,
    userAgent?: string,
  ): Promise<AuthResponseDto> {
    const tokenHash = this.tokenService.hashToken(rawRefreshToken);

    const tokenRecord = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          include: {
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
          },
        },
      },
    });

    if (!tokenRecord || tokenRecord.expiresAt < new Date()) {
      await this.auditService.logEvent({
        eventType: AuditEventType.LOGIN_FAILED,
        identifier: "refresh_attempt",
        ipAddress: ip,
        userAgent,
        metadata: { reason: "Invalid or expired refresh token" },
      });
      throw new UnauthorizedException("Session expirée ou invalide");
    }

    // Replay attack detection: token was already revoked!
    if (tokenRecord.isRevoked) {
      await this.prisma.refreshToken.updateMany({
        where: { familyId: tokenRecord.familyId },
        data: { isRevoked: true },
      });

      await this.auditService.logEvent({
        eventType: AuditEventType.REUSE_DETECTED,
        userId: tokenRecord.userId,
        identifier: tokenRecord.user.email,
        ipAddress: ip,
        userAgent,
        metadata: {
          familyId: tokenRecord.familyId,
          compromisedTokenHash: tokenHash,
        },
      });

      throw new UnauthorizedException(
        "Alerte de sécurité : réutilisation de token détectée. Session invalidée.",
      );
    }

    const { user } = tokenRecord;

    if (!user.isActive) {
      throw new UnauthorizedException("Compte inactif");
    }

    // Revoke current refresh token (one-time use rotation)
    await this.prisma.refreshToken.update({
      where: { id: tokenRecord.id },
      data: { isRevoked: true },
    });

    if (!user.role) {
      throw new UnauthorizedException("Rôle utilisateur non assigné");
    }

    const permissions = this.calculateEffectivePermissions({
      ...user,
      role: user.role,
    });

    // Generate new token pair in the SAME family
    const tokens = await this.tokenService.generateTokenPair({
      sub: user.id,
      email: user.email,
      role: user.role.code,
      agencyId: user.agencyId ?? null,
      tokenVersion: user.tokenVersion,
      permissions,
    });

    const newTokenHash = this.tokenService.hashToken(tokens.refreshToken);
    await this.prisma.refreshToken.create({
      data: {
        tokenHash: newTokenHash,
        userId: user.id,
        familyId: tokenRecord.familyId,
        expiresAt: new Date(Date.now() + this.REFRESH_TOKEN_TTL_MS),
        ipAddress: ip ?? null,
        userAgent: userAgent ?? null,
      },
    });

    await this.auditService.logEvent({
      eventType: AuditEventType.REFRESH_SUCCESS,
      userId: user.id,
      identifier: user.email,
      ipAddress: ip,
      userAgent,
      metadata: { familyId: tokenRecord.familyId },
    });

    return {
      user: this.toUserDto({ ...user, role: user.role }, permissions),
      tokens,
    };
  }

  /**
   * Logs out user by revoking the current refresh token and blacklisting session ID in Redis.
   */
  async logout(
    userId: string,
    rawRefreshToken?: string,
    ip?: string,
    userAgent?: string,
    sessionId?: string,
  ): Promise<MessageResponseDto> {
    if (rawRefreshToken) {
      const tokenHash = this.tokenService.hashToken(rawRefreshToken);
      await this.prisma.refreshToken.updateMany({
        where: { tokenHash, userId },
        data: { isRevoked: true },
      });
    }

    if (sessionId) {
      await this.prisma.refreshToken.updateMany({
        where: { userId, familyId: sessionId },
        data: { isRevoked: true },
      });

      const redisClient = this.redis.getClient();
      if (redisClient) {
        await redisClient.setex(`session:revoked:${sessionId}`, 900, "revoked");
      }
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    await this.auditService.logEvent({
      eventType: AuditEventType.LOGOUT,
      userId,
      identifier: user?.email || userId,
      ipAddress: ip,
      userAgent,
      metadata: { sessionId },
    });

    return { message: "Déconnexion réussie" };
  }

  /**
   * Revokes a specific session immediately across Redis and DB.
   */
  async revokeSession(userId: string, sessionId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: {
        userId,
        OR: [{ familyId: sessionId }, { id: sessionId }],
      },
      data: { isRevoked: true },
    });

    const redisClient = this.redis.getClient();
    if (redisClient) {
      await redisClient.setex(`session:revoked:${sessionId}`, 900, "revoked");
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    await this.auditService.logEvent({
      eventType: AuditEventType.LOGOUT,
      userId,
      identifier: user?.email || userId,
      metadata: { action: "SESSION_REVOKED", sessionId },
    });
  }

  /**
   * 2FA Setup: generates a new TOTP secret and stores in Redis pending verification.
   */
  async setup2fa(userId: string): Promise<TwoFactorSetupResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException("Utilisateur non trouvé");
    }

    const { secret, otpauthUrl } = this.totpService.generateSecret(user.email);

    const redisClient = this.redis.getClient();
    if (redisClient) {
      await redisClient.setex(`2fa:pending:${userId}`, 600, secret);
    }

    return { secret, otpauthUrl };
  }

  /**
   * 2FA Verify Setup: verifies TOTP code, enables 2FA on user, and emits full tokens.
   */
  async verifySetup2fa(
    userId: string,
    code: string,
    ip?: string,
    userAgent?: string,
  ): Promise<AuthResponseDto> {
    const redisClient = this.redis.getClient();
    let secret: string | null = null;
    if (redisClient) {
      secret = await redisClient.get(`2fa:pending:${userId}`);
    }

    if (!secret) {
      throw new BadRequestException(
        "Session d'enrôlement 2FA expirée ou inexistante. Veuillez recommencer.",
      );
    }

    const isValid = this.totpService.verifyCode(secret, code);
    if (!isValid) {
      throw new BadRequestException("Code TOTP invalide. Veuillez réessayer.");
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: true,
        twoFactorSecret: secret,
      },
      include: {
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
      },
    });

    if (redisClient) {
      await redisClient.del(`2fa:pending:${userId}`);
    }

    if (!updatedUser.role) {
      throw new UnauthorizedException("Rôle utilisateur non assigné");
    }

    const permissions = this.calculateEffectivePermissions({
      ...updatedUser,
      role: updatedUser.role,
    });
    const familyId = crypto.randomUUID();

    const tokens = await this.tokenService.generateTokenPair(
      {
        sub: updatedUser.id,
        email: updatedUser.email,
        role: updatedUser.role.code,
        agencyId: updatedUser.agencyId ?? null,
        tokenVersion: updatedUser.tokenVersion,
        permissions,
        sessionId: familyId,
      },
      familyId,
    );

    const tokenHash = this.tokenService.hashToken(tokens.refreshToken);
    await this.prisma.refreshToken.create({
      data: {
        tokenHash,
        userId: updatedUser.id,
        familyId,
        expiresAt: new Date(Date.now() + this.REFRESH_TOKEN_TTL_MS),
        ipAddress: ip ?? null,
        userAgent: userAgent ?? null,
      },
    });

    await this.auditService.logEvent({
      eventType: AuditEventType.LOGIN_SUCCESS,
      userId: updatedUser.id,
      identifier: updatedUser.email,
      ipAddress: ip,
      userAgent,
      metadata: { action: "2FA_ENROLLED" },
    });

    return {
      user: this.toUserDto(
        { ...updatedUser, role: updatedUser.role },
        permissions,
      ),
      tokens,
      requires2fa: false,
      twoFactorEnrolled: true,
    };
  }

  /**
   * 2FA Verify: validates TOTP with restricted temp token, returns full tokens.
   */
  async verify2fa(
    rawToken: string | undefined,
    code: string,
    ip?: string,
    userAgent?: string,
  ): Promise<AuthResponseDto> {
    if (!rawToken) {
      throw new UnauthorizedException("Jeton temporaire 2FA manquant");
    }

    let payload: JwtPayload;
    try {
      payload = await this.tokenService.verifyAccessToken(rawToken);
    } catch {
      throw new UnauthorizedException(
        "Jeton temporaire 2FA invalide ou expiré",
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
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
      },
    });

    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      throw new BadRequestException(
        "Configuration 2FA introuvable pour ce compte",
      );
    }

    const isValid = this.totpService.verifyCode(user.twoFactorSecret, code);
    if (!isValid) {
      await this.auditService.logEvent({
        eventType: AuditEventType.LOGIN_FAILED,
        userId: user.id,
        identifier: user.email,
        ipAddress: ip,
        userAgent,
        metadata: { reason: "Invalid 2FA code" },
      });
      throw new UnauthorizedException("Code TOTP invalide");
    }

    if (!user.role) {
      throw new UnauthorizedException("Rôle utilisateur non assigné");
    }

    const permissions = this.calculateEffectivePermissions({
      ...user,
      role: user.role,
    });
    const familyId = crypto.randomUUID();

    const tokens = await this.tokenService.generateTokenPair(
      {
        sub: user.id,
        email: user.email,
        role: user.role.code,
        agencyId: user.agencyId ?? null,
        tokenVersion: user.tokenVersion,
        permissions,
        sessionId: familyId,
      },
      familyId,
    );

    const tokenHash = this.tokenService.hashToken(tokens.refreshToken);
    await this.prisma.refreshToken.create({
      data: {
        tokenHash,
        userId: user.id,
        familyId,
        expiresAt: new Date(Date.now() + this.REFRESH_TOKEN_TTL_MS),
        ipAddress: ip ?? null,
        userAgent: userAgent ?? null,
      },
    });

    await this.auditService.logEvent({
      eventType: AuditEventType.LOGIN_SUCCESS,
      userId: user.id,
      identifier: user.email,
      ipAddress: ip,
      userAgent,
      metadata: { role: user.role.code, twoFactor: true },
    });

    return {
      user: this.toUserDto({ ...user, role: user.role }, permissions),
      tokens,
    };
  }

  /**
   * Revokes all active sessions for a user (on role change, password reset, or account lock).
   */
  async revokeAllSessions(userId: string): Promise<void> {
    // 1. Invalidate refresh tokens
    await this.prisma.refreshToken.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true },
    });

    // 2. Increment token version
    await this.prisma.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
    });

    // 3. Blacklist user in Redis for 15 minutes (Access Token max TTL)
    const redisClient = this.redis.getClient();
    if (redisClient) {
      await redisClient.setex(`user:revoked:${userId}`, 900, "revoked");
    }
  }

  /**
   * Initiates password reset flow. Prevents user enumeration by returning a generic response.
   */
  async forgotPassword(
    dto: ForgotPasswordDto,
    ip?: string,
    userAgent?: string,
  ): Promise<MessageResponseDto> {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (user && user.isActive) {
      const resetToken = crypto.randomBytes(32).toString("hex");
      const redisClient = this.redis.getClient();

      if (redisClient) {
        // Store reset token with 1 hour TTL
        await redisClient.setex(`password_reset:${resetToken}`, 3600, user.id);
      }

      await this.auditService.logEvent({
        eventType: AuditEventType.PASSWORD_RESET_REQUEST,
        userId: user.id,
        identifier: normalizedEmail,
        ipAddress: ip,
        userAgent,
      });

      this.logger.log(
        `[SECURITY] Password reset token generated for ${normalizedEmail}`,
      );
    }

    return {
      message:
        "Si l'adresse correspond à un compte actif, des instructions de réinitialisation ont été envoyées.",
    };
  }

  /**
   * Resets password using a validated token.
   */
  async resetPassword(
    dto: ResetPasswordDto,
    ip?: string,
    userAgent?: string,
  ): Promise<MessageResponseDto> {
    const redisClient = this.redis.getClient();
    if (!redisClient) {
      throw new BadRequestException(
        "Service de réinitialisation temporairement indisponible",
      );
    }

    const userId = await redisClient.get(`password_reset:${dto.token}`);

    if (!userId) {
      throw new BadRequestException(
        "Token de réinitialisation invalide ou expiré",
      );
    }

    const newPasswordHash = await this.passwordService.hashPassword(
      dto.newPassword,
    );

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: newPasswordHash,
        failedAttempts: 0,
        lockedUntil: null,
      },
    });

    // Consume reset token
    await redisClient.del(`password_reset:${dto.token}`);

    // Invalidate all existing sessions
    await this.revokeAllSessions(userId);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    await this.auditService.logEvent({
      eventType: AuditEventType.PASSWORD_RESET_COMPLETE,
      userId,
      identifier: user?.email || userId,
      ipAddress: ip,
      userAgent,
    });

    return {
      message:
        "Mot de passe réinitialisé avec succès. Vous pouvez vous connecter.",
    };
  }

  /**
   * Gets current user profile with resolved permissions.
   */
  async getCurrentUserProfile(userId: string): Promise<UserDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
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
      },
    });

    if (!user || !user.isActive || !user.role) {
      throw new UnauthorizedException(
        "Utilisateur introuvable, inactif ou sans rôle",
      );
    }

    const permissions = this.calculateEffectivePermissions({
      ...user,
      role: user.role,
    });
    return this.toUserDto({ ...user, role: user.role }, permissions);
  }
}
