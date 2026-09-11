import { IsOptional, IsBoolean, IsUUID } from "class-validator";
import { Transform } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";

export class ZoneQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: "Filtrer par agence (réservé aux admins globaux)",
  })
  @IsOptional()
  @IsUUID()
  agencyId?: string;

  @ApiPropertyOptional({ description: "Filtrer par statut actif" })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === "true" || value === true) return true;
    if (value === "false" || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  isActive?: boolean;
}
