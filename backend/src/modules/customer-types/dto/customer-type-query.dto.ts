import { IsOptional, IsBoolean, IsString } from "class-validator";
import { Transform } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class CustomerTypeQueryDto {
  @ApiPropertyOptional({ description: "Recherche textuelle (code ou libellé)" })
  @IsOptional()
  @IsString()
  search?: string;

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
