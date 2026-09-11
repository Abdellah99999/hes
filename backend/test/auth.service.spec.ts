import { Test, TestingModule } from "@nestjs/testing";
import { UnauthorizedException } from "@nestjs/common";
import { AuthService } from "../src/modules/auth/services/auth.service";
import { PasswordService } from "../src/modules/auth/services/password.service";
import { TokenService } from "../src/modules/auth/services/token.service";
import { AuditService } from "../src/modules/auth/services/audit.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { RedisService } from "../src/modules/redis/redis.service";
import { UserPermissionEffect } from "@prisma/client";

describe("AuthService (Security Core Tests)", () => {
  let authService: AuthService;
  let prismaService: {
    user: { findUnique: jest.Mock; update: jest.Mock };
    refreshToken: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
  };
  let passwordService: {
    verifyPassword: jest.Mock;
    hashPassword: jest.Mock;
  };
  let tokenService: {
    generateTokenPair: jest.Mock;
    hashToken: jest.Mock;
    generateAccessToken: jest.Mock;
  };
  let auditService: {
    logEvent: jest.Mock;
  };
  let redisService: {
    getClient: jest.Mock;
  };

  const mockUser = {
    id: "user-uuid-1",
    email: "operator@hes-logistics.com",
    passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$someSalt$realHashValue",
    firstName: "Jean",
    lastName: "Dupont",
    phone: "+33612345678",
    roleId: "role-uuid-1",
    agencyId: "agency-uuid-1",
    isActive: true,
    tokenVersion: 1,
    failedAttempts: 0,
    lockedUntil: null,
    role: {
      code: "OPERATOR",
      rolePermissions: [
        { permission: { code: "shipments:read" } },
        { permission: { code: "shipments:create" } },
      ],
    },
    userPermissions: [
      {
        permission: { code: "shipments:delete" },
        effect: UserPermissionEffect.DENY,
      },
    ],
  };

  beforeEach(async () => {
    prismaService = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      refreshToken: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    passwordService = {
      verifyPassword: jest.fn(),
      hashPassword: jest.fn(),
    };

    tokenService = {
      generateTokenPair: jest.fn(),
      hashToken: jest.fn((t: string) => `hashed_${t}`),
      generateAccessToken: jest.fn(),
    };

    auditService = {
      logEvent: jest.fn(),
    };

    redisService = {
      getClient: jest.fn().mockReturnValue({
        get: jest.fn(),
        setex: jest.fn(),
        del: jest.fn(),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaService },
        { provide: PasswordService, useValue: passwordService },
        { provide: TokenService, useValue: tokenService },
        { provide: AuditService, useValue: auditService },
        { provide: RedisService, useValue: redisService },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
  });

  describe("1. Login Workflow & Protections", () => {
    it("Scenario 1.1: should authenticate valid credentials and never expose passwordHash", async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      passwordService.verifyPassword.mockResolvedValue(true);
      tokenService.generateTokenPair.mockResolvedValue({
        accessToken: "jwt.access.token",
        refreshToken: "opaque-refresh-token",
        expiresIn: 900,
        tokenType: "Bearer",
      });

      const response = await authService.login(
        { email: "operator@hes-logistics.com", password: "ValidPassword2026!" },
        "127.0.0.1",
        "TestAgent",
      );

      expect(response.tokens.accessToken).toBe("jwt.access.token");
      expect(response.user.email).toBe("operator@hes-logistics.com");
      expect(
        (response.user as unknown as Record<string, unknown>).passwordHash,
      ).toBeUndefined();
      expect(response.user.permissions).toContain("shipments:read");
      expect(response.user.permissions).toContain("shipments:create");
      expect(prismaService.refreshToken.create).toHaveBeenCalled();
      expect(auditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: "LOGIN_SUCCESS" }),
      );
    });

    it("Scenario 1.2: should reject invalid password with generic error and record failed attempt", async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      passwordService.verifyPassword.mockResolvedValue(false);

      await expect(
        authService.login(
          { email: "operator@hes-logistics.com", password: "WrongPassword" },
          "127.0.0.1",
          "TestAgent",
        ),
      ).rejects.toThrow(new UnauthorizedException("Identifiants invalides"));

      expect(prismaService.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ failedAttempts: 1 }),
        }),
      );
      expect(auditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: "LOGIN_FAILED" }),
      );
    });

    it("Scenario 1.3: should reject deactivated accounts", async () => {
      const inactiveUser = { ...mockUser, isActive: false };
      prismaService.user.findUnique.mockResolvedValue(inactiveUser);

      await expect(
        authService.login(
          { email: "operator@hes-logistics.com", password: "AnyPassword" },
          "127.0.0.1",
        ),
      ).rejects.toThrow(new UnauthorizedException("Identifiants invalides"));
    });

    it("Scenario 1.4: should reject locked accounts", async () => {
      const lockedUser = {
        ...mockUser,
        lockedUntil: new Date(Date.now() + 10 * 60 * 1000),
      };
      prismaService.user.findUnique.mockResolvedValue(lockedUser);

      await expect(
        authService.login(
          { email: "operator@hes-logistics.com", password: "AnyPassword" },
          "127.0.0.1",
        ),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe("2. Refresh Tokens & Replay Attack Reuse Detection", () => {
    it("Scenario 2.1: should rotate valid refresh token in the same family", async () => {
      const validTokenRecord = {
        id: "token-record-1",
        tokenHash: "hashed_old-token",
        userId: mockUser.id,
        familyId: "family-uuid-1",
        isRevoked: false,
        expiresAt: new Date(Date.now() + 3600000),
        user: mockUser,
      };

      prismaService.refreshToken.findUnique.mockResolvedValue(validTokenRecord);
      tokenService.generateTokenPair.mockResolvedValue({
        accessToken: "new.jwt.access",
        refreshToken: "new-opaque-refresh",
        expiresIn: 900,
        tokenType: "Bearer",
      });

      const result = await authService.refresh("old-token", "127.0.0.1");

      expect(prismaService.refreshToken.update).toHaveBeenCalledWith({
        where: { id: "token-record-1" },
        data: { isRevoked: true },
      });
      expect(prismaService.refreshToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ familyId: "family-uuid-1" }),
        }),
      );
      expect(result.tokens.accessToken).toBe("new.jwt.access");
    });

    it("Scenario 2.2: should detect replay attack on revoked token and revoke entire family", async () => {
      const revokedTokenRecord = {
        id: "token-record-stolen",
        tokenHash: "hashed_stolen-token",
        userId: mockUser.id,
        familyId: "family-uuid-compromised",
        isRevoked: true, // ALREADY REVOKED!
        expiresAt: new Date(Date.now() + 3600000),
        user: mockUser,
      };

      prismaService.refreshToken.findUnique.mockResolvedValue(
        revokedTokenRecord,
      );

      await expect(
        authService.refresh("stolen-token", "attacker-ip"),
      ).rejects.toThrow(UnauthorizedException);

      // Whole family must be revoked immediately
      expect(prismaService.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { familyId: "family-uuid-compromised" },
        data: { isRevoked: true },
      });
      expect(auditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: "REUSE_DETECTED" }),
      );
    });
  });

  describe("3. Effective Permissions Calculation", () => {
    it("should compute Role + Grants - Denies correctly", () => {
      const user = {
        role: {
          rolePermissions: [
            { permission: { code: "shipments:read" } },
            { permission: { code: "shipments:create" } },
            { permission: { code: "reports:view" } },
          ],
        },
        userPermissions: [
          {
            permission: { code: "shipments:special_discount" },
            effect: UserPermissionEffect.GRANT,
          },
          {
            permission: { code: "reports:view" },
            effect: UserPermissionEffect.DENY,
          },
        ],
      };

      const perms = authService.calculateEffectivePermissions(user);

      expect(perms).toContain("shipments:read");
      expect(perms).toContain("shipments:create");
      expect(perms).toContain("shipments:special_discount"); // granted
      expect(perms).not.toContain("reports:view"); // denied override
    });
  });
});
