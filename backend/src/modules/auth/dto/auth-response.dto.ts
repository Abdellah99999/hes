import { ApiProperty } from "@nestjs/swagger";

export class UserDto {
  @ApiProperty({ example: "45a90d8a-6b80-4966-9eb5-8e7c5eb871b6" })
  id!: string;

  @ApiProperty({ example: "admin@hes-logistics.com" })
  email!: string;

  @ApiProperty({ example: "Abdou" })
  firstName!: string;

  @ApiProperty({ example: "Directeur" })
  lastName!: string;

  @ApiProperty({ example: "+33612345678", required: false, nullable: true })
  phone?: string | null;

  @ApiProperty({ example: "SUPER_ADMIN" })
  role!: string;

  @ApiProperty({
    example: "agency-uuid-1234",
    required: false,
    nullable: true,
  })
  agencyId?: string | null;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({
    example: ["shipments:read", "shipments:create", "users:manage"],
  })
  permissions!: string[];
}

export class TokenPairDto {
  @ApiProperty({
    example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    description: "JWT Access Token court (15m)",
  })
  accessToken!: string;

  @ApiProperty({
    example: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    description: "Opaque Refresh Token (7j)",
  })
  refreshToken!: string;

  @ApiProperty({
    example: 900,
    description: "Durée de validité en secondes (15 min)",
  })
  expiresIn!: number;

  @ApiProperty({ example: "Bearer" })
  tokenType!: string;
}

export class AuthResponseDto {
  @ApiProperty({ type: UserDto })
  user!: UserDto;

  @ApiProperty({ type: TokenPairDto })
  tokens!: TokenPairDto;
}

export class MessageResponseDto {
  @ApiProperty({ example: "Opération effectuée avec succès" })
  message!: string;
}
