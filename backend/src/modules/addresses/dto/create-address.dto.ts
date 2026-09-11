import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsUUID,
  IsNumber,
  IsBoolean,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { AddressType } from "@prisma/client";

export class CreateAddressDto {
  @ApiPropertyOptional({
    example: "a1b2c3d4-...",
    description: "ID de l'agence (déduit pour agent)",
  })
  @IsOptional()
  @IsUUID()
  agencyId?: string;

  @ApiPropertyOptional({
    example: "c1d2e3f4-...",
    description: "ID du client (si adresse client)",
  })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional({
    example: "z1d2e3f4-...",
    description: "ID de la zone opérationnelle",
  })
  @IsOptional()
  @IsUUID()
  zoneId?: string;

  @ApiPropertyOptional({ enum: AddressType, default: AddressType.DELIVERY })
  @IsOptional()
  @IsEnum(AddressType)
  type?: AddressType = AddressType.DELIVERY;

  @ApiProperty({
    example: "Entrepôt Quai 4",
    description: "Libellé de l'adresse",
  })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({
    example: "Zone Portuaire, Hangar 12",
    description: "Rue / voie",
  })
  @IsString()
  @IsNotEmpty()
  street!: string;

  @ApiPropertyOptional({
    example: "Porte B, quai de déchargement",
    description: "Complément",
  })
  @IsOptional()
  @IsString()
  additionalInfo?: string;

  @ApiProperty({ example: "Agadir", description: "Ville" })
  @IsString()
  @IsNotEmpty()
  city!: string;

  @ApiPropertyOptional({ example: "80000", description: "Code postal" })
  @IsOptional()
  @IsString()
  postalCode?: string;

  @ApiPropertyOptional({ example: 30.4278, description: "Latitude GPS" })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional({ example: -9.5981, description: "Longitude GPS" })
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @ApiPropertyOptional({ example: true, description: "Adresse par défaut" })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
