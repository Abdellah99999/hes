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
import { ProofType } from "@prisma/client";

export class ConfirmDeliveryDto {
  @ApiProperty({
    enum: ProofType,
    description: "Type de preuve de livraison fournie",
  })
  @IsEnum(ProofType)
  proofType!: ProofType;

  @ApiProperty({
    description: "Nom complet du réceptionnaire effectif",
    example: "Yassine Mansouri",
  })
  @IsString()
  @IsNotEmpty({ message: "Le nom du réceptionnaire est obligatoire." })
  recipientName!: string;

  @ApiPropertyOptional({
    description: "Numéro de CIN du réceptionnaire",
    example: "AB123456",
  })
  @IsOptional()
  @IsString()
  recipientCin?: string;

  @ApiPropertyOptional({
    description: "Données de signature tactile (data URL ou SVG)",
  })
  @ValidateIf((o) => o.proofType === ProofType.DIGITAL_SIGNATURE)
  @IsNotEmpty({
    message:
      "La signature tactile est requise lorsque le type de preuve est DIGITAL_SIGNATURE.",
  })
  signatureDataUrl?: string;

  @ApiPropertyOptional({
    description: "Clé de stockage de la photo du BL cacheté",
  })
  @ValidateIf((o) => o.proofType === ProofType.PAPER_POD_PHOTO)
  @IsNotEmpty({
    message:
      "La photo du bon de livraison cacheté est requise lorsque le type de preuve est PAPER_POD_PHOTO.",
  })
  podPhotoStorageKey?: string;

  @ApiPropertyOptional({
    description: "Montant COD effectivement encaissé en espèces",
    example: 350.0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  collectedCodAmount?: number;

  @ApiPropertyOptional({ description: "Notes ou observations du livreur" })
  @IsOptional()
  @IsString()
  courierNotes?: string;
}
