import { IsOptional, IsEnum, IsUUID } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { TransferStatus } from "@prisma/client";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";

export class TransferQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: TransferStatus,
    description: "Filtrer par statut de transfert",
  })
  @IsOptional()
  @IsEnum(TransferStatus)
  status?: TransferStatus;

  @ApiPropertyOptional({ description: "Filtrer par agence d'origine" })
  @IsOptional()
  @IsUUID("4")
  originAgencyId?: string;

  @ApiPropertyOptional({ description: "Filtrer par agence de destination" })
  @IsOptional()
  @IsUUID("4")
  destinationAgencyId?: string;
}
