import { ApiProperty } from "@nestjs/swagger";

export class ServiceHealthDetailDto {
  @ApiProperty({ example: "up", enum: ["up", "down"] })
  status!: "up" | "down";

  @ApiProperty({ example: 4, description: "Response latency in milliseconds" })
  latencyMs!: number;

  @ApiProperty({
    required: false,
    example: "Connection refused",
    description: "Error message if service is down",
  })
  error?: string;
}

export class HealthServicesMapDto {
  @ApiProperty({ type: ServiceHealthDetailDto })
  database!: ServiceHealthDetailDto;

  @ApiProperty({ type: ServiceHealthDetailDto })
  redis!: ServiceHealthDetailDto;

  @ApiProperty({ type: ServiceHealthDetailDto })
  storage!: ServiceHealthDetailDto;
}

export class HealthResponseDto {
  @ApiProperty({ example: "ok", enum: ["ok", "degraded", "error"] })
  status!: "ok" | "degraded" | "error";

  @ApiProperty({ example: "2026-08-31T23:00:00.000Z" })
  timestamp!: string;

  @ApiProperty({ example: "1.0.0" })
  version!: string;

  @ApiProperty({ example: 124.5, description: "API uptime in seconds" })
  uptimeSeconds!: number;

  @ApiProperty({ type: HealthServicesMapDto })
  services!: HealthServicesMapDto;
}
