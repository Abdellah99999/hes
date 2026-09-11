import {
  IsUUID,
  IsEnum,
  IsOptional,
  IsString,
  IsNumber,
  Min,
  IsInt,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { CourierVehicleType } from "@prisma/client";

export class UpsertCourierProfileDto {
  @ApiProperty({ description: "ID de l'utilisateur (rôle COURIER)" })
  @IsUUID("4")
  userId!: string;

  @ApiPropertyOptional({ description: "ID de la zone géographique principale" })
  @IsOptional()
  @IsUUID("4")
  primaryZoneId?: string;

  @ApiPropertyOptional({
    enum: CourierVehicleType,
    default: CourierVehicleType.MOTORCYCLE,
  })
  @IsOptional()
  @IsEnum(CourierVehicleType)
  vehicleType?: CourierVehicleType;

  @ApiPropertyOptional({ description: "Immatriculation du véhicule" })
  @IsOptional()
  @IsString()
  licensePlate?: string;

  @ApiPropertyOptional({
    description: "Capacité maximale de charge en kg",
    default: 50.0,
  })
  @IsOptional()
  @IsNumber()
  @Min(5.0)
  maxCapacityKg?: number;

  @ApiPropertyOptional({
    description: "Capacité maximale en nombre de colis",
    default: 30,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxParcelsCapacity?: number;
}
