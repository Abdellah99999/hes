import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";
import { StructuredLoggerService } from "./common/logger/structured-logger.service";

async function bootstrap() {
  const structuredLogger = new StructuredLoggerService("Bootstrap");
  const app = await NestFactory.create(AppModule, {
    logger: structuredLogger,
  });

  const configService = app.get(ConfigService);
  const appName = configService.get<string>(
    "appName",
    "HES Logistics Platform",
  );
  const port = configService.get<number>("port", 3000);
  const apiPrefix = configService.get<string>("apiPrefix", "api/v1");
  const corsOrigins = configService.get<string[]>("security.corsOrigins", [
    "http://localhost",
  ]);

  // Global prefix: /api/v1
  app.setGlobalPrefix(apiPrefix);

  // Security headers with Helmet & Cookie Parser
  app.use(helmet());
  app.use(cookieParser());

  // Strict CORS policy
  app.enableCors({
    origin: corsOrigins,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // OpenAPI / Swagger Configuration
  const swaggerConfig = new DocumentBuilder()
    .setTitle(`${appName} API`)
    .setDescription(
      "Enterprise Multi-Agency Logistics, Parcel Transport, Dispatch, Tracking & Billing REST API.",
    )
    .setVersion("1.0.0")
    .addBearerAuth(
      {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Enter your JWT access token",
      },
      "JWT-auth",
    )
    .addTag("Health & Monitoring", "Infrastructure health and readiness probes")
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(`${apiPrefix}/docs`, app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  // Enable graceful shutdown hooks
  app.enableShutdownHooks();

  await app.listen(port);
  structuredLogger.log(
    `🚀 ${appName} API running on: http://localhost:${port}/${apiPrefix}`,
  );
  structuredLogger.log(
    `📚 Swagger documentation available on: http://localhost:${port}/${apiPrefix}/docs`,
  );
}

bootstrap().catch((err) => {
  console.error("Fatal bootstrap error:", err);
  process.exit(1);
});
