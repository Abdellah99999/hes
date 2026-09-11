import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsNumber,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ParcelStatus } from "@prisma/client";

export enum ScannerType {
  BARCODE_1D = "BARCODE_1D",
  QR_2D = "QR_2D",
  MANUAL_ENTRY = "MANUAL_ENTRY",
}

export class ScanBarcodeDto {
  @ApiProperty({
    description:
      "Code-barres brut scanné (ou QR Code URI hes://scan/v1?t=... ou numéro de tracking direct)",
  })
  @IsString()
  @IsNotEmpty({ message: "Le code-barres scanné ne peut pas être vide." })
  barcode!: string;

  @ApiPropertyOptional({
    enum: ParcelStatus,
    description:
      "Statut cible déduit du contexte opérationnel du scanneur (ex: PICKED_UP, AT_HUB, OUT_FOR_DELIVERY, DELIVERED)",
  })
  @IsOptional()
  @IsEnum(ParcelStatus, {
    message: "Le statut cible fourni n'est pas un statut de colis valide.",
  })
  targetStatus?: ParcelStatus;

  @ApiPropertyOptional({
    enum: ScannerType,
    default: ScannerType.BARCODE_1D,
    description: "Type de périphérique utilisé pour la capture",
  })
  @IsOptional()
  @IsEnum(ScannerType)
  scannerType?: ScannerType = ScannerType.BARCODE_1D;

  @ApiPropertyOptional({
    description: "Identifiant matériel de l'appareil lecteur / PDA",
  })
  @IsOptional()
  @IsString()
  deviceId?: string;

  @ApiPropertyOptional({ description: "Coordonnée GPS Latitude" })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional({ description: "Coordonnée GPS Longitude" })
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @ApiPropertyOptional({
    description:
      "Clé d'idempotence optionnelle transmise par le client (UUID du terminal)",
  })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}
