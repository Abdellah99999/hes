import { IsString, IsNotEmpty, IsOptional } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class RegisterDeferredPodDto {
  @ApiProperty({
    description: "Nom complet ou tampon du réceptionnaire sur le BL papier",
    example: "Société Maghreb Logistique",
  })
  @IsString()
  @IsNotEmpty({
    message: "Le nom ou tampon du réceptionnaire est obligatoire.",
  })
  recipientName!: string;

  @ApiProperty({
    description:
      "Clé de stockage ou URL du scan du bon de livraison papier cacheté",
    example: "pod/bl-2026-00042.jpg",
  })
  @IsString()
  @IsNotEmpty({ message: "Le scan du BL papier cacheté est obligatoire." })
  podPhotoStorageKey!: string;

  @ApiPropertyOptional({ description: "CIN ou matricule relevé sur le BL" })
  @IsOptional()
  @IsString()
  recipientCin?: string;

  @ApiPropertyOptional({ description: "Notes de conformité de l'agent quai" })
  @IsOptional()
  @IsString()
  agentNotes?: string;
}
