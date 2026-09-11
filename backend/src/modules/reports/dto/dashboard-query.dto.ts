import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString, IsUUID } from "class-validator";
import { ShipmentStatus } from "@prisma/client";
import { ReportPeriod } from "../domain/report.types";

export class DashboardQueryDto {
  @ApiPropertyOptional({
    enum: ["day", "week", "month", "year"],
    default: "month",
  })
  @IsOptional()
  @IsEnum(["day", "week", "month", "year"])
  period?: ReportPeriod;

  @ApiPropertyOptional({ description: "Date de début (ISO 8601)" })
  @IsOptional()
  @IsString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: "Date de fin (ISO 8601)" })
  @IsOptional()
  @IsString()
  dateTo?: string;

  @ApiPropertyOptional({ description: "Filtrer par agence" })
  @IsOptional()
  @IsUUID()
  agencyId?: string;

  @ApiPropertyOptional({ description: "Filtrer par livreur (userId)" })
  @IsOptional()
  @IsUUID()
  courierId?: string;

  @ApiPropertyOptional({ description: "Filtrer par client" })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional({ enum: ShipmentStatus })
  @IsOptional()
  @IsEnum(ShipmentStatus)
  status?: ShipmentStatus;
}
