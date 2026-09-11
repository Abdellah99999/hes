import {
  IsString,
  IsNotEmpty,
  IsEnum,
  MinLength,
  IsOptional,
  IsUUID,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ParcelStatus } from "@prisma/client";

export class ManualTrackingEventDto {
  @ApiProperty({
    description: "Numéro de tracking du colis (ou UUID du colis)",
  })
  @IsString()
  @IsNotEmpty({ message: "Le numéro de tracking ou identifiant est requis." })
  trackingNumberOrId!: string;

  @ApiProperty({
    enum: ParcelStatus,
    description:
      "Nouveau statut à appliquer au colis (doit respecter la machine à états)",
  })
  @IsEnum(ParcelStatus, {
    message: "Le statut fourni n'est pas un statut de colis valide.",
  })
  @IsNotEmpty()
  status!: ParcelStatus;

  @ApiProperty({
    description:
      "Commentaire obligatoire justifiant la modification manuelle de statut (audit trail)",
    minLength: 5,
  })
  @IsString()
  @IsNotEmpty({
    message:
      "Le commentaire de justification est obligatoire pour une modification manuelle.",
  })
  @MinLength(5, {
    message:
      "Le commentaire doit comporter au moins 5 caractères afin de justifier l'intervention manuelle.",
  })
  notes!: string;

  @ApiPropertyOptional({
    description:
      "ID de l'agence où a lieu l'événement manuel (si différent du profil utilisateur)",
  })
  @IsOptional()
  @IsUUID("4")
  agencyId?: string;
}
