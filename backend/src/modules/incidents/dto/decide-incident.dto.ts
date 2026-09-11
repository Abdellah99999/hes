import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsNumber,
  Min,
  ValidateIf,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IncidentDecisionAction } from "@prisma/client";

export class DecideIncidentDto {
  @ApiProperty({
    enum: IncidentDecisionAction,
    description: "Action formelle de décision d'enquête",
  })
  @IsEnum(IncidentDecisionAction)
  action!: IncidentDecisionAction;

  @ApiProperty({ description: "Commentaire d'instruction motivé obligatoire" })
  @IsString()
  @IsNotEmpty({
    message:
      "Le commentaire d'instruction est obligatoire pour motiver la décision.",
  })
  comment!: string;

  @ApiPropertyOptional({
    description:
      "Montant d'indemnisation accordé (strictement requis si action = APPROVE_COMPENSATION)",
  })
  @ValidateIf((o) => o.action === IncidentDecisionAction.APPROVE_COMPENSATION)
  @IsNotEmpty({
    message:
      "Le montant d'indemnisation est obligatoire lors d'une approbation.",
  })
  @IsNumber()
  @Min(0.01, {
    message: "Le montant d'indemnisation accordé doit être supérieur à zéro.",
  })
  awardedAmount?: number;

  @ApiPropertyOptional({
    description:
      "URL ou référence du document de preuve (PV, facture, rapport d'expertise)",
  })
  @IsOptional()
  @IsString()
  evidenceUrl?: string;
}
