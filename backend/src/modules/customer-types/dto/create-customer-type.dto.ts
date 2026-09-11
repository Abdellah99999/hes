import {
  IsString,
  IsNotEmpty,
  IsOptional,
  Matches,
  Length,
  IsBoolean,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateCustomerTypeDto {
  @ApiProperty({
    example: "KEY_ACCOUNT",
    description:
      "Code unique du type client (ex: B2B_CORP, B2B_SME, KEY_ACCOUNT)",
  })
  @IsString()
  @IsNotEmpty()
  @Length(2, 30)
  @Matches(/^[A-Z0-9_]+$/, {
    message:
      "Le code type client doit être en majuscules avec underscores (ex: B2B_CORP)",
  })
  code!: string;

  @ApiProperty({ example: "Grand Compte", description: "Désignation" })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({
    example: "Clients stratégiques à fort volume",
    description: "Description",
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: false, description: "Type système protégé" })
  @IsOptional()
  @IsBoolean()
  isSystem?: boolean;
}
