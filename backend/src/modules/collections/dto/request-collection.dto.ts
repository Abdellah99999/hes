import {
  IsString,
  IsOptional,
  IsUUID,
  IsNotEmpty,
  IsArray,
  ArrayMinSize,
  ValidateNested,
  IsNumber,
  Min,
} from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class RequestCollectionItemDto {
  @ApiPropertyOptional({
    description: "Poids estimé / déclaré en kg",
    example: 2.5,
  })
  @IsOptional()
  @IsNumber()
  @Min(0.1)
  declaredWeightKg?: number;

  @ApiPropertyOptional({ description: "Description du contenu" })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: "Nom complet du destinataire final",
    example: "Yassine Mansouri",
  })
  @IsString()
  @IsNotEmpty()
  recipientName!: string;

  @ApiProperty({
    description: "Numéro de téléphone du destinataire",
    example: "+212612345678",
  })
  @IsString()
  @IsNotEmpty()
  recipientPhone!: string;

  @ApiProperty({
    description: "Adresse physique de livraison",
    example: "14 Boulevard Hassan II",
  })
  @IsString()
  @IsNotEmpty()
  recipientAddress!: string;

  @ApiProperty({ description: "Ville de destination", example: "Rabat" })
  @IsString()
  @IsNotEmpty()
  recipientCity!: string;

  @ApiPropertyOptional({
    description: "Montant contre remboursement (COD)",
    example: 350.0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  codAmount?: number;

  @ApiPropertyOptional({ description: "Valeur déclarée", example: 1000.0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  declaredValue?: number;

  @ApiPropertyOptional({ description: "Instructions spécifiques" })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class RequestCollectionDto {
  @ApiPropertyOptional({
    description: "ID de l'adresse enregistrée du client (optionnel)",
  })
  @IsOptional()
  @IsUUID("4")
  pickupAddressId?: string;

  @ApiProperty({
    description: "Nom de la personne contact sur place",
    example: "Fatima Zahra",
  })
  @IsString()
  @IsNotEmpty()
  pickupContactName!: string;

  @ApiProperty({
    description: "Téléphone du contact sur place",
    example: "+212655555555",
  })
  @IsString()
  @IsNotEmpty()
  pickupPhone!: string;

  @ApiProperty({
    description: "Rue / Adresse d'enlèvement",
    example: "45 Rue des Alouettes, Maarif",
  })
  @IsString()
  @IsNotEmpty()
  pickupStreet!: string;

  @ApiProperty({ description: "Ville de collecte", example: "Casablanca" })
  @IsString()
  @IsNotEmpty()
  pickupCity!: string;

  @ApiPropertyOptional({ description: "Code postal" })
  @IsOptional()
  @IsString()
  pickupPostalCode?: string;

  @ApiPropertyOptional({ description: "Latitude GPS" })
  @IsOptional()
  @IsNumber()
  pickupLatitude?: number;

  @ApiPropertyOptional({ description: "Longitude GPS" })
  @IsOptional()
  @IsNumber()
  pickupLongitude?: number;

  @ApiProperty({
    description: "Date souhaitée pour l'enlèvement (YYYY-MM-DD)",
    example: "2026-09-03",
  })
  @IsString()
  @IsNotEmpty()
  scheduledDate!: string;

  @ApiPropertyOptional({
    description: "Début de créneau horaire",
    example: "09:00",
  })
  @IsOptional()
  @IsString()
  timeSlotStart?: string;

  @ApiPropertyOptional({
    description: "Fin de créneau horaire",
    example: "12:00",
  })
  @IsOptional()
  @IsString()
  timeSlotEnd?: string;

  @ApiPropertyOptional({
    description: "Remarques particulières pour le coursier",
  })
  @IsOptional()
  @IsString()
  clientNotes?: string;

  @ApiProperty({
    description: "Liste des colis à enlever avec coordonnées destinataires",
    type: [RequestCollectionItemDto],
  })
  @IsArray()
  @ArrayMinSize(1, {
    message:
      "Au moins un colis doit être déclaré pour une demande de collecte.",
  })
  @ValidateNested({ each: true })
  @Type(() => RequestCollectionItemDto)
  items!: RequestCollectionItemDto[];
}
