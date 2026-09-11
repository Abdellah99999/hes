import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  Matches,
  Length,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateAgencyDto {
  @ApiProperty({
    example: "AGA",
    description: "Code unique de l'agence (ex: AGA, CAS, TNG)",
  })
  @IsString()
  @IsNotEmpty()
  @Length(2, 10)
  @Matches(/^[A-Z0-9_-]+$/, {
    message:
      "Le code agence doit contenir uniquement des lettres majuscules, chiffres ou tirets",
  })
  code!: string;

  @ApiProperty({
    example: "Agence Agadir Port",
    description: "Nom complet de l'agence",
  })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({
    example: "+212528123456",
    description: "Téléphone standard",
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({
    example: "contact.agadir@hes.ma",
    description: "Email de l'agence",
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ example: "Agadir", description: "Ville d'implantation" })
  @IsString()
  @IsNotEmpty()
  city!: string;

  @ApiPropertyOptional({
    example: "Boulevard Mohammed V, Port d'Agadir",
    description: "Adresse physique",
  })
  @IsOptional()
  @IsString()
  address?: string;
}
