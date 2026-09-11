import {
  IsString,
  IsNotEmpty,
  IsOptional,
  Matches,
  Length,
  IsUUID,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateZoneDto {
  @ApiPropertyOptional({
    example: "a3b1c2d3-...",
    description:
      "ID de l'agence (obligatoire pour SuperAdmin, auto-déduit pour agent)",
  })
  @IsOptional()
  @IsUUID()
  agencyId?: string;

  @ApiProperty({
    example: "ZN-AGA-01",
    description: "Code de la zone opérationnelle",
  })
  @IsString()
  @IsNotEmpty()
  @Length(2, 20)
  @Matches(/^[A-Z0-9_-]+$/, {
    message: "Le code zone doit contenir des majuscules, chiffres ou tirets",
  })
  code!: string;

  @ApiProperty({
    example: "Zone Portuaire & Industrielle",
    description: "Nom de la zone",
  })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({
    example: "Couvre les quais marchands et la zone franche",
    description: "Description",
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: "80000, 80001, 80010",
    description: "Codes postaux couverts (séparés par virgules)",
  })
  @IsOptional()
  @IsString()
  postalCodes?: string;
}
