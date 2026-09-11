import { IsOptional, IsEnum, IsUUID, IsString } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { DeliveryRunStatus, RunShift } from "@prisma/client";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";

export class DeliveryRunQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: DeliveryRunStatus })
  @IsOptional()
  @IsEnum(DeliveryRunStatus)
  status?: DeliveryRunStatus;

  @ApiPropertyOptional({ enum: RunShift })
  @IsOptional()
  @IsEnum(RunShift)
  shift?: RunShift;

  @ApiPropertyOptional({ description: "Filtrer par date (YYYY-MM-DD)" })
  @IsOptional()
  @IsString()
  runDate?: string;

  @ApiPropertyOptional({ description: "Filtrer par agence" })
  @IsOptional()
  @IsUUID("4")
  agencyId?: string;

  @ApiPropertyOptional({ description: "Filtrer par zone" })
  @IsOptional()
  @IsUUID("4")
  zoneId?: string;
}
