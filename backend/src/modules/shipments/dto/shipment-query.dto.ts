import { IsOptional, IsUUID, IsEnum } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { ShipmentStatus } from "@prisma/client";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";

export class ShipmentQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: "Filtrer par agence d'origine" })
  @IsOptional()
  @IsUUID("4")
  originAgencyId?: string;

  @ApiPropertyOptional({ description: "Filtrer par agence de destination" })
  @IsOptional()
  @IsUUID("4")
  destinationAgencyId?: string;

  @ApiPropertyOptional({ description: "Filtrer par compte client expéditeur" })
  @IsOptional()
  @IsUUID("4")
  senderCustomerId?: string;

  @ApiPropertyOptional({
    enum: ShipmentStatus,
    description: "Filtrer par statut global",
  })
  @IsOptional()
  @IsEnum(ShipmentStatus)
  globalStatus?: ShipmentStatus;
}
