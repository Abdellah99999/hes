import {
  IsString,
  IsOptional,
  IsEmail,
  IsEnum,
  IsUUID,
  Matches,
} from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { CustomerStatus } from "@prisma/client";

export class UpdateCustomerDto {
  @ApiPropertyOptional({
    example: "b2c3d4e5-...",
    description: "ID du type de client",
  })
  @IsOptional()
  @IsUUID()
  customerTypeId?: string;

  @ApiPropertyOptional({
    example: "Atlas Trading International SARL",
    description: "Raison sociale",
  })
  @IsOptional()
  @IsString()
  legalName?: string;

  @ApiPropertyOptional({
    example: "Atlas Express Global",
    description: "Nom commercial",
  })
  @IsOptional()
  @IsString()
  tradeName?: string;

  @ApiPropertyOptional({
    example: "001234567000089",
    description: "ICE marocain (15 chiffres)",
  })
  @IsOptional()
  @IsString()
  @Matches(/^[0-9]{15}$/, {
    message: "L'ICE marocain doit comporter exactement 15 chiffres",
  })
  ice?: string;

  @ApiPropertyOptional({
    example: "12345678",
    description: "Identifiant Fiscal",
  })
  @IsOptional()
  @IsString()
  taxId?: string;

  @ApiPropertyOptional({
    example: "direction@atlastrading.ma",
    description: "Email",
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: "+212528223344", description: "Téléphone" })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ enum: CustomerStatus })
  @IsOptional()
  @IsEnum(CustomerStatus)
  status?: CustomerStatus;

  @ApiPropertyOptional({
    example: "Mise à jour conditions de paiement",
    description: "Notes",
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
