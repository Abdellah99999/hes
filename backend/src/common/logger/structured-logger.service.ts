import { Injectable, LoggerService, LogLevel } from "@nestjs/common";

const SENSITIVE_KEYS = new Set([
  "password",
  "passwordhash",
  "password_hash",
  "token",
  "refreshtoken",
  "refresh_token",
  "accesstoken",
  "access_token",
  "authorization",
  "cookie",
  "secret",
  "secret_key",
  "secretkey",
  "jwt_access_secret",
  "jwt_refresh_secret",
  "api_key",
  "apikey",
  "private_key",
  "privatekey",
  "recipientcin",
  "recipient_cin",
  "signature",
  "recipient_signature",
  "recipientsignature",
  "cvv",
  "card_number",
  "cardnumber",
  "pin",
]);

function redactSensitiveData(data: unknown, depth = 0): unknown {
  if (depth > 5 || data === null || data === undefined) {
    return data;
  }

  if (typeof data !== "object") {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => redactSensitiveData(item, depth + 1));
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = redactSensitiveData(value, depth + 1);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

@Injectable()
export class StructuredLoggerService implements LoggerService {
  private readonly appName = "hes-api";
  private readonly pid = process.pid;
  private currentLogLevels: LogLevel[] = [
    "log",
    "error",
    "warn",
    "debug",
    "verbose",
  ];

  constructor(private readonly context?: string) {}

  setLogLevels(levels: LogLevel[]): void {
    this.currentLogLevels = levels;
  }

  private shouldLog(level: LogLevel): boolean {
    return this.currentLogLevels.includes(level);
  }

  private print(
    level: "INFO" | "ERROR" | "WARN" | "DEBUG" | "TRACE",
    message: unknown,
    context?: string,
    extra?: Record<string, unknown>,
  ): void {
    const entry: Record<string, unknown> = {
      level,
      time: new Date().toISOString(),
      pid: this.pid,
      app: this.appName,
      context: context || this.context || "Application",
      msg: typeof message === "string" ? message : redactSensitiveData(message),
    };

    if (extra && Object.keys(extra).length > 0) {
      const sanitizedExtra = redactSensitiveData(extra) as Record<
        string,
        unknown
      >;
      Object.assign(entry, sanitizedExtra);
    }

    const output = JSON.stringify(entry);
    if (level === "ERROR") {
      process.stderr.write(`${output}\n`);
    } else {
      process.stdout.write(`${output}\n`);
    }
  }

  log(
    message: unknown,
    context?: string,
    extra?: Record<string, unknown>,
  ): void {
    if (!this.shouldLog("log")) return;
    this.print("INFO", message, context, extra);
  }

  error(
    message: unknown,
    trace?: string,
    context?: string,
    extra?: Record<string, unknown>,
  ): void {
    if (!this.shouldLog("error")) return;
    this.print("ERROR", message, context, { trace, ...extra });
  }

  warn(
    message: unknown,
    context?: string,
    extra?: Record<string, unknown>,
  ): void {
    if (!this.shouldLog("warn")) return;
    this.print("WARN", message, context, extra);
  }

  debug(
    message: unknown,
    context?: string,
    extra?: Record<string, unknown>,
  ): void {
    if (!this.shouldLog("debug")) return;
    this.print("DEBUG", message, context, extra);
  }

  verbose(
    message: unknown,
    context?: string,
    extra?: Record<string, unknown>,
  ): void {
    if (!this.shouldLog("verbose")) return;
    this.print("TRACE", message, context, extra);
  }
}
