import {
  Controller,
  Get,
  Post,
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
import { UpsertCourierProfileDto } from "./dto/upsert-courier-profile.dto";
import { AutoAssignRunsDto } from "./dto/auto-assign-runs.dto";
import { ReassignParcelRunDto } from "./dto/reassign-parcel-run.dto";
import { DeliveryRunQueryDto } from "./dto/delivery-run-query.dto";
import { UpsertCourierProfileUseCase } from "./application/use-cases/upsert-courier-profile.use-case";
import { AutoAssignRunsUseCase } from "./application/use-cases/auto-assign-runs.use-case";
import { ReassignParcelRunUseCase } from "./application/use-cases/reassign-parcel-run.use-case";
import { ListDeliveryRunsUseCase } from "./application/use-cases/list-delivery-runs.use-case";
import { GetDeliveryRunUseCase } from "./application/use-cases/get-delivery-run.use-case";

@ApiTags("Delivery Runs & Dernier Kilomètre (Phase 8)")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("runs")
export class RunsController {
  constructor(
    private readonly upsertProfileUseCase: UpsertCourierProfileUseCase,
    private readonly autoAssignUseCase: AutoAssignRunsUseCase,
    private readonly reassignUseCase: ReassignParcelRunUseCase,
    private readonly listRunsUseCase: ListDeliveryRunsUseCase,
    private readonly getRunUseCase: GetDeliveryRunUseCase,
  ) {}

  @Post("courier-profile")
  @HttpCode(HttpStatus.OK)
  @RequirePermissions("couriers:manage")
  @ApiOperation({
    summary:
      "Créer ou mettre à jour le profil opérationnel d'un coursier/livreur",
  })
  async upsertCourierProfile(
    @Body() dto: UpsertCourierProfileDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.upsertProfileUseCase.execute(dto, user);
  }

  @Post("auto-assign")
  @HttpCode(HttpStatus.OK)
  @RequirePermissions("runs:manage")
  @ApiOperation({
    summary:
      "Exécuter l'algorithme d'affectation automatique adresse -> zone -> livreur",
  })
  async autoAssign(
    @Body() dto: AutoAssignRunsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.autoAssignUseCase.execute(dto, user);
  }

  @Post("reassign")
  @HttpCode(HttpStatus.OK)
  @RequirePermissions("runs:manage")
  @ApiOperation({
    summary:
      "Réaffecter manuellement un colis à une autre tournée (audit obligatoire)",
  })
  async reassign(
    @Body() dto: ReassignParcelRunDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reassignUseCase.execute(dto, user);
  }

  @Get()
  @ApiOperation({
    summary:
      "Lister les tournées de livraison (cloisonné selon agence ou livreur)",
  })
  async listRuns(
    @Query() query: DeliveryRunQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.listRunsUseCase.execute(query, user);
  }

  @Get("my-runs")
  @ApiOperation({
    summary: "Consulter les tournées assignées au livreur connecté",
  })
  async getMyRuns(
    @Query() query: DeliveryRunQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.listRunsUseCase.execute(query, user);
  }

  @Get(":id")
  @ApiOperation({ summary: "Consulter le détail d'une tournée et ses colis" })
  @ApiResponse({ status: 200, description: "Détail de la tournée" })
  async getRun(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.getRunUseCase.execute(id, user);
  }
}
