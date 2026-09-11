import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { TokenService } from "../services/token.service";
import { RedisService } from "../../redis/redis.service";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokenService: TokenService,
    private readonly redis: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new UnauthorizedException(
        "Token d'authentification manquant ou format invalide",
      );
    }

    const token = authHeader.substring(7);

    try {
      const payload = await this.tokenService.verifyAccessToken(token);

      // Check fast in-memory Redis blacklist for immediate session revocation
      const redisClient = this.redis.getClient();
      if (redisClient) {
        const isBlacklisted = await redisClient.get(
          `user:revoked:${payload.sub}`,
        );
        if (isBlacklisted) {
          throw new UnauthorizedException(
            "Session révoquée. Veuillez vous reconnecter.",
          );
        }
      }

      const permissions = payload.permissions || [];
      const isGlobalScope =
        payload.role === "SUPER_ADMIN" ||
        payload.role === "ADMIN" ||
        permissions.includes("agencies:cross_view") ||
        permissions.includes("all_agencies:read");

      request.user = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
        agencyId: payload.agencyId ?? null,
        customerId: payload.customerId ?? null,
        tokenVersion: payload.tokenVersion,
        permissions,
        isGlobalScope,
      };

      return true;
    } catch (err) {
      if (err instanceof UnauthorizedException) {
        throw err;
      }
      throw new UnauthorizedException("Token invalide ou expiré");
    }
  }
}
