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
import { CreateAgencyDto } from "./dto/create-agency.dto";
import { UpdateAgencyDto } from "./dto/update-agency.dto";
import { AgencyQueryDto } from "./dto/agency-query.dto";
import { CreateAgencyUseCase } from "./application/use-cases/create-agency.use-case";
import { UpdateAgencyUseCase } from "./application/use-cases/update-agency.use-case";
import { GetAgencyUseCase } from "./application/use-cases/get-agency.use-case";
import { ListAgenciesUseCase } from "./application/use-cases/list-agencies.use-case";
import { DeleteAgencyUseCase } from "./application/use-cases/delete-agency.use-case";

@ApiTags("Agencies")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("agencies")
export class AgenciesController {
  constructor(
    private readonly createAgencyUseCase: CreateAgencyUseCase,
    private readonly updateAgencyUseCase: UpdateAgencyUseCase,
    private readonly getAgencyUseCase: GetAgencyUseCase,
    private readonly listAgenciesUseCase: ListAgenciesUseCase,
    private readonly deleteAgencyUseCase: DeleteAgencyUseCase,
  ) {}

  @Post()
  @RequirePermissions("agencies:manage")
  @ApiOperation({ summary: "Créer une nouvelle agence" })
  @ApiResponse({ status: 201, description: "Agence créée avec succès" })
  @ApiResponse({ status: 409, description: "Code agence déjà existant" })
  async create(@Body() dto: CreateAgencyDto) {
    return this.createAgencyUseCase.execute(dto);
  }

  @Get()
  @RequirePermissions("agencies:read")
  @ApiOperation({ summary: "Lister les agences avec pagination et filtres" })
  async findAll(@Query() query: AgencyQueryDto) {
    return this.listAgenciesUseCase.execute(query);
  }

  @Get(":id")
  @RequirePermissions("agencies:read")
  @ApiOperation({ summary: "Obtenir les détails d'une agence" })
  @ApiResponse({ status: 404, description: "Agence introuvable" })
  async findOne(@Param("id") id: string) {
    return this.getAgencyUseCase.execute(id);
  }

  @Patch(":id")
  @RequirePermissions("agencies:manage")
  @ApiOperation({ summary: "Modifier une agence" })
  @ApiResponse({ status: 404, description: "Agence introuvable" })
  async update(@Param("id") id: string, @Body() dto: UpdateAgencyDto) {
    return this.updateAgencyUseCase.execute(id, dto);
  }

  @Delete(":id")
  @RequirePermissions("agencies:manage")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Désactiver / Supprimer en soft-delete une agence" })
  @ApiResponse({ status: 404, description: "Agence introuvable" })
  async remove(@Param("id") id: string) {
    return this.deleteAgencyUseCase.execute(id);
  }
}
