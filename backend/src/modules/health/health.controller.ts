import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Response } from "express";
import { HealthService } from "./health.service";
import { HealthResponseDto } from "./dto/health-response.dto";

@ApiTags("Health & Monitoring")
@Controller("health")
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({
    summary: "Check system health and dependent services status",
    description:
      "Inspects live connectivity for PostgreSQL database, Redis caching, and MinIO object storage. Returns 200 OK when operational or degraded, 503 Service Unavailable when critical components fail.",
  })
  @ApiResponse({
    status: 200,
    description: "All services or non-critical services are operational",
    type: HealthResponseDto,
  })
  @ApiResponse({
    status: 503,
    description: "One or more critical services (e.g. database) are down",
    type: HealthResponseDto,
  })
  async getHealth(@Res() res: Response): Promise<Response> {
    const { data, isHealthy } = await this.healthService.checkHealth();
    const statusCode = isHealthy
      ? HttpStatus.OK
      : HttpStatus.SERVICE_UNAVAILABLE;
    return res.status(statusCode).json(data);
  }
}
