import { IsString, IsOptional, IsBoolean } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class UpdateZoneDto {
  @ApiPropertyOptional({
    example: "Zone Portuaire Nord",
    description: "Nom de la zone",
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    example: "Description mise à jour",
    description: "Description",
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: "80000, 80002",
    description: "Codes postaux couverts",
  })
  @IsOptional()
  @IsString()
  postalCodes?: string;

  @ApiPropertyOptional({ example: true, description: "Statut d'activation" })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
