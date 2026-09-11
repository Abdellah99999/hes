import {
  IsString,
  IsOptional,
  IsEnum,
  IsUUID,
  IsNumber,
  IsBoolean,
} from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { AddressType } from "@prisma/client";

export class UpdateAddressDto {
  @ApiPropertyOptional({
    example: "z1d2e3f4-...",
    description: "ID de la zone",
  })
  @IsOptional()
  @IsUUID()
  zoneId?: string;

  @ApiPropertyOptional({ enum: AddressType })
  @IsOptional()
  @IsEnum(AddressType)
  type?: AddressType;

  @ApiPropertyOptional({
    example: "Entrepôt Quai 4 - Rénové",
    description: "Libellé",
  })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({
    example: "Zone Portuaire, Hangar 12B",
    description: "Rue",
  })
  @IsOptional()
  @IsString()
  street?: string;

  @ApiPropertyOptional({ example: "Porte B2", description: "Complément" })
  @IsOptional()
  @IsString()
  additionalInfo?: string;

  @ApiPropertyOptional({ example: "Agadir", description: "Ville" })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ example: "80000", description: "Code postal" })
  @IsOptional()
  @IsString()
  postalCode?: string;

  @ApiPropertyOptional({ example: 30.428, description: "Latitude" })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional({ example: -9.5985, description: "Longitude" })
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @ApiPropertyOptional({ example: false, description: "Adresse par défaut" })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
