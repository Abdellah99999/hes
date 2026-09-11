import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsEnum,
  IsNumber,
  IsPositive,
  Min,
  ValidateNested,
  ArrayMinSize,
  IsArray,
  IsEmail,
} from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { PaymentMethod } from "@prisma/client";

export enum ServiceType {
  STANDARD = "STANDARD",
  EXPRESS = "EXPRESS",
  SAME_DAY = "SAME_DAY",
  ECONOMIC = "ECONOMIC",
}

export class CreateParcelItemDto {
  @ApiProperty({ description: "Désignation de l'article" })
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiPropertyOptional({ default: 1, description: "Quantité" })
  @IsOptional()
  @IsNumber()
  @Min(1)
  quantity?: number = 1;

  @ApiPropertyOptional({ description: "Valeur unitaire déclarée" })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  declaredValue?: number;

  @ApiPropertyOptional({ description: "Code douanier HS Code" })
  @IsOptional()
  @IsString()
  hsCode?: string;
}

export class CreateParcelDto {
  @ApiProperty({ description: "ID du type de colis (référentiel)" })
  @IsUUID("4")
  @IsNotEmpty()
  parcelTypeId!: string;

  @ApiProperty({
    description: "Poids réel en kilogrammes (strictement positif)",
  })
  @IsNumber({ maxDecimalPlaces: 3 })
  @IsPositive({
    message: "Le poids du colis doit être strictement supérieur à 0 kg.",
  })
  weightKg!: number;

  @ApiPropertyOptional({ description: "Longueur en cm" })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @IsPositive()
  lengthCm?: number;

  @ApiPropertyOptional({ description: "Largeur en cm" })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @IsPositive()
  widthCm?: number;

  @ApiPropertyOptional({ description: "Hauteur en cm" })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @IsPositive()
  heightCm?: number;

  @ApiPropertyOptional({
    description: "Instructions ou notes spécifiques au colis",
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    type: [CreateParcelItemDto],
    description: "Articles détaillés à l'intérieur du colis",
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateParcelItemDto)
  items?: CreateParcelItemDto[];
}

export class CreateShipmentDto {
  @ApiPropertyOptional({
    description:
      "ID de l'agence d'origine (optionnel pour les agents, injecté depuis leur token)",
  })
  @IsOptional()
  @IsUUID("4")
  originAgencyId?: string;

  @ApiProperty({ description: "ID de l'agence de destination / distribution" })
  @IsUUID("4")
  @IsNotEmpty()
  destinationAgencyId!: string;

  @ApiProperty({ description: "ID du compte client expéditeur" })
  @IsUUID("4")
  @IsNotEmpty()
  senderCustomerId!: string;

  @ApiPropertyOptional({ description: "ID de l'adresse d'enlèvement" })
  @IsOptional()
  @IsUUID("4")
  senderAddressId?: string;

  @ApiProperty({ description: "Nom complet du destinataire" })
  @IsString()
  @IsNotEmpty()
  recipientName!: string;

  @ApiProperty({ description: "Numéro de téléphone du destinataire" })
  @IsString()
  @IsNotEmpty()
  recipientPhone!: string;

  @ApiPropertyOptional({ description: "Email de notification du destinataire" })
  @IsOptional()
  @IsEmail()
  recipientEmail?: string;

  @ApiProperty({ description: "Adresse physique de livraison" })
  @IsString()
  @IsNotEmpty()
  recipientAddress!: string;

  @ApiProperty({ description: "Ville de destination" })
  @IsString()
  @IsNotEmpty()
  recipientCity!: string;

  @ApiPropertyOptional({ description: "Zone géographique de livraison" })
  @IsOptional()
  @IsUUID("4")
  recipientZoneId?: string;

  @ApiProperty({ enum: ServiceType, default: ServiceType.STANDARD })
  @IsEnum(ServiceType)
  serviceType: ServiceType = ServiceType.STANDARD;

  @ApiProperty({ enum: PaymentMethod, default: PaymentMethod.CASH })
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod = PaymentMethod.CASH;

  @ApiProperty({ description: "Frais de transport (MAD)" })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0, { message: "Les frais de transport doivent être positifs ou nuls." })
  shippingFee!: number;

  @ApiPropertyOptional({ description: "Valeur déclarée pour assurance (MAD)" })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  declaredValue?: number;

  @ApiPropertyOptional({
    description: "Montant Cash On Delivery à encaisser (MAD)",
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  codAmount?: number;

  @ApiPropertyOptional({ description: "Instructions spéciales" })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({
    type: [CreateParcelDto],
    description:
      "Liste des colis physiques de l'expédition (au moins 1 colis requis)",
  })
  @IsArray()
  @ArrayMinSize(1, {
    message: "Une expédition doit comporter au moins un colis.",
  })
  @ValidateNested({ each: true })
  @Type(() => CreateParcelDto)
  parcels!: CreateParcelDto[];
}
