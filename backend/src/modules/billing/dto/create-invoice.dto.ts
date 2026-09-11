import {
  IsString,
  IsNotEmpty,
  IsArray,
  ArrayMinSize,
  ValidateNested,
  IsNumber,
  Min,
  IsOptional,
  IsDateString,
} from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateInvoiceItemDto {
  @ApiPropertyOptional({ description: "ID de l'expédition liée (optionnel)" })
  @IsOptional()
  @IsString()
  shipmentId?: string;

  @ApiProperty({
    description: "Description de la ligne de prestation",
    example: "Fret Casablanca -> Marrakech (2 colis, 4.5 kg)",
  })
  @IsString()
  @IsNotEmpty({ message: "La description de la ligne est requise." })
  description!: string;

  @ApiProperty({ description: "Quantité facturée", example: 1 })
  @IsNumber()
  @Min(1)
  quantity!: number;

  @ApiProperty({ description: "Prix unitaire Hors Taxes (MAD)", example: 65.0 })
  @IsNumber()
  @Min(0)
  unitPrice!: number;
}

export class CreateInvoiceDto {
  @ApiProperty({
    description: "ID du client facturé",
    example: "cust-uuid-123",
  })
  @IsString()
  @IsNotEmpty({ message: "Le client à facturer est obligatoire." })
  customerId!: string;

  @ApiPropertyOptional({
    description: "Date d'échéance de la facture",
    example: "2026-10-02T00:00:00Z",
  })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({
    description: "Taux de TVA applicable (Défaut : 20.0%)",
    example: 20.0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  taxRate?: number;

  @ApiPropertyOptional({
    description: "Notes ou mentions légales complémentaires",
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({
    description: "Lignes de facturation",
    type: [CreateInvoiceItemDto],
  })
  @IsArray()
  @ArrayMinSize(1, {
    message: "Une facture doit comporter au moins une ligne de prestation.",
  })
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceItemDto)
  items!: CreateInvoiceItemDto[];
}
