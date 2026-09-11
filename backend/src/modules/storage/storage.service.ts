import { Injectable, OnModuleInit, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as Minio from "minio";

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private client: Minio.Client | null = null;
  private bucketDocs = "hes-documents";
  private bucketPod = "hes-proof-of-delivery";

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const endPoint = this.configService.get<string>(
      "storage.endpoint",
      "localhost",
    );
    const port = this.configService.get<number>("storage.port", 9000);
    const useSSL = this.configService.get<boolean>("storage.useSSL", false);
    const accessKey = this.configService.get<string>(
      "storage.accessKey",
      "hes_minio_admin",
    );
    const secretKey = this.configService.get<string>(
      "storage.secretKey",
      "hes_minio_secret_key_2026",
    );
    this.bucketDocs = this.configService.get<string>(
      "storage.bucketDocs",
      "hes-documents",
    );
    this.bucketPod = this.configService.get<string>(
      "storage.bucketPod",
      "hes-proof-of-delivery",
    );

    try {
      this.client = new Minio.Client({
        endPoint,
        port,
        useSSL,
        accessKey,
        secretKey,
      });
      this.logger.log(
        `MinIO Storage client configured for ${endPoint}:${port}`,
      );
    } catch (error) {
      this.logger.error("Failed to configure MinIO client", error);
    }
  }

  getClient(): Minio.Client | null {
    return this.client;
  }

  async isHealthy(): Promise<{
    healthy: boolean;
    latencyMs: number;
    error?: string;
  }> {
    const start = Date.now();
    if (!this.client) {
      return {
        healthy: false,
        latencyMs: 0,
        error: "MinIO client is not initialized",
      };
    }

    try {
      // Test connectivity by listing buckets
      await this.client.listBuckets();
      return {
        healthy: true,
        latencyMs: Date.now() - start,
      };
    } catch (error) {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        error:
          error instanceof Error
            ? error.message
            : "MinIO bucket listing failed",
      };
    }
  }
}
