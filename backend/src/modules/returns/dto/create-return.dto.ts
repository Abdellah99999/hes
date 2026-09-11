import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsArray,
  ArrayMinSize,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ReturnType } from "@prisma/client";

export class CreateReturnDto {
  @ApiProperty({
    description: "ID de l'expédition ou du colis d'origine",
    example: "shipment-uuid-123",
  })
  @IsString()
  @IsNotEmpty({ message: "L'identifiant de l'expédition est obligatoire." })
  shipmentId!: string;

  @ApiPropertyOptional({ enum: ReturnType, default: ReturnType.REFUSAL_RETURN })
  @IsOptional()
  @IsEnum(ReturnType)
  returnType?: ReturnType;

  @ApiPropertyOptional({
    description: "Agence d'origine vers laquelle renvoyer le colis",
  })
  @IsOptional()
  @IsString()
  destinationAgencyId?: string;

  @ApiPropertyOptional({
    description: "ID du coursier assigné à la récupération",
  })
  @IsOptional()
  @IsString()
  assignedCourierId?: string;

  @ApiProperty({
    description: "Liste des IDs des colis faisant l'objet du retour",
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(1, {
    message: "Au moins un colis doit être spécifié pour le retour.",
  })
  parcelIds!: string[];

  @ApiPropertyOptional({ description: "Motif ou notes explicatives du retour" })
  @IsOptional()
  @IsString()
  reasonNotes?: string;
}
