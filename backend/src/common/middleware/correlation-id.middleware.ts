import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";

export const CORRELATION_ID_HEADER = "x-request-id";
export const ALT_CORRELATION_ID_HEADER = "x-correlation-id";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      id?: string;
      correlationId?: string;
    }
  }
}

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const rawHeader =
      req.headers[CORRELATION_ID_HEADER] ||
      req.headers[ALT_CORRELATION_ID_HEADER] ||
      req.headers["x-request-id"] ||
      req.headers["x-correlation-id"];

    const correlationId =
      typeof rawHeader === "string" && rawHeader.trim().length > 0
        ? rawHeader.trim()
        : randomUUID();

    req.headers[CORRELATION_ID_HEADER] = correlationId;
    req.headers[ALT_CORRELATION_ID_HEADER] = correlationId;
    req.id = correlationId;
    req.correlationId = correlationId;

    res.setHeader("X-Request-Id", correlationId);
    res.setHeader("X-Correlation-Id", correlationId);

    next();
  }
}
