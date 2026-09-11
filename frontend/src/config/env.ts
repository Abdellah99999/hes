import { z } from "zod";

const envSchema = z.object({
  VITE_API_URL: z
    .string()
    .url("VITE_API_URL must be a valid URL if provided")
    .optional()
    .or(z.literal("")),
  MODE: z.string().default("development"),
});

export type FrontendEnv = z.infer<typeof envSchema>;

export function validateFrontendEnv(): FrontendEnv {
  const envToValidate = {
    VITE_API_URL: import.meta.env.VITE_API_URL,
    MODE: import.meta.env.MODE,
  };

  const parsed = envSchema.safeParse(envToValidate);
  if (!parsed.success) {
    const errorDetails = parsed.error.issues
      .map((issue) => `[${issue.path.join(".") || "global"}]: ${issue.message}`)
      .join("\n");

    console.error("❌ Fatal Frontend Configuration Error:\n" + errorDetails);
    throw new Error(`Invalid frontend environment variables:\n${errorDetails}`);
  }

  return parsed.data;
}

export const env = validateFrontendEnv();
