import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsString, MinLength } from "class-validator";

export class ForgotPasswordDto {
  @ApiProperty({
    example: "admin@hes-logistics.com",
    description: "Email du compte pour réinitialisation du mot de passe",
  })
  @IsEmail({}, { message: "Format d'email invalide" })
  @IsNotEmpty({ message: "L'email est requis" })
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty({
    example: "reset-token-secret-uuid",
    description: "Token de réinitialisation sécurisé reçu par email",
  })
  @IsString({ message: "Le token doit être une chaîne" })
  @IsNotEmpty({ message: "Le token est requis" })
  token!: string;

  @ApiProperty({
    example: "NewSecurePass2026!",
    description: "Nouveau mot de passe sécurisé",
    minLength: 8,
  })
  @IsString({ message: "Le mot de passe doit être une chaîne" })
  @MinLength(8, {
    message: "Le nouveau mot de passe doit contenir au moins 8 caractères",
  })
  @IsNotEmpty({ message: "Le nouveau mot de passe est requis" })
  newPassword!: string;
}
