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
import { CreateTransferDto } from "./dto/create-transfer.dto";
import { DispatchTransferDto } from "./dto/dispatch-transfer.dto";
import { ReceiveTransferDto } from "./dto/receive-transfer.dto";
import { TransferQueryDto } from "./dto/transfer-query.dto";
import { AgencyStockQueryDto } from "./dto/agency-stock-query.dto";
import { CreateTransferUseCase } from "./application/use-cases/create-transfer.use-case";
import { DispatchTransferUseCase } from "./application/use-cases/dispatch-transfer.use-case";
import { ReceiveTransferUseCase } from "./application/use-cases/receive-transfer.use-case";
import { ListTransfersUseCase } from "./application/use-cases/list-transfers.use-case";
import { GetTransferUseCase } from "./application/use-cases/get-transfer.use-case";
import { GetAgencyStockUseCase } from "./application/use-cases/get-agency-stock.use-case";
import { RoutingEngineService } from "./domain/routing-engine.service";

@ApiTags("Transfers & Routing")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class TransfersController {
  constructor(
    private readonly createTransferUseCase: CreateTransferUseCase,
    private readonly dispatchTransferUseCase: DispatchTransferUseCase,
    private readonly receiveTransferUseCase: ReceiveTransferUseCase,
    private readonly listTransfersUseCase: ListTransfersUseCase,
    private readonly getTransferUseCase: GetTransferUseCase,
    private readonly getAgencyStockUseCase: GetAgencyStockUseCase,
    private readonly routingEngineService: RoutingEngineService,
  ) {}

  @Post("transfers")
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions("transfers:create")
  @ApiOperation({
    summary: "Préparer un nouveau transfert inter-agences avec colis multiples",
  })
  @ApiResponse({ status: 201, description: "Transfert préparé avec succès" })
  async create(
    @Body() dto: CreateTransferDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.createTransferUseCase.execute(dto, user);
  }

  @Get("transfers")
  @RequirePermissions("transfers:read")
  @ApiOperation({
    summary: "Lister les transferts avec filtres d'agence et statut",
  })
  async findAll(
    @Query() query: TransferQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.listTransfersUseCase.execute(query, user);
  }

  @Get("transfers/:id")
  @RequirePermissions("transfers:read")
  @ApiOperation({
    summary: "Consulter les détails d'un transfert et son manifeste de colis",
  })
  async findById(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.getTransferUseCase.execute(id, user);
  }

  @Post("transfers/:id/dispatch")
  @HttpCode(HttpStatus.OK)
  @RequirePermissions("transfers:update")
  @ApiOperation({
    summary:
      "Valider le départ du transfert (statut IN_TRANSIT, currentAgencyId -> NULL)",
  })
  async dispatch(
    @Param("id") id: string,
    @Body() dto: DispatchTransferDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.dispatchTransferUseCase.execute(id, dto, user);
  }

  @Post("transfers/:id/receive")
  @HttpCode(HttpStatus.OK)
  @RequirePermissions("transfers:update")
  @ApiOperation({
    summary:
      "Réceptionner le transfert (Transaction atomique, réconciliation attendus vs reçus vs manquants)",
  })
  async receive(
    @Param("id") id: string,
    @Body() dto: ReceiveTransferDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.receiveTransferUseCase.execute(id, dto, user);
  }

  @Get("agencies/:agencyId/stock")
  @RequirePermissions("shipments:read")
  @ApiOperation({
    summary:
      "Consulter le stock quai présent dans une agence avec métriques volumétriques et de rétention",
  })
  async getAgencyStock(
    @Param("agencyId") agencyId: string,
    @Query() query: AgencyStockQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.getAgencyStockUseCase.execute(agencyId, query, user);
  }

  @Post("routing/evaluate")
  @RequirePermissions("shipments:read")
  @ApiOperation({
    summary:
      "Évaluer l'action d'aiguillage quai pour un colis (UNLOAD vs HOLD_AND_RETRANSFER vs MISROUTED)",
  })
  async evaluateRouting(
    @Body()
    body: {
      originAgencyId: string;
      destinationAgencyId: string;
      currentAgencyId: string;
    },
  ) {
    return this.routingEngineService.evaluateHubAction(body);
  }
}
