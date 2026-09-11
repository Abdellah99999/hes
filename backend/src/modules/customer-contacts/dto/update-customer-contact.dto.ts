import { IsString, IsOptional, IsEmail, IsBoolean } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class UpdateCustomerContactDto {
  @ApiPropertyOptional({ example: "Karim", description: "Prénom" })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ example: "Benjelloun", description: "Nom" })
  @IsOptional()
  @IsString()
  lastName?: string;

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

  @ApiPropertyOptional({ example: "+212661223344", description: "Mobile" })
  @IsOptional()
  @IsString()
  mobile?: string;

  @ApiPropertyOptional({
    example: "Directeur des Opérations",
    description: "Fonction",
  })
  @IsOptional()
  @IsString()
  roleTitle?: string;

  @ApiPropertyOptional({ example: true, description: "Contact principal" })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
