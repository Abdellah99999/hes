import { IsEnum, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ParcelStatus } from "@prisma/client";

export class UpdateParcelStatusDto {
  @ApiProperty({
    enum: ParcelStatus,
    description: "Nouveau statut du colis (doit respecter la machine à états)",
  })
  @IsEnum(ParcelStatus, {
    message: "Le statut fourni n'est pas un statut de colis valide.",
  })
  @IsNotEmpty()
  status!: ParcelStatus;

  @ApiPropertyOptional({
    description: "Motif ou commentaire associé au changement de statut",
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
