import { Test, TestingModule } from "@nestjs/testing";
import { HealthService } from "../src/modules/health/health.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { RedisService } from "../src/modules/redis/redis.service";
import { StorageService } from "../src/modules/storage/storage.service";

describe("HealthService", () => {
  let service: HealthService;
  let prismaService: jest.Mocked<Partial<PrismaService>>;
  let redisService: jest.Mocked<Partial<RedisService>>;
  let storageService: jest.Mocked<Partial<StorageService>>;

  beforeEach(async () => {
    prismaService = {
      isHealthy: jest.fn(),
    };
    redisService = {
      isHealthy: jest.fn(),
    };
    storageService = {
      isHealthy: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        { provide: PrismaService, useValue: prismaService },
        { provide: RedisService, useValue: redisService },
        { provide: StorageService, useValue: storageService },
      ],
    }).compile();

    service = module.get<HealthService>(HealthService);
  });

  it('Scenario 1 (All Up): should return status "ok" and isHealthy=true when DB, Redis, and Storage are healthy', async () => {
    (prismaService.isHealthy as jest.Mock).mockResolvedValue({
      healthy: true,
      latencyMs: 2,
    });
    (redisService.isHealthy as jest.Mock).mockResolvedValue({
      healthy: true,
      latencyMs: 1,
    });
    (storageService.isHealthy as jest.Mock).mockResolvedValue({
      healthy: true,
      latencyMs: 5,
    });

    const result = await service.checkHealth();

    expect(result.isHealthy).toBe(true);
    expect(result.data.status).toBe("ok");
    expect(result.data.services.database.status).toBe("up");
    expect(result.data.services.redis.status).toBe("up");
    expect(result.data.services.storage.status).toBe("up");
    expect(result.data.services.database.latencyMs).toBe(2);
  });

  it('Scenario 2 (Degraded / One Down): should return status "degraded" and isHealthy=true when Redis is down but DB is up', async () => {
    (prismaService.isHealthy as jest.Mock).mockResolvedValue({
      healthy: true,
      latencyMs: 3,
    });
    (redisService.isHealthy as jest.Mock).mockResolvedValue({
      healthy: false,
      latencyMs: 0,
      error: "Connection refused",
    });
    (storageService.isHealthy as jest.Mock).mockResolvedValue({
      healthy: true,
      latencyMs: 4,
    });

    const result = await service.checkHealth();

    expect(result.isHealthy).toBe(true);
    expect(result.data.status).toBe("degraded");
    expect(result.data.services.database.status).toBe("up");
    expect(result.data.services.redis.status).toBe("down");
    expect(result.data.services.redis.error).toBe("Connection refused");
    expect(result.data.services.storage.status).toBe("up");
  });

  it('Scenario 3 (All Down / DB Down): should return status "error" and isHealthy=false when DB is down', async () => {
    (prismaService.isHealthy as jest.Mock).mockResolvedValue({
      healthy: false,
      latencyMs: 10,
      error: "Database unreachable",
    });
    (redisService.isHealthy as jest.Mock).mockResolvedValue({
      healthy: false,
      latencyMs: 0,
      error: "Redis down",
    });
    (storageService.isHealthy as jest.Mock).mockResolvedValue({
      healthy: false,
      latencyMs: 0,
      error: "MinIO down",
    });

    const result = await service.checkHealth();

    expect(result.isHealthy).toBe(false);
    expect(result.data.status).toBe("error");
    expect(result.data.services.database.status).toBe("down");
    expect(result.data.services.redis.status).toBe("down");
    expect(result.data.services.storage.status).toBe("down");
  });
});
