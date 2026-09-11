import { IsUUID, IsNotEmpty } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class AssignCollectionDto {
  @ApiProperty({ description: "ID de l'agent de collecte / coursier affecté" })
  @IsUUID("4", {
    message: "L'identifiant du coursier doit être un UUID valide.",
  })
  @IsNotEmpty()
  courierId!: string;
}
