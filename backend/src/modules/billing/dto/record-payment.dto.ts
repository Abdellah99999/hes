import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
} from "class-validator";
import { PaymentMethod } from "@prisma/client";

export class RecordPaymentDto {
  @ApiProperty({
    description: "Montant du paiement en dirhams (MAD)",
    example: 250.0,
  })
  @IsNumber({}, { message: "Le montant du paiement doit être un nombre." })
  @IsPositive({ message: "Le montant du paiement doit être supérieur à 0." })
  amount!: number;

  @ApiPropertyOptional({
    enum: PaymentMethod,
    default: PaymentMethod.CASH,
    description: "Moyen de paiement",
  })
  @IsEnum(PaymentMethod, {
    message: "Le moyen de paiement spécifié n'est pas valide.",
  })
  @IsOptional()
  paymentMethod?: PaymentMethod = PaymentMethod.CASH;

  @ApiPropertyOptional({
    description:
      "Référence du virement, numéro de chèque ou reçu d'encaissement",
    example: "VIR-2026-09-0012",
  })
  @IsString()
  @IsOptional()
  reference?: string;
}
