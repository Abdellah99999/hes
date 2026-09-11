export default () => ({
  appName: process.env.APP_NAME || "HES Logistics Platform",
  environment: process.env.NODE_ENV || "development",
  port: parseInt(process.env.PORT || "3000", 10),
  apiPrefix: process.env.API_PREFIX || "api/v1",
  database: {
    url:
      process.env.DATABASE_URL ||
      "postgresql://postgres:0000@localhost:5432/delivery",
  },
  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
    password: process.env.REDIS_PASSWORD || "",
    url: process.env.REDIS_URL,
  },
  storage: {
    endpoint: process.env.MINIO_ENDPOINT || "localhost",
    port: parseInt(process.env.MINIO_PORT || "9000", 10),
    useSSL: process.env.MINIO_USE_SSL === "true",
    accessKey: process.env.MINIO_ACCESS_KEY || "hes_minio_admin",
    secretKey: process.env.MINIO_SECRET_KEY || "hes_minio_secret_key_2026",
    bucketDocs: process.env.MINIO_BUCKET_DOCS || "hes-documents",
    bucketPod: process.env.MINIO_BUCKET_POD || "hes-proof-of-delivery",
  },
  security: {
    jwtAccessSecret:
      process.env.JWT_ACCESS_SECRET ||
      "hes_jwt_access_secret_super_secure_key_change_in_production",
    jwtRefreshSecret:
      process.env.JWT_REFRESH_SECRET ||
      "hes_jwt_refresh_secret_super_secure_key_change_in_production",
    corsOrigins: (
      process.env.CORS_ORIGIN ||
      "http://localhost,http://localhost:8080,http://localhost:5173"
    )
      .split(",")
      .map((origin) => origin.trim()),
  },
});
