import { Injectable, Logger } from "@nestjs/common";
import { Prisma, AuditAction } from "@prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";

export interface LogAuditParams {
  eventType: string;
  userId?: string | null;
  identifier: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Sanitizes sensitive fields before logging or database persistence.
   */
  private sanitizeMetadata(
    metadata?: Record<string, unknown>,
  ): Prisma.InputJsonValue | undefined {
    if (!metadata) return undefined;
    const sanitized = { ...metadata };
    const sensitiveKeys = [
      "password",
      "passwordHash",
      "newPassword",
      "token",
      "refreshToken",
      "accessToken",
      "secret",
    ];

    for (const key of Object.keys(sanitized)) {
      if (sensitiveKeys.includes(key.toLowerCase())) {
        sanitized[key] = "[REDACTED]";
      }
    }
    return sanitized as Prisma.InputJsonValue;
  }

  async logEvent(params: LogAuditParams): Promise<void> {
    try {
      const sanitizedMeta = this.sanitizeMetadata(params.metadata);
      const action = this.mapEventToAction(params.eventType);

      await this.prisma.auditLog.create({
        data: {
          action,
          entityType: "AUTH",
          entityId: params.userId ?? params.identifier,
          userId: params.userId ?? null,
          agencyId: null,
          ipAddress: params.ipAddress ?? null,
          userAgent: params.userAgent ?? null,
          oldValues: Prisma.JsonNull,
          newValues:
            (sanitizedMeta as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        },
      });

      this.logger.log(
        `[AUDIT] ${params.eventType} - identifier: ${params.identifier} (IP: ${params.ipAddress || "unknown"})`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to record audit log: ${(err as Error).message}`,
      );
    }
  }

  private mapEventToAction(eventType: string): AuditAction {
    const map: Record<string, AuditAction> = {
      LOGIN_FAILED: AuditAction.LOGIN,
      LOGIN_SUCCESS: AuditAction.LOGIN,
      REFRESH_SUCCESS: AuditAction.LOGIN,
      REUSE_DETECTED: AuditAction.LOGIN,
      PASSWORD_RESET_REQUEST: AuditAction.UPDATE,
      PASSWORD_RESET_COMPLETE: AuditAction.UPDATE,
      LOGOUT: AuditAction.LOGOUT,
      SECURITY_VIOLATION_AGENCY_BYPASS_ATTEMPT: AuditAction.DELETE,
    };

    return map[eventType] ?? AuditAction.UPDATE;
  }
}
