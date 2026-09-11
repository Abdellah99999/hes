import {
  IsUUID,
  IsString,
  IsOptional,
  IsArray,
  ArrayMinSize,
  IsNotEmpty,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateTransferDto {
  @ApiProperty({ description: "ID de l'agence de départ" })
  @IsUUID("4", {
    message: "L'ID de l'agence de départ doit être un UUID valide.",
  })
  @IsNotEmpty()
  originAgencyId!: string;

  @ApiProperty({ description: "ID de l'agence de destination suivante" })
  @IsUUID("4", {
    message: "L'ID de l'agence de destination doit être un UUID valide.",
  })
  @IsNotEmpty()
  destinationAgencyId!: string;

  @ApiPropertyOptional({ description: "ID de la route / ligne logistique" })
  @IsOptional()
  @IsUUID("4")
  routeId?: string;

  @ApiPropertyOptional({ description: "Numéro d'immatriculation du véhicule" })
  @IsOptional()
  @IsString()
  vehiclePlate?: string;

  @ApiPropertyOptional({
    description: "Nom du chauffeur responsable du transport",
  })
  @IsOptional()
  @IsString()
  driverName?: string;

  @ApiPropertyOptional({ description: "Téléphone du chauffeur" })
  @IsOptional()
  @IsString()
  driverPhone?: string;

  @ApiPropertyOptional({ description: "Numéro de scellé camion" })
  @IsOptional()
  @IsString()
  sealNumber?: string;

  @ApiPropertyOptional({
    description: "Instructions particulières pour ce transfert",
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({
    description:
      "Liste des IDs de colis physiques à regrouper dans ce transfert",
    type: [String],
  })
  @IsArray({
    message: "La liste des colis doit être un tableau d'identifiants.",
  })
  @ArrayMinSize(1, {
    message:
      "Au moins un colis doit être sélectionné pour préparer un transfert.",
  })
  @IsUUID("4", {
    each: true,
    message: "Chaque identifiant de colis doit être un UUID valide.",
  })
  parcelIds!: string[];
}
