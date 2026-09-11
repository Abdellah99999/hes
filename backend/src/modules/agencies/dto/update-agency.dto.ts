import { IsString, IsOptional, IsEmail, IsBoolean } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class UpdateAgencyDto {
  @ApiPropertyOptional({
    example: "Agence Agadir Port Renommée",
    description: "Nom complet",
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    example: "+212528123456",
    description: "Téléphone standard",
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({
    example: "contact.agadir@hes.ma",
    description: "Email",
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: "Agadir", description: "Ville" })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({
    example: "Nouveau Boulevard Port d'Agadir",
    description: "Adresse",
  })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({
    example: true,
    description: "Statut d'activation de l'agence",
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
