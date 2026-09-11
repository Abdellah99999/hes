import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AuthenticatedUser } from "../auth/domain/auth.types";
import { CreateAddressDto } from "./dto/create-address.dto";
import { UpdateAddressDto } from "./dto/update-address.dto";
import { AddressQueryDto } from "./dto/address-query.dto";
import { AddressesUseCases } from "./application/addresses.use-cases";

@ApiTags("Addresses")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("addresses")
export class AddressesController {
  constructor(private readonly useCases: AddressesUseCases) {}

  @Post()
  @RequirePermissions("addresses:manage")
  @ApiOperation({ summary: "Créer une nouvelle adresse (isolée par agence)" })
  @ApiResponse({ status: 201, description: "Adresse créée" })
  async create(
    @Body() dto: CreateAddressDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.useCases.create(dto, user);
  }

  @Get()
  @RequirePermissions("addresses:read")
  @ApiOperation({ summary: "Lister les adresses avec filtres et pagination" })
  async findAll(
    @Query() query: AddressQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.useCases.findAll(query, user);
  }

  @Get(":id")
  @RequirePermissions("addresses:read")
  @ApiOperation({ summary: "Obtenir une adresse par ID" })
  @ApiResponse({ status: 403, description: "Accès refusé inter-agences" })
  @ApiResponse({ status: 404, description: "Adresse introuvable" })
  async findOne(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.useCases.findById(id, user);
  }

  @Patch(":id")
  @RequirePermissions("addresses:manage")
  @ApiOperation({ summary: "Modifier une adresse" })
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateAddressDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.useCases.update(id, dto, user);
  }

  @Delete(":id")
  @RequirePermissions("addresses:manage")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Supprimer une adresse (soft-delete)" })
  async remove(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.useCases.delete(id, user);
  }
}
