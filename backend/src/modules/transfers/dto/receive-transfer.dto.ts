import { IsArray, IsOptional, IsString, IsBoolean } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class ReceiveTransferDto {
  @ApiProperty({
    description:
      "Liste des IDs ou numéros de tracking des colis physiquement scannés et reçus sur quai",
    type: [String],
  })
  @IsArray({ message: "La liste des colis reçus doit être un tableau." })
  @IsString({ each: true })
  receivedParcelIds!: string[];

  @ApiPropertyOptional({
    description:
      "Dictionnaire de commentaires justifiant les colis manquants (clé = parcelId/tracking, valeur = motif)",
  })
  @IsOptional()
  missingParcelNotes?: Record<string, string>;

  @ApiPropertyOptional({
    description: "Confirmation de conformité du scellé à l'arrivée",
  })
  @IsOptional()
  @IsBoolean()
  sealIntact?: boolean;

  @ApiPropertyOptional({ description: "Commentaire général de réception" })
  @IsOptional()
  @IsString()
  notes?: string;
}
