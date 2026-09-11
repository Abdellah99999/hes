import { IsUUID, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class AssignManagerDto {
  @ApiProperty({
    example: "d5e6f7a8-...",
    description: "ID du collaborateur interne qui devient responsable",
  })
  @IsUUID()
  @IsNotEmpty()
  userId!: string;

  @ApiPropertyOptional({
    example: "Changement de gestionnaire suite à mutation interne",
    description: "Motif du transfert ou de l'affectation",
  })
  @IsOptional()
  @IsString()
  assignmentReason?: string;
}
