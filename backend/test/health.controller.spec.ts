import { Test, TestingModule } from "@nestjs/testing";
import { Response } from "express";
import { HealthController } from "../src/modules/health/health.controller";
import { HealthService } from "../src/modules/health/health.service";
import { HealthResponseDto } from "../src/modules/health/dto/health-response.dto";

describe("HealthController", () => {
  let controller: HealthController;
  let healthService: jest.Mocked<Partial<HealthService>>;
  let mockResponse: Partial<Response>;

  beforeEach(async () => {
    healthService = {
      checkHealth: jest.fn(),
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: HealthService, useValue: healthService }],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it("should return HTTP 200 when system is healthy", async () => {
    const mockData: HealthResponseDto = {
      status: "ok",
      timestamp: new Date().toISOString(),
      version: "1.0.0",
      uptimeSeconds: 10,
      services: {
        database: { status: "up", latencyMs: 2 },
        redis: { status: "up", latencyMs: 1 },
        storage: { status: "up", latencyMs: 5 },
      },
    };

    (healthService.checkHealth as jest.Mock).mockResolvedValue({
      data: mockData,
      isHealthy: true,
    });

    await controller.getHealth(mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(200);
    expect(mockResponse.json).toHaveBeenCalledWith(mockData);
  });

  it("should return HTTP 503 when system is unhealthy (DB Down)", async () => {
    const mockData: HealthResponseDto = {
      status: "error",
      timestamp: new Date().toISOString(),
      version: "1.0.0",
      uptimeSeconds: 10,
      services: {
        database: {
          status: "down",
          latencyMs: 0,
          error: "DB Connection failed",
        },
        redis: { status: "up", latencyMs: 1 },
        storage: { status: "up", latencyMs: 5 },
      },
    };

    (healthService.checkHealth as jest.Mock).mockResolvedValue({
      data: mockData,
      isHealthy: false,
    });

    await controller.getHealth(mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(503);
    expect(mockResponse.json).toHaveBeenCalledWith(mockData);
  });
});
