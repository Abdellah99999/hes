import { IsString, IsOptional } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class DispatchTransferDto {
  @ApiPropertyOptional({ description: "Numéro de scellé camion au départ" })
  @IsOptional()
  @IsString()
  sealNumber?: string;

  @ApiPropertyOptional({ description: "Immatriculation véhicule confirmée" })
  @IsOptional()
  @IsString()
  vehiclePlate?: string;

  @ApiPropertyOptional({ description: "Nom du chauffeur" })
  @IsOptional()
  @IsString()
  driverName?: string;

  @ApiPropertyOptional({ description: "Téléphone du chauffeur" })
  @IsOptional()
  @IsString()
  driverPhone?: string;

  @ApiPropertyOptional({ description: "Commentaire de départ" })
  @IsOptional()
  @IsString()
  notes?: string;
}
