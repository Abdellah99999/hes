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
import { CreateZoneDto } from "./dto/create-zone.dto";
import { UpdateZoneDto } from "./dto/update-zone.dto";
import { ZoneQueryDto } from "./dto/zone-query.dto";
import { CreateZoneUseCase } from "./application/use-cases/create-zone.use-case";
import { UpdateZoneUseCase } from "./application/use-cases/update-zone.use-case";
import { GetZoneUseCase } from "./application/use-cases/get-zone.use-case";
import { ListZonesUseCase } from "./application/use-cases/list-zones.use-case";
import { DeleteZoneUseCase } from "./application/use-cases/delete-zone.use-case";

@ApiTags("Zones")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("zones")
export class ZonesController {
  constructor(
    private readonly createZoneUseCase: CreateZoneUseCase,
    private readonly updateZoneUseCase: UpdateZoneUseCase,
    private readonly getZoneUseCase: GetZoneUseCase,
    private readonly listZonesUseCase: ListZonesUseCase,
    private readonly deleteZoneUseCase: DeleteZoneUseCase,
  ) {}

  @Post()
  @RequirePermissions("zones:manage")
  @ApiOperation({ summary: "Créer une nouvelle zone opérationnelle" })
  @ApiResponse({ status: 201, description: "Zone créée" })
  @ApiResponse({
    status: 409,
    description: "Code zone déjà existant dans l'agence",
  })
  async create(
    @Body() dto: CreateZoneDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.createZoneUseCase.execute(dto, user);
  }

  @Get()
  @RequirePermissions("zones:read")
  @ApiOperation({
    summary: "Lister les zones opérationnelles (isolées par agence)",
  })
  async findAll(
    @Query() query: ZoneQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.listZonesUseCase.execute(query, user);
  }

  @Get(":id")
  @RequirePermissions("zones:read")
  @ApiOperation({ summary: "Obtenir une zone par identifiant" })
  @ApiResponse({
    status: 403,
    description: "Tentative d'accès inter-agences non autorisé",
  })
  @ApiResponse({ status: 404, description: "Zone introuvable" })
  async findOne(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.getZoneUseCase.execute(id, user);
  }

  @Patch(":id")
  @RequirePermissions("zones:manage")
  @ApiOperation({ summary: "Modifier une zone opérationnelle" })
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateZoneDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.updateZoneUseCase.execute(id, dto, user);
  }

  @Delete(":id")
  @RequirePermissions("zones:manage")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Supprimer une zone (soft delete)" })
  async remove(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.deleteZoneUseCase.execute(id, user);
  }
}
