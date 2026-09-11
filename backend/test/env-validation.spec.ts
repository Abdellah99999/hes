import { validateEnv } from "../src/config/env.validation";

describe("Environment Validation (Fail-Fast)", () => {
  const baseValidDevConfig = {
    APP_NAME: "HES Logistics Platform",
    NODE_ENV: "development",
    PORT: "3000",
    DATABASE_URL: "postgresql://postgres:0000@localhost:5432/delivery",
    JWT_ACCESS_SECRET:
      "hes_jwt_access_secret_super_secure_key_change_in_production",
    JWT_REFRESH_SECRET:
      "hes_jwt_refresh_secret_super_secure_key_change_in_production",
  };

  it("should pass successfully in development mode with dev defaults", () => {
    const config = validateEnv(baseValidDevConfig);
    expect(config.APP_NAME).toBe("HES Logistics Platform");
    expect(config.NODE_ENV).toBe("development");
    expect(config.PORT).toBe(3000);
  });

  it("should fail and throw an explicit error in production if insecure default secrets are used", () => {
    const productionWithDefaultSecrets = {
      ...baseValidDevConfig,
      NODE_ENV: "production",
    };

    expect(() => validateEnv(productionWithDefaultSecrets)).toThrow(
      /FATAL BOOTSTRAP CONFIGURATION ERROR/i,
    );
  });

  it("should succeed in production when strong, dedicated credentials and secrets are supplied", () => {
    const validProductionConfig = {
      APP_NAME: "HES Logistics Platform",
      NODE_ENV: "production",
      PORT: "3000",
      DATABASE_URL:
        "postgresql://prod_user:StrongPassword987!@prod-db.internal:5432/hes_prod",
      JWT_ACCESS_SECRET:
        "a_very_strong_cryptographic_jwt_access_secret_key_2026_prod",
      JWT_REFRESH_SECRET:
        "a_very_strong_cryptographic_jwt_refresh_secret_key_2026_prod",
      MINIO_SECRET_KEY: "prod_minio_super_secure_key_9988",
    };

    const config = validateEnv(validProductionConfig);
    expect(config.NODE_ENV).toBe("production");
    expect(config.JWT_ACCESS_SECRET).toBe(
      "a_very_strong_cryptographic_jwt_access_secret_key_2026_prod",
    );
  });
});
