import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import {
  Prisma,
  ParcelStatus,
  TrackingEventSource,
  AuditEventType,
} from "@prisma/client";
import { createHash } from "crypto";
import { PrismaService } from "../../../../prisma/prisma.service";
import { AuditService } from "../../../auth/services/audit.service";
import { RedisService } from "../../../redis/redis.service";
import { BarcodeService } from "../../domain/barcode.service";
import { validateParcelTransition } from "../../domain/parcel-state-machine";
import { computeGlobalShipmentStatus } from "../../domain/shipment-status.calculator";
import { AuthenticatedUser } from "../../../auth/domain/auth.types";
import { ScanBarcodeDto, ScannerType } from "../../dto/scan-barcode.dto";
import { ManualTrackingEventDto } from "../../dto/manual-tracking-event.dto";

export interface ProcessTrackingEventResult {
  duplicate: boolean;
  message: string;
  source: TrackingEventSource;
  trackingEvent?: {
    id?: string;
    status?: ParcelStatus;
    previousStatus?: ParcelStatus | null;
    idempotencyKey?: string | null;
    notes?: string | null;
    [key: string]: unknown;
  } | null;
  parcel?: {
    id?: string;
    trackingNumber?: string | null;
    status?: ParcelStatus;
    [key: string]: unknown;
  } | null;
  shipment?: unknown;
}

@Injectable()
export class ProcessTrackingEventUseCase {
  private readonly logger = new Logger(ProcessTrackingEventUseCase.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly redisService: RedisService,
    private readonly barcodeService: BarcodeService,
  ) {}

  /**
   * Universal entry point for physical scans (SCAN)
   */
  async executeScan(
    dto: ScanBarcodeDto,
    user: AuthenticatedUser,
  ): Promise<ProcessTrackingEventResult> {
    const parsed = this.barcodeService.parseScannedPayload(dto.barcode);

    return this.process({
      trackingNumber: parsed.trackingNumber,
      targetStatus: dto.targetStatus,
      source: TrackingEventSource.SCAN,
      user,
      scannerType:
        dto.scannerType ||
        (parsed.isQr ? ScannerType.QR_2D : ScannerType.BARCODE_1D),
      rawBarcode: dto.barcode,
      deviceId: dto.deviceId,
      latitude: dto.latitude,
      longitude: dto.longitude,
      clientKey: dto.idempotencyKey,
      metadata: parsed.meta,
    });
  }

  /**
   * Universal entry point for manual status adjustments (MANUAL)
   */
  async executeManual(
    dto: ManualTrackingEventDto,
    user: AuthenticatedUser,
  ): Promise<ProcessTrackingEventResult> {
    return this.process({
      trackingNumber: dto.trackingNumberOrId.trim().toUpperCase(),
      targetStatus: dto.status,
      source: TrackingEventSource.MANUAL,
      user,
      scannerType: ScannerType.MANUAL_ENTRY,
      rawBarcode: dto.trackingNumberOrId.trim(),
      notes: dto.notes.trim(),
      agencyIdOverride: dto.agencyId,
    });
  }

