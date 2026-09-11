import { IsEnum, IsOptional, IsString } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { RefusalReasonCode } from "@prisma/client";

export class RecordRefusalDto {
  @ApiProperty({
    enum: RefusalReasonCode,
    description: "Motif obligatoire issu strictement du référentiel validé",
    example: RefusalReasonCode.CONTENT_MISMATCH,
  })
  @IsEnum(RefusalReasonCode, {
    message:
      "Le motif de refus doit être strictement sélectionné dans le référentiel officiel.",
  })
  reasonCode!: RefusalReasonCode;

  @ApiPropertyOptional({
    description: "Remarques complémentaires du livreur sur le refus",
  })
  @IsOptional()
  @IsString()
  courierNotes?: string;
}
