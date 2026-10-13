import { ApiProperty } from "@nestjs/swagger";
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
} from "class-validator";

export class Verify2faSetupDto {
  @ApiProperty({ example: "123456", description: "Code TOTP à 6 chiffres" })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  @Matches(/^\d{6}$/, {
    message: "Le code TOTP doit comporter exactement 6 chiffres",
  })
  code!: string;
}

export class Verify2faDto {
  @ApiProperty({
    example: "eyJhbGciOi...",
    description: "Jeton temporaire 2FA ou transmis via header Authorization",
    required: false,
  })
  @IsOptional()
  @IsString()
  tempToken?: string;

  @ApiProperty({ example: "123456", description: "Code TOTP à 6 chiffres" })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  @Matches(/^\d{6}$/, {
    message: "Le code TOTP doit comporter exactement 6 chiffres",
  })
  code!: string;
}

export class TwoFactorSetupResponseDto {
  @ApiProperty({ example: "JBSWY3DPEHPK3PXP" })
  secret!: string;

  @ApiProperty({
    example:
      "otpauth://totp/HES-Logistics:user@hes.ma?secret=JBSWY3DPEHPK3PXP&issuer=HES-Logistics",
  })
  otpauthUrl!: string;
}
