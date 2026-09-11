import {
  IsString,
  IsOptional,
  IsArray,
  ArrayMinSize,
  ValidateNested,
  IsNumber,
  Min,
  IsInt,
} from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CompleteCollectionItemDto {
  @ApiProperty({
    description: "Index de l'article de collecte (1-indexed)",
    example: 1,
  })
  @IsInt()
  @Min(1)
  itemIndex!: number;

  @ApiProperty({
    description: "Poids réel pesé physiquement sur place (kg)",
    example: 2.8,
  })
  @IsNumber()
  @Min(0.05)
  actualWeightKg!: number;

  @ApiPropertyOptional({ description: "Description ajustée du contenu" })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: "Nom du destinataire (ajusté)" })
  @IsOptional()
  @IsString()
  recipientName?: string;

  @ApiPropertyOptional({ description: "Téléphone du destinataire (ajusté)" })
  @IsOptional()
  @IsString()
  recipientPhone?: string;

  @ApiPropertyOptional({ description: "Adresse destinataire (ajustée)" })
  @IsOptional()
  @IsString()
  recipientAddress?: string;

  @ApiPropertyOptional({ description: "Ville destinataire (ajustée)" })
  @IsOptional()
  @IsString()
  recipientCity?: string;

  @ApiPropertyOptional({ description: "Montant COD ajusté" })
  @IsOptional()
  @IsNumber()
  @Min(0)
  codAmount?: number;

  @ApiPropertyOptional({ description: "Valeur déclarée ajustée" })
  @IsOptional()
  @IsNumber()
  @Min(0)
  declaredValue?: number;

  @ApiPropertyOptional({ description: "Notes coursier sur l'article" })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CompleteCollectionDto {
  @ApiPropertyOptional({
    description: "Remarques du coursier sur l'enlèvement",
  })
  @IsOptional()
  @IsString()
  driverNotes?: string;

  @ApiProperty({
    description: "Liste des colis physiquement confirmés et pesés",
    type: [CompleteCollectionItemDto],
  })
  @IsArray()
  @ArrayMinSize(1, {
    message: "Au moins un colis doit être confirmé pour clôturer la collecte.",
  })
  @ValidateNested({ each: true })
  @Type(() => CompleteCollectionItemDto)
  items!: CompleteCollectionItemDto[];
}
