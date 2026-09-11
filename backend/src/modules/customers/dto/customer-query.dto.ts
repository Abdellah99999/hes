import { IsOptional, IsEnum, IsUUID } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { CustomerStatus } from "@prisma/client";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";

export class CustomerQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: "Filtrer par agence (réservé Super Admin / Siège)",
  })
  @IsOptional()
  @IsUUID()
  agencyId?: string;

  @ApiPropertyOptional({ description: "Filtrer par type de client" })
  @IsOptional()
  @IsUUID()
  customerTypeId?: string;

  @ApiPropertyOptional({
    enum: CustomerStatus,
    description: "Filtrer par statut",
  })
  @IsOptional()
  @IsEnum(CustomerStatus)
  status?: CustomerStatus;
}
