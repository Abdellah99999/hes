import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsNumber,
  Min,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IncidentType, IncidentSeverity } from "@prisma/client";

export class ReportIncidentDto {
  @ApiProperty({ description: "ID ou numéro de tracking de l'expédition" })
  @IsString()
  @IsNotEmpty({ message: "La référence de l'expédition est requise." })
  shipmentIdentifier!: string;

  @ApiPropertyOptional({
    description: "ID ou numéro de tracking du colis spécifique concerné",
  })
  @IsOptional()
  @IsString()
  parcelIdentifier?: string;

  @ApiProperty({ enum: IncidentType, description: "Type d'anomalie constatée" })
  @IsEnum(IncidentType)
  type!: IncidentType;

  @ApiPropertyOptional({
    enum: IncidentSeverity,
    default: IncidentSeverity.MEDIUM,
  })
  @IsOptional()
  @IsEnum(IncidentSeverity)
  severity?: IncidentSeverity;

  @ApiProperty({ description: "Description détaillée des faits constatés" })
  @IsString()
  @IsNotEmpty({
    message:
      "La description des faits est obligatoire pour instruire l'incident.",
  })
  description!: string;

  @ApiPropertyOptional({
    description: "Montant du préjudice réclamé par le client",
    example: 1200.0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  declaredValueClaimed?: number;
}
