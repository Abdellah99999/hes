import { z } from "zod";

const INSECURE_JWT_ACCESS =
  "hes_jwt_access_secret_super_secure_key_change_in_production";
const INSECURE_JWT_REFRESH =
  "hes_jwt_refresh_secret_super_secure_key_change_in_production";
const INSECURE_MINIO_SECRET = "hes_minio_secret_key_2026";
const INSECURE_DB_URL = "postgresql://postgres:0000@localhost:5432/delivery";

export const envSchema = z
  .object({
    APP_NAME: z.string().default("HES Logistics Platform"),
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    PORT: z.coerce.number().default(3000),
    API_PREFIX: z.string().default("api/v1"),
    DATABASE_URL: z.string().default(INSECURE_DB_URL),
    REDIS_HOST: z.string().default("localhost"),
    REDIS_PORT: z.coerce.number().default(6379),
    REDIS_PASSWORD: z.string().optional().default(""),
    REDIS_URL: z.string().optional(),
    MINIO_ENDPOINT: z.string().default("localhost"),
    MINIO_PORT: z.coerce.number().default(9000),
    MINIO_USE_SSL: z.coerce.boolean().default(false),
    MINIO_ACCESS_KEY: z.string().default("hes_minio_admin"),
    MINIO_SECRET_KEY: z.string().default(INSECURE_MINIO_SECRET),
    MINIO_BUCKET_DOCS: z.string().default("hes-documents"),
    MINIO_BUCKET_POD: z.string().default("hes-proof-of-delivery"),
    JWT_ACCESS_SECRET: z.string().default(INSECURE_JWT_ACCESS),
    JWT_REFRESH_SECRET: z.string().default(INSECURE_JWT_REFRESH),
    CORS_ORIGIN: z
      .string()
      .default("http://localhost,http://localhost:8080,http://localhost:5173"),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === "production") {
      if (
        data.JWT_ACCESS_SECRET === INSECURE_JWT_ACCESS ||
        data.JWT_ACCESS_SECRET.length < 32
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["JWT_ACCESS_SECRET"],
          message:
            "Production requires a dedicated, cryptographically secure JWT_ACCESS_SECRET (min 32 characters).",
        });
      }

      if (
        data.JWT_REFRESH_SECRET === INSECURE_JWT_REFRESH ||
        data.JWT_REFRESH_SECRET.length < 32
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["JWT_REFRESH_SECRET"],
          message:
            "Production requires a dedicated, cryptographically secure JWT_REFRESH_SECRET (min 32 characters).",
        });
      }

      if (data.MINIO_SECRET_KEY === INSECURE_MINIO_SECRET) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["MINIO_SECRET_KEY"],
          message: "Production requires a non-default MINIO_SECRET_KEY.",
        });
      }

      if (data.DATABASE_URL === INSECURE_DB_URL) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["DATABASE_URL"],
          message:
            "Production DATABASE_URL must not use default dev credentials.",
        });
      }
    }
  });

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const errorDetails = parsed.error.issues
      .map(
        (issue) =>
          `  - [${issue.path.join(".") || "global"}]: ${issue.message}`,
      )
      .join("\n");

    const message = `\n❌ FATAL BOOTSTRAP CONFIGURATION ERROR:\n${errorDetails}\n\nServer startup aborted due to invalid environment variables.\n`;
    process.stderr.write(message);
    throw new Error(`FATAL BOOTSTRAP CONFIGURATION ERROR:\n${errorDetails}`);
  }
  return parsed.data;
}
