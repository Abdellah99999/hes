import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsUUID } from "class-validator";
import { ShipmentStatus } from "@prisma/client";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";
import { ExportFormat, ReportPeriod, ReportType } from "../domain/report.types";

export class ReportDataQueryDto extends PaginationQueryDto {
  @ApiProperty({
    enum: ["SHIPMENTS", "DELIVERIES", "COLLECTIONS", "INCIDENTS", "REVENUE"],
  })
  @IsEnum(["SHIPMENTS", "DELIVERIES", "COLLECTIONS", "INCIDENTS", "REVENUE"])
  type!: ReportType;

  @ApiPropertyOptional({
    enum: ["day", "week", "month", "year"],
    default: "month",
  })
  @IsOptional()
  @IsEnum(["day", "week", "month", "year"])
  period?: ReportPeriod;

  @ApiPropertyOptional()
  @IsOptional()
  dateFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  dateTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  agencyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  courierId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional({ enum: ShipmentStatus })
  @IsOptional()
  @IsEnum(ShipmentStatus)
  status?: ShipmentStatus;
}

export class ReportExportQueryDto extends ReportDataQueryDto {
  @ApiProperty({ enum: ["pdf", "excel"] })
  @IsEnum(["pdf", "excel"])
  format!: ExportFormat;
}
