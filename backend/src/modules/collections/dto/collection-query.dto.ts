import { IsOptional, IsEnum, IsUUID, IsString } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { CollectionStatus } from "@prisma/client";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";

export class CollectionQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: CollectionStatus,
    description: "Filtrer par statut",
  })
  @IsOptional()
  @IsEnum(CollectionStatus)
  status?: CollectionStatus;

  @ApiPropertyOptional({ description: "Filtrer par agence" })
  @IsOptional()
  @IsUUID("4")
  agencyId?: string;

  @ApiPropertyOptional({ description: "Filtrer par zone d'enlèvement" })
  @IsOptional()
  @IsUUID("4")
  zoneId?: string;

  @ApiPropertyOptional({
    description: "Filtrer par date d'enlèvement (YYYY-MM-DD)",
  })
  @IsOptional()
  @IsString()
  scheduledDate?: string;
}
