import { IsOptional, IsEnum, IsUUID, IsString } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { AddressType } from "@prisma/client";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";

export class AddressQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: "Filtrer par agence (réservé Super Admin)",
  })
  @IsOptional()
  @IsUUID()
  agencyId?: string;

  @ApiPropertyOptional({ description: "Filtrer par client" })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional({ description: "Filtrer par zone" })
  @IsOptional()
  @IsUUID()
  zoneId?: string;

  @ApiPropertyOptional({
    enum: AddressType,
    description: "Filtrer par type d'adresse",
  })
  @IsOptional()
  @IsEnum(AddressType)
  type?: AddressType;

  @ApiPropertyOptional({ description: "Filtrer par ville" })
  @IsOptional()
  @IsString()
  city?: string;
}
