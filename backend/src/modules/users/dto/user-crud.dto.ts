import { ApiProperty } from "@nestjs/swagger";
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from "class-validator";

export class CreateUserDto {
  @ApiProperty({ example: "jean.dupont@hes-logistics.com" })
  @IsEmail({}, { message: "Format d'email invalide" })
  @IsNotEmpty({ message: "L'email est requis" })
  email!: string;

  @ApiProperty({ example: "TemporarySecurePassword2026!", minLength: 8 })
  @IsString()
  @MinLength(8, {
    message: "Le mot de passe doit contenir au moins 8 caractères",
  })
  @IsNotEmpty({ message: "Le mot de passe est requis" })
  password!: string;

  @ApiProperty({ example: "Jean" })
  @IsString()
  @IsNotEmpty({ message: "Le prénom est requis" })
  firstName!: string;

  @ApiProperty({ example: "Dupont" })
  @IsString()
  @IsNotEmpty({ message: "Le nom est requis" })
  lastName!: string;

  @ApiProperty({ example: "+33612345678", required: false })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({ example: "role-uuid-1234" })
  @IsUUID(4, { message: "Format UUID de rôle invalide" })
  @IsNotEmpty({ message: "Le rôle est requis" })
  roleId!: string;

  @ApiProperty({ example: "agency-uuid-5678", required: false })
  @IsUUID(4, { message: "Format UUID d'agence invalide" })
  @IsOptional()
  agencyId?: string;
}

export class UpdateUserDto {
  @ApiProperty({ example: "Jean", required: false })
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiProperty({ example: "Dupont", required: false })
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiProperty({ example: "+33612345678", required: false })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({ example: "role-uuid-1234", required: false })
  @IsUUID(4)
  @IsOptional()
  roleId?: string;

  @ApiProperty({ example: "agency-uuid-5678", required: false })
  @IsUUID(4)
  @IsOptional()
  agencyId?: string;
}
