import {
  IsUUID,
  IsEnum,
  IsOptional,
  IsString,
  IsNotEmpty,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { RunShift } from "@prisma/client";

export class AutoAssignRunsDto {
  @ApiPropertyOptional({
    description: "ID de l'agence (résolu depuis token si omis)",
  })
  @IsOptional()
  @IsUUID("4")
  agencyId?: string;

  @ApiProperty({
    description: "Date de la tournée (YYYY-MM-DD)",
    example: "2026-09-03",
  })
  @IsString()
  @IsNotEmpty()
  runDate!: string;

  @ApiPropertyOptional({ enum: RunShift, default: RunShift.MORNING })
  @IsOptional()
  @IsEnum(RunShift)
  shift?: RunShift;
}
