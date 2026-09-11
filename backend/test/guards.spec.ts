import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtAuthGuard } from "../src/modules/auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../src/modules/auth/guards/permissions.guard";
import { TokenService } from "../src/modules/auth/services/token.service";
import { RedisService } from "../src/modules/redis/redis.service";

describe("Security Guards (JwtAuthGuard & PermissionsGuard)", () => {
  let reflector: jest.Mocked<Reflector>;
  let tokenService: jest.Mocked<Partial<TokenService>>;
  let redisService: jest.Mocked<Partial<RedisService>>;
  let mockRedisClient: { get: jest.Mock };

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;

    tokenService = {
      verifyAccessToken: jest.fn(),
    };

    mockRedisClient = {
      get: jest.fn().mockResolvedValue(null),
    };

    redisService = {
      getClient: jest.fn().mockReturnValue(mockRedisClient),
    };
  });

  describe("JwtAuthGuard", () => {
    let guard: JwtAuthGuard;

    beforeEach(() => {
      guard = new JwtAuthGuard(
        reflector,
        tokenService as TokenService,
        redisService as RedisService,
      );
    });

    it("should bypass verification if route is marked @Public()", async () => {
      reflector.getAllAndOverride.mockReturnValue(true);
      const mockContext = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
      } as unknown as ExecutionContext;

      const canActivate = await guard.canActivate(mockContext);
      expect(canActivate).toBe(true);
    });

    it("should reject request with missing Authorization header", async () => {
      reflector.getAllAndOverride.mockReturnValue(false);
      const mockContext = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({ headers: {} }),
        }),
      } as unknown as ExecutionContext;

      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should reject token if user is blacklisted in Redis (revocation check)", async () => {
      reflector.getAllAndOverride.mockReturnValue(false);
      (tokenService.verifyAccessToken as jest.Mock).mockResolvedValue({
        sub: "revoked-user-uuid",
        email: "revoked@hes.com",
        role: "OPERATOR",
        tokenVersion: 1,
        permissions: ["shipments:read"],
      });
      mockRedisClient.get.mockResolvedValue("revoked");

      const mockRequest: {
        headers: Record<string, string>;
        user?: unknown;
      } = {
        headers: { authorization: "Bearer valid.signature.token" },
      };
      const mockContext = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(mockRequest),
        }),
      } as unknown as ExecutionContext;

      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        new UnauthorizedException(
          "Session révoquée. Veuillez vous reconnecter.",
        ),
      );
    });

    it("should populate request.user on valid token", async () => {
      reflector.getAllAndOverride.mockReturnValue(false);
      (tokenService.verifyAccessToken as jest.Mock).mockResolvedValue({
        sub: "valid-user-uuid",
        email: "valid@hes.com",
        role: "OPERATOR",
        tokenVersion: 1,
        permissions: ["shipments:read"],
      });
      mockRedisClient.get.mockResolvedValue(null);

      const mockRequest: {
        headers: Record<string, string>;
        user?: unknown;
      } = {
        headers: { authorization: "Bearer valid.signature.token" },
      };
      const mockContext = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(mockRequest),
        }),
      } as unknown as ExecutionContext;

      const canActivate = await guard.canActivate(mockContext);
      expect(canActivate).toBe(true);
      expect(mockRequest.user).toEqual({
        id: "valid-user-uuid",
        email: "valid@hes.com",
        role: "OPERATOR",
        agencyId: null,
        customerId: null,
        tokenVersion: 1,
        permissions: ["shipments:read"],
        isGlobalScope: false,
      });
    });
  });

  describe("PermissionsGuard", () => {
    let guard: PermissionsGuard;

    beforeEach(() => {
      guard = new PermissionsGuard(reflector);
    });

    it("should allow request if no @RequirePermissions() is set", () => {
      reflector.getAllAndOverride.mockReturnValue(undefined);
      const mockContext = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
      } as unknown as ExecutionContext;

      expect(guard.canActivate(mockContext)).toBe(true);
    });

    it("should bypass check for SUPER_ADMIN role", () => {
      reflector.getAllAndOverride
        .mockReturnValueOnce(false) // isPublic
        .mockReturnValueOnce(["users:manage"]); // requiredPermissions

      const mockContext = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            user: { role: "SUPER_ADMIN", permissions: [] },
          }),
        }),
      } as unknown as ExecutionContext;

      expect(guard.canActivate(mockContext)).toBe(true);
    });

    it("should allow access when user has required permissions", () => {
      reflector.getAllAndOverride
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(["shipments:read", "shipments:create"]);

      const mockContext = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            user: {
              role: "OPERATOR",
              permissions: [
                "shipments:read",
                "shipments:create",
                "agencies:read",
              ],
            },
          }),
        }),
      } as unknown as ExecutionContext;

      expect(guard.canActivate(mockContext)).toBe(true);
    });

    it("should throw ForbiddenException (403) when user lacks required permission", () => {
      reflector.getAllAndOverride
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(["users:manage"]);

      const mockContext = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            user: {
              role: "OPERATOR",
              permissions: ["shipments:read"],
            },
          }),
        }),
      } as unknown as ExecutionContext;

      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
    });
  });
});
