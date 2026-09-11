import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  IsEnum,
  IsUUID,
  Matches,
  Length,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { CustomerStatus } from "@prisma/client";

export class CreateCustomerDto {
  @ApiPropertyOptional({
    example: "a3b1c2d3-...",
    description:
      "ID de l'agence (obligatoire si Super Admin, déduit pour agent)",
  })
  @IsOptional()
  @IsUUID()
  agencyId?: string;

  @ApiProperty({
    example: "b2c3d4e5-...",
    description: "ID du type de client (référentiel)",
  })
  @IsUUID()
  @IsNotEmpty()
  customerTypeId!: string;

  @ApiProperty({
    example: "CLI-AGA-2026-001",
    description: "Code unique client",
  })
  @IsString()
  @IsNotEmpty()
  @Length(3, 30)
  @Matches(/^[A-Z0-9_-]+$/, {
    message:
      "Le code client doit contenir uniquement des lettres majuscules, chiffres ou tirets",
  })
  code!: string;

  @ApiProperty({
    example: "Atlas Trading SARL",
    description: "Raison sociale légale",
  })
  @IsString()
  @IsNotEmpty()
  legalName!: string;

  @ApiPropertyOptional({
    example: "Atlas Express",
    description: "Nom commercial",
  })
  @IsOptional()
  @IsString()
  tradeName?: string;

  @ApiPropertyOptional({
    example: "001234567000089",
    description: "Identifiant Commun de l'Entreprise (15 chiffres)",
  })
  @IsOptional()
  @IsString()
  @Matches(/^[0-9]{15}$/, {
    message: "L'ICE marocain doit comporter exactement 15 chiffres",
  })
  ice?: string;

  @ApiPropertyOptional({
    example: "12345678",
    description: "Identifiant Fiscal (IF)",
  })
  @IsOptional()
  @IsString()
  taxId?: string;

  @ApiPropertyOptional({
    example: "direction@atlastrading.ma",
    description: "Email commercial/facturation",
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    example: "+212528223344",
    description: "Téléphone principal",
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ enum: CustomerStatus, default: CustomerStatus.ACTIVE })
  @IsOptional()
  @IsEnum(CustomerStatus)
  status?: CustomerStatus = CustomerStatus.ACTIVE;

  @ApiPropertyOptional({
    example: "Client import/export fruits et légumes",
    description: "Notes internes",
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    example: "c4d5e6f7-...",
    description: "ID de l'utilisateur gestionnaire de compte initial",
  })
  @IsOptional()
  @IsUUID()
  initialManagerUserId?: string;

  @ApiPropertyOptional({
    example: "Attribution initiale à la création du compte",
    description: "Motif d'attribution initiale",
  })
  @IsOptional()
  @IsString()
  initialManagerReason?: string;
}
