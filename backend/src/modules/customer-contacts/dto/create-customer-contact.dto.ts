import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  IsBoolean,
  IsUUID,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateCustomerContactDto {
  @ApiProperty({
    example: "c1d2e3f4-...",
    description: "ID du client rattaché",
  })
  @IsUUID()
  @IsNotEmpty()
  customerId!: string;

  @ApiProperty({ example: "Karim", description: "Prénom du contact" })
  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @ApiProperty({ example: "Benjelloun", description: "Nom de famille" })
  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @ApiPropertyOptional({
    example: "k.benjelloun@client.ma",
    description: "Email",
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    example: "+212528112233",
    description: "Téléphone fixe",
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({
    example: "+212661223344",
    description: "Téléphone mobile",
  })
  @IsOptional()
  @IsString()
  mobile?: string;

  @ApiPropertyOptional({
    example: "Directeur Logistique & Supply Chain",
    description: "Fonction / Rôle",
  })
  @IsOptional()
  @IsString()
  roleTitle?: string;

  @ApiPropertyOptional({ example: true, description: "Contact principal" })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
