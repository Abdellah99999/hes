import { IsString, IsOptional, IsBoolean } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class UpdateCustomerTypeDto {
  @ApiPropertyOptional({
    example: "Grand Compte Clé",
    description: "Désignation",
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    example: "Clients stratégiques à très fort volume logistique",
    description: "Description",
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: true, description: "Statut actif" })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
