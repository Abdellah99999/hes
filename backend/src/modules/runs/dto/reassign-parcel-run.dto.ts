import {
  IsUUID,
  IsString,
  IsNotEmpty,
  MinLength,
  IsOptional,
  IsBoolean,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class ReassignParcelRunDto {
  @ApiProperty({ description: "ID du colis à réaffecter" })
  @IsUUID("4")
  parcelId!: string;

  @ApiProperty({ description: "ID de la nouvelle tournée de destination" })
  @IsUUID("4")
  targetRunId!: string;

  @ApiProperty({
    description: "Motif obligatoire de réaffectation manuelle (audit)",
    example: "Demande client pour livraison l'après-midi, coursier réorienté",
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(5, {
    message: "Le motif de réaffectation doit comporter au moins 5 caractères.",
  })
  reason!: string;

  @ApiPropertyOptional({ description: "Marqueur de livraison hors-zone" })
  @IsOptional()
  @IsBoolean()
  isOutOfZone?: boolean;
}
