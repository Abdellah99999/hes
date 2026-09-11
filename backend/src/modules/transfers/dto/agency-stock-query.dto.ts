import { IsOptional, IsEnum } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { ParcelStatus } from "@prisma/client";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";

export class AgencyStockQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: ParcelStatus,
    description:
      "Filtrer par statut présent en agence (REGISTERED, AT_HUB, OUT_FOR_DELIVERY, DELIVERY_FAILED, etc.)",
  })
  @IsOptional()
  @IsEnum(ParcelStatus)
  status?: ParcelStatus;
}
