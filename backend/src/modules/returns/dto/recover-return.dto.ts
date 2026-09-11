import {
  IsString,
  IsNotEmpty,
  IsBoolean,
  IsOptional,
  ValidateIf,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class RecoverReturnDto {
  @ApiProperty({
    description: "Numéro de tracking du colis ou numéro du BL d'origine",
    example: "HES-CAS-2026-000099-01",
  })
  @IsString()
  @IsNotEmpty({
    message: "Le numéro BL ou tracking est obligatoire pour la récupération.",
  })
  identifier!: string;

  @ApiProperty({
    description:
      "Indique si la saisie provient d'un scan code-barres/QR physique ou d'une saisie manuelle",
    example: false,
  })
  @IsBoolean()
  isScan!: boolean;

  @ApiPropertyOptional({
    description:
      "Flag indiquant l'activation de la procédure de secours si BL illisible/perdu",
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isFallbackEmergency?: boolean;

  @ApiPropertyOptional({
    description:
      "Motif circonstancié d'urgence si BL totalement illisible ou égaré (requis si procédure d'urgence)",
  })
  @ValidateIf((o) => o.isFallbackEmergency === true)
  @IsNotEmpty({
    message:
      "Un motif circonstancié est obligatoire en cas de procédure d'urgence BL illisible.",
  })
  emergencyReason?: string;
}