  /**
   * Core unified idempotency, state machine, and persistence engine
   */
  private async process(params: {
    trackingNumber: string;
    targetStatus?: ParcelStatus;
    source: TrackingEventSource;
    user: AuthenticatedUser;
    scannerType: ScannerType;
    rawBarcode: string;
    notes?: string;
    deviceId?: string;
    latitude?: number;
    longitude?: number;
    clientKey?: string;
    agencyIdOverride?: string;
    metadata?: Record<string, unknown>;
  }): Promise<ProcessTrackingEventResult> {
    const { trackingNumber, source, user, scannerType, rawBarcode, notes } =
      params;

    // 1. Validate existence and non-deletion
    const parcel = await this.prisma.parcel.findFirst({
      where: {
        OR: [{ trackingNumber }, { id: trackingNumber }],
        deletedAt: null,
      },
      include: {
        shipment: true,
      },
    });

    if (!parcel) {
      throw new NotFoundException(
        `Colis introuvable ou supprimé pour le code/identifiant '${trackingNumber}'.`,
      );
    }

    // 2. Validate agency perimeter
    const effectiveAgencyId =
      user.isGlobalScope && params.agencyIdOverride
        ? params.agencyIdOverride
        : user.agencyId || parcel.shipment.originAgencyId;

    if (
      !user.isGlobalScope &&
      user.agencyId &&
      parcel.shipment.originAgencyId !== user.agencyId &&
      parcel.shipment.destinationAgencyId !== user.agencyId &&
      effectiveAgencyId !== user.agencyId
    ) {
      await this.auditService.logEvent({
        eventType: AuditEventType.SECURITY_VIOLATION_AGENCY_BYPASS_ATTEMPT,
        userId: user.id,
        identifier: user.email,
        metadata: {
          action: "TRACKING_EVENT_BYPASS_ATTEMPT",
          parcelId: parcel.id,
          parcelTracking: parcel.trackingNumber,
          userAgencyId: user.agencyId,
        },
      });

      throw new ForbiddenException(
        "Accès refusé : l'expédition de ce colis n'appartient pas à votre agence autorisée.",
      );
    }

    // 3. Determine target status
    let targetStatus = params.targetStatus;
    if (!targetStatus) {
      // Inferred sequential next step for blind dock scans
      switch (parcel.status) {
        case ParcelStatus.REGISTERED:
          targetStatus = ParcelStatus.PICKED_UP;
          break;
        case ParcelStatus.PICKED_UP:
          targetStatus = ParcelStatus.IN_TRANSIT;
          break;
        case ParcelStatus.IN_TRANSIT:
          targetStatus = ParcelStatus.AT_HUB;
          break;
        case ParcelStatus.AT_HUB:
          targetStatus = ParcelStatus.OUT_FOR_DELIVERY;
          break;
        case ParcelStatus.OUT_FOR_DELIVERY:
          targetStatus = ParcelStatus.DELIVERED;
          break;
        default:
          targetStatus = parcel.status;
          break;
      }
    }

    // 4. State Machine & Terminal State Validation
    if (parcel.status === targetStatus) {
      // Idempotent scan: identical status requested
      return {
        duplicate: true,
        message: `Événement de scan déjà pris en compte (doublon ignoré : le colis '${parcel.trackingNumber}' est déjà au statut '${targetStatus}').`,
        source,
        parcel,
        shipment: parcel.shipment,
      };
    }

    // Explicit rejection of transitions out of terminal states
    const terminalStates: ParcelStatus[] = [
      ParcelStatus.DELIVERED,
      ParcelStatus.RETURNED,
      ParcelStatus.CANCELLED,
      ParcelStatus.LOST,
      ParcelStatus.DAMAGED,
    ];

    if (terminalStates.includes(parcel.status)) {
      throw new BadRequestException(
        `Impossible d'enregistrer un scan ou changement de statut sur un colis au statut terminal '${parcel.status}'.`,
      );
    }

    // Validate legal transition
    validateParcelTransition(parcel.status, targetStatus);

    // 5. Idempotency window check (60 seconds)
    const timeBucket = Math.floor(Date.now() / 60000);
    const idempKey =
      params.clientKey ||
      createHash("sha256")
        .update(
          `${parcel.id}:${targetStatus}:${effectiveAgencyId}:${timeBucket}`,
        )
        .digest("hex");

    // Fast-path Redis check if active
    const redisClient = this.redisService.getClient();
    if (redisClient && redisClient.status === "ready") {
      try {
        const lock = await redisClient.set(
          `idemp:scan:${idempKey}`,
          "locked",
          "EX",
          60,
          "NX",
        );
        if (!lock) {
          return {
            duplicate: true,
            message: "Événement de scan déjà pris en compte (doublon ignoré)",
            source,
            parcel,
            shipment: parcel.shipment,
          };
        }
      } catch (err: unknown) {
        this.logger.warn(`Redis idempotency check warning: ${err}`);
      }
    }

    // Database fallback deduplication check: within last 60 seconds
    const recentThreshold = new Date(Date.now() - 60000);
    const recentDuplicate = await this.prisma.trackingEvent.findFirst({
      where: {
        parcelId: parcel.id,
        status: targetStatus,
        createdAt: { gte: recentThreshold },
      },
    });

    if (recentDuplicate) {
      return {
        duplicate: true,
        message: "Événement de scan déjà pris en compte (doublon ignoré)",
        source,
        trackingEvent: recentDuplicate,
        parcel,
        shipment: parcel.shipment,
      };
    }

    // 6. Transactional persistence
    return this.prisma.$transaction(async (tx) => {
      // a. Create immutable tracking event
      const trackingEvent = await tx.trackingEvent.create({
        data: {
          shipmentId: parcel.shipmentId,
          parcelId: parcel.id,
          agencyId: effectiveAgencyId,
          userId: user.id,
          eventType: "STATUS_UPDATE",
          source,
          status: targetStatus,
          previousStatus: parcel.status,
          idempotencyKey: idempKey,
          notes:
            notes ??
            (source === TrackingEventSource.SCAN
              ? "Scan physique enregistré"
              : null),
          metadata: params.metadata
            ? (params.metadata as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        },
      });

      // b. Record physical scan entry
      if (
        source === TrackingEventSource.SCAN ||
        scannerType !== ScannerType.MANUAL_ENTRY
      ) {
        await tx.scanEvent.create({
          data: {
            shipmentId: parcel.shipmentId,
            parcelId: parcel.id,
            agencyId: effectiveAgencyId,
            userId: user.id,
            trackingEventId: trackingEvent.id,
            rawCode: rawBarcode,
            scanType: scannerType,
            oldStatus: parcel.status,
            newStatus: targetStatus,
          },
        });
      }

      // c. Update parcel status
      const updatedParcel = await tx.parcel.update({
        where: { id: parcel.id },
        data: { status: targetStatus },
      });

      // d. Derive and update parent shipment global status
      const allParcels = await tx.parcel.findMany({
        where: { shipmentId: parcel.shipmentId, deletedAt: null },
        select: { status: true },
      });

      const updatedStatuses = allParcels.map((p) =>
        p.status === parcel.status && p === parcel ? targetStatus : p.status,
      );
      const newGlobalStatus = computeGlobalShipmentStatus(updatedStatuses);

      const updatedShipment = await tx.shipment.update({
        where: { id: parcel.shipmentId },
        data: { globalStatus: newGlobalStatus },
      });

      // e. Audit manual adjustments
      if (source === TrackingEventSource.MANUAL) {
        await this.auditService.logEvent({
          eventType: AuditEventType.SECURITY_VIOLATION_AGENCY_BYPASS_ATTEMPT, // Audited with manual context
          userId: user.id,
          identifier: user.email,
          metadata: {
            action: "SHIPMENT_PARCEL_MANUAL_STATUS_CHANGE",
            parcelId: parcel.id,
            previousStatus: parcel.status,
            newStatus: targetStatus,
            notes,
          },
        });
      }

      return {
        duplicate: false,
        message: `Statut mis à jour avec succès : ${parcel.status} → ${targetStatus}`,
        source,
        trackingEvent,
        parcel: updatedParcel,
        shipment: updatedShipment,
      };
    });
  }
}
