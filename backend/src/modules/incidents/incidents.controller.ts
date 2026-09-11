import {
  Controller,
  Post,
  Get,
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
import { ReportIncidentDto } from "./dto/report-incident.dto";
import { DecideIncidentDto } from "./dto/decide-incident.dto";
import { ReportIncidentUseCase } from "./application/use-cases/report-incident.use-case";
import { DecideIncidentUseCase } from "./application/use-cases/decide-incident.use-case";
import { ListIncidentsUseCase } from "./application/use-cases/list-incidents.use-case";
import { IncidentStatus, IncidentType } from "@prisma/client";

@ApiTags("Incidents & Litiges (Phase 11)")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("incidents")
export class IncidentsController {
  constructor(
    private readonly reportIncidentUseCase: ReportIncidentUseCase,
    private readonly decideIncidentUseCase: DecideIncidentUseCase,
    private readonly listIncidentsUseCase: ListIncidentsUseCase,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Déclarer un incident (perte, casse, vol, litige de livraison)",
  })
  @ApiResponse({
    status: 201,
    description: "Dossier d'incident enregistré et rattaché au tracking",
  })
  async reportIncident(
    @Body() dto: ReportIncidentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reportIncidentUseCase.execute(dto, user);
  }

  @Post(":id/decide")
  @HttpCode(HttpStatus.OK)
  @RequirePermissions("incidents:manage")
  @ApiOperation({
    summary:
      "Statuer sur un incident (enquête, pièces, indemnisation formelle, rejet)",
  })
  @ApiResponse({
    status: 200,
    description: "Décision d'enquête enregistrée dans l'historique",
  })
  async decideIncident(
    @Param("id") id: string,
    @Body() dto: DecideIncidentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.decideIncidentUseCase.execute(id, dto, user);
  }

  @Get()
  @ApiOperation({
    summary: "Lister les dossiers d'incidents (cloisonné selon rôle/agence)",
  })
  async listIncidents(
    @Query("status") status: IncidentStatus,
    @Query("type") type: IncidentType,
    @Query("search") search: string,
    @Query("isDeliveredDispute") isDeliveredDispute: boolean,
    @Query("page") page: number,
    @Query("limit") limit: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.listIncidentsUseCase.execute(
      { status, type, search, isDeliveredDispute, page, limit },
      user,
    );
  }

  @Get(":id")
  @ApiOperation({
    summary:
      "Consulter le détail complet d'un incident et son historique d'enquête",
  })
  async getIncident(@Param("id") id: string) {
    return this.listIncidentsUseCase.getById(id);
  }
}
