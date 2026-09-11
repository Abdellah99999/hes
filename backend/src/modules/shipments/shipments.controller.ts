import {
  Controller,
  Get,
  Post,
  Patch,
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
import { CreateShipmentDto } from "./dto/create-shipment.dto";
import { ShipmentQueryDto } from "./dto/shipment-query.dto";
import { UpdateParcelStatusDto } from "./dto/update-parcel-status.dto";
import { CreateShipmentUseCase } from "./application/use-cases/create-shipment.use-case";
import { GetShipmentUseCase } from "./application/use-cases/get-shipment.use-case";
import { ListShipmentsUseCase } from "./application/use-cases/list-shipments.use-case";
import { UpdateParcelStatusUseCase } from "./application/use-cases/update-parcel-status.use-case";
import { ProcessTrackingEventUseCase } from "./application/use-cases/process-tracking-event.use-case";
import { GetTrackingTimelineUseCase } from "./application/use-cases/get-tracking-timeline.use-case";
import { BarcodeService } from "./domain/barcode.service";
import { ScanBarcodeDto } from "./dto/scan-barcode.dto";
import { ManualTrackingEventDto } from "./dto/manual-tracking-event.dto";

@ApiTags("Shipments")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("shipments")
export class ShipmentsController {
  constructor(
    private readonly createShipmentUseCase: CreateShipmentUseCase,
    private readonly getShipmentUseCase: GetShipmentUseCase,
    private readonly listShipmentsUseCase: ListShipmentsUseCase,
    private readonly updateParcelStatusUseCase: UpdateParcelStatusUseCase,
    private readonly processTrackingEventUseCase: ProcessTrackingEventUseCase,
    private readonly getTrackingTimelineUseCase: GetTrackingTimelineUseCase,
    private readonly barcodeService: BarcodeService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions("shipments:create")
  @ApiOperation({
    summary:
      "Créer une expédition avec colis multiples (Transactionnel de bout en bout)",
  })
  @ApiResponse({ status: 201, description: "Expédition créée avec succès" })
  @ApiResponse({ status: 400, description: "Données de validation invalides" })
  async create(
    @Body() dto: CreateShipmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.createShipmentUseCase.execute(dto, user);
  }

  @Get()
  @RequirePermissions("shipments:read")
  @ApiOperation({
    summary: "Lister les expéditions avec pagination et filtres",
  })
  async findAll(
    @Query() query: ShipmentQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.listShipmentsUseCase.execute(query, user);
  }

  @Post("track/scan")
  @HttpCode(HttpStatus.OK)
  @RequirePermissions("shipments:update")
  @ApiOperation({
    summary:
      "Enregistrer un scan optique (Code 128 / QR Code 2D) avec idempotence et machine à états",
  })
  @ApiResponse({ status: 200, description: "Scan traité avec succès" })
  async trackScan(
    @Body() dto: ScanBarcodeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.processTrackingEventUseCase.executeScan(dto, user);
  }

  @Post("track/manual")
  @HttpCode(HttpStatus.OK)
  @RequirePermissions("shipments:update")
  @ApiOperation({
    summary:
      "Enregistrer un changement de statut manuel avec commentaire obligatoire",
  })
  @ApiResponse({
    status: 200,
    description: "Changement de statut manuel enregistré",
  })
  async trackManual(
    @Body() dto: ManualTrackingEventDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.processTrackingEventUseCase.executeManual(dto, user);
  }

  @Get(":id/timeline")
  @RequirePermissions("shipments:read")
  @ApiOperation({
    summary: "Reconstruire la timeline chronologique d'une expédition",
  })
  async getShipmentTimeline(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.getTrackingTimelineUseCase.executeByShipment(id, user);
  }

  @Get("parcels/:parcelId/timeline")
  @RequirePermissions("shipments:read")
  @ApiOperation({
    summary:
      "Reconstruire la timeline chronologique d'un colis physique spécifique",
  })
  async getParcelTimeline(
    @Param("parcelId") parcelId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.getTrackingTimelineUseCase.executeByParcel(parcelId, user);
  }

  @Get("parcels/:parcelId/tag")
  @RequirePermissions("shipments:read")
  @ApiOperation({
    summary:
      "Générer les payloads d'étiquette Code-Barres 1D et QR Code 2D pour un colis",
  })
  async getParcelTag(
    @Param("parcelId") parcelId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const shipment = await this.getShipmentUseCase
      .executeByTracking(parcelId, user)
      .catch(() => null);
    // Returns tag payloads
    return {
      parcelId,
      code128: this.barcodeService.generateCode128Payload(parcelId),
      qr: this.barcodeService.generateQrPayload({
        parcelTrackingNumber: parcelId,
        shipmentTrackingNumber:
          shipment?.trackingNumber ||
          parcelId.substring(0, parcelId.lastIndexOf("-")),
        parcelIndex: 1,
        weightKg: 1,
      }),
    };
  }

  @Get("tracking/:trackingNumber")
  @RequirePermissions("shipments:read")
  @ApiOperation({ summary: "Consulter une expédition par numéro de tracking" })
  async findByTracking(
    @Param("trackingNumber") trackingNumber: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.getShipmentUseCase.executeByTracking(trackingNumber, user);
  }

  @Get(":id")
  @RequirePermissions("shipments:read")
  @ApiOperation({
    summary: "Consulter les détails d'une expédition par son ID",
  })
  async findById(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.getShipmentUseCase.execute(id, user);
  }

  @Patch("parcels/:parcelId/status")
  @RequirePermissions("shipments:update")
  @ApiOperation({
    summary:
      "Mettre à jour le statut d'un colis avec validation de transition d'état",
  })
  async updateParcelStatus(
    @Param("parcelId") parcelId: string,
    @Body() dto: UpdateParcelStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.updateParcelStatusUseCase.execute(parcelId, dto, user);
  }
}
