import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import * as fs from "fs";
import * as path from "path";
import { AppModule } from "../app.module";

async function exportOpenApi() {
  const app = await NestFactory.create(AppModule, { logger: false });
  const configService = app.get(ConfigService);
  const appName = configService.get<string>(
    "appName",
    "HES Logistics Platform",
  );

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
  const outputPath = path.resolve(__dirname, "../../openapi.json");

  fs.writeFileSync(outputPath, JSON.stringify(document, null, 2), "utf-8");
  console.log(
    `✅ OpenAPI specification successfully exported to: ${outputPath}`,
  );

  await app.close();
  process.exit(0);
}

exportOpenApi().catch((err) => {
  console.error("❌ Failed to export OpenAPI spec:", err);
  process.exit(1);
});
