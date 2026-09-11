import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class RefreshTokenDto {
  @ApiProperty({
    example: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    description: "Refresh Token opaque émis lors du login",
  })
  @IsString({ message: "Le refresh token doit être une chaîne" })
  @IsNotEmpty({ message: "Le refresh token est requis" })
  refreshToken!: string;
}
