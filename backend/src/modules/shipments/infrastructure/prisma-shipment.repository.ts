import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import {
  Prisma,
  Shipment,
  ParcelStatus,
  ShipmentStatus,
  AuditEventType,
} from "@prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";
import { AuditService } from "../../auth/services/audit.service";
import {
  IShipmentRepository,
  ShipmentWithRelations,
} from "../domain/shipment.repository.interface";
import { CreateShipmentDto } from "../dto/create-shipment.dto";
import { ShipmentQueryDto } from "../dto/shipment-query.dto";
import { UpdateParcelStatusDto } from "../dto/update-parcel-status.dto";
import { PaginatedResult } from "../../../common/dto/pagination-query.dto";
import { AuthenticatedUser } from "../../auth/domain/auth.types";
import { computeGlobalShipmentStatus } from "../domain/shipment-status.calculator";
import { validateParcelTransition } from "../domain/parcel-state-machine";

@Injectable()
export class PrismaShipmentRepository implements IShipmentRepository {
  private readonly defaultInclude = {
    originAgency: true,
    destinationAgency: true,
    senderCustomer: true,
    createdByUser: {
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
      },
    },
    parcels: {
      include: {
        parcelType: true,
        items: true,
      },
      orderBy: {
        parcelIndex: "asc" as const,
      },
    },
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  private async verifyShipmentAgencyAccess(
    shipmentId: string,
    action: string,
    user: AuthenticatedUser,
  ): Promise<Shipment> {
    const shipment = await this.prisma.shipment.findFirst({
      where: { id: shipmentId, deletedAt: null },
    });

    if (!shipment) {
      throw new NotFoundException("Expédition introuvable.");
    }

    if (
      !user.isGlobalScope &&
      user.agencyId &&
      shipment.originAgencyId !== user.agencyId &&
      shipment.destinationAgencyId !== user.agencyId
    ) {
      await this.auditService.logEvent({
        eventType: AuditEventType.SECURITY_VIOLATION_AGENCY_BYPASS_ATTEMPT,
        userId: user.id,
        identifier: user.email,
        metadata: {
          action,
          targetResourceId: shipmentId,
          targetOriginAgencyId: shipment.originAgencyId,
          targetDestinationAgencyId: shipment.destinationAgencyId,
          userAgencyId: user.agencyId,
        },
      });

      throw new ForbiddenException(
        "Accès refusé : l'expédition demandée n'appartient ni à votre agence d'origine ni à votre agence de destination.",
      );
    }

    return shipment;
  }

  async create(
    dto: CreateShipmentDto,
    user: AuthenticatedUser,
  ): Promise<ShipmentWithRelations> {
    const effectiveOriginAgencyId = user.isGlobalScope
      ? dto.originAgencyId || user.agencyId
      : user.agencyId;

    if (!effectiveOriginAgencyId) {
      throw new BadRequestException(
        "L'agence d'origine de l'expédition est requise.",
      );
    }

    const originAgency = await this.prisma.agency.findUnique({
      where: { id: effectiveOriginAgencyId },
    });

    if (!originAgency) {
      throw new NotFoundException("Agence d'origine introuvable.");
    }

    const currentYear = new Date().getFullYear();
    const totalParcels = dto.parcels.length;
    const totalWeightKg = dto.parcels.reduce((sum, p) => sum + p.weightKg, 0);

    return this.prisma.$transaction(async (tx) => {
      // 1. Transactional atomic sequence increment with upsert & row locking
      // We first try upserting sequence record
      let nextSeqValue: number;
      let prefix = "HES";

      try {
        const rawSeq: Array<{ current_value: number; prefix: string }> =
          await tx.$queryRaw`
            INSERT INTO shipment_sequences (id, agency_id, year, current_value, prefix, created_at, updated_at)
            VALUES (gen_random_uuid(), ${effectiveOriginAgencyId}, ${currentYear}, 1, 'HES', NOW(), NOW())
            ON CONFLICT (agency_id, year)
            DO UPDATE SET current_value = shipment_sequences.current_value + 1, updated_at = NOW()
            RETURNING current_value, prefix;
          `;
        nextSeqValue = Number(rawSeq[0]?.current_value ?? 1);
        prefix = rawSeq[0]?.prefix ?? "HES";
      } catch {
        // Fallback for in-memory / non-raw database mocks in tests
        const seq = await tx.shipmentSequence.upsert({
          where: {
            agencyId_year: {
              agencyId: effectiveOriginAgencyId,
              year: currentYear,
            },
          },
          create: {
            agencyId: effectiveOriginAgencyId,
            year: currentYear,
            currentValue: 1,
            prefix: "HES",
          },
          update: {
            currentValue: { increment: 1 },
          },
        });
        nextSeqValue = seq.currentValue;
        prefix = seq.prefix;
      }

      // 2. Format tracking numbers
      const paddedSeq = String(nextSeqValue).padStart(6, "0");
      const agencyCodeClean = originAgency.code
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "");
      const shipmentTrackingNumber = `${prefix}-${agencyCodeClean}-${currentYear}-${paddedSeq}`;

      // 3. Create the Shipment header
      const shipment = await tx.shipment.create({
        data: {
          number: shipmentTrackingNumber,
          trackingNumber: shipmentTrackingNumber,
          originAgencyId: effectiveOriginAgencyId,
          destinationAgencyId: dto.destinationAgencyId,
          senderCustomerId: dto.senderCustomerId,
          senderAddressId: dto.senderAddressId ?? null,
          recipientName: dto.recipientName.trim(),
          recipientPhone: dto.recipientPhone.trim(),
          recipientAddress: dto.recipientCity
            ? `${dto.recipientAddress.trim()}, ${dto.recipientCity.trim()}`
            : dto.recipientAddress.trim(),
          globalStatus: ShipmentStatus.REGISTERED,
          shippingFee: new Prisma.Decimal(dto.shippingFee),
          declaredValue: dto.declaredValue
            ? new Prisma.Decimal(dto.declaredValue)
            : null,
          codAmount: dto.codAmount ? new Prisma.Decimal(dto.codAmount) : null,
          totalParcels,
          totalWeightKg: totalWeightKg ? new Prisma.Decimal(totalWeightKg) : null,
          notes: dto.notes?.trim() ?? null,
          createdByUserId: user.id,
        },
      });

      // 4. Create all Parcels and their Items atomically
      for (let i = 0; i < dto.parcels.length; i++) {
        const parcelDto = dto.parcels[i];
        const parcelIndex = i + 1;
        const parcelTracking = `${shipmentTrackingNumber}-${String(parcelIndex).padStart(2, "0")}`;

        const volumetricWeightKg =
          parcelDto.lengthCm && parcelDto.widthCm && parcelDto.heightCm
            ? (parcelDto.lengthCm * parcelDto.widthCm * parcelDto.heightCm) /
              5000
            : null;

        const createdParcel = await tx.parcel.create({
          data: {
            number: parcelTracking,
            trackingNumber: parcelTracking,
            shipmentId: shipment.id,
            originAgencyId: effectiveOriginAgencyId,
            destinationAgencyId: dto.destinationAgencyId,
            currentAgencyId: effectiveOriginAgencyId,
            parcelTypeId: parcelDto.parcelTypeId,
            parcelIndex,
            weightKg: parcelDto.weightKg,
            volumetricWeightKg,
            status: ParcelStatus.REGISTERED,
            barcode: parcelTracking,
            qrCode: parcelTracking,
            notes: parcelDto.notes?.trim() ?? null,
          },
        });

        if (parcelDto.items && parcelDto.items.length > 0) {
          const itemDelegate = tx.shipmentItem || (tx as any).parcelItem;
          if (itemDelegate?.createMany) {
            await itemDelegate.createMany({
              data: parcelDto.items.map((item) => ({
                shipmentId: shipment.id,
                parcelId: createdParcel.id,
                description: item.description.trim(),
                quantity: item.quantity ?? 1,
                declaredValue: item.declaredValue
                  ? new Prisma.Decimal(item.declaredValue)
                  : null,
                hsCode: item.hsCode?.trim() ?? null,
              })),
            });
          }
        }
      }

      return tx.shipment.findUniqueOrThrow({
        where: { id: shipment.id },
        include: this.defaultInclude,
      }) as unknown as ShipmentWithRelations;
    });
  }

  async findById(
    id: string,
    user: AuthenticatedUser,
  ): Promise<ShipmentWithRelations | null> {
    await this.verifyShipmentAgencyAccess(id, "SHIPMENT_READ_ATTEMPT", user);

    return this.prisma.shipment.findUnique({
      where: { id },
      include: this.defaultInclude,
    });
  }

  async findByTrackingNumber(
    trackingNumber: string,
    user: AuthenticatedUser,
  ): Promise<ShipmentWithRelations | null> {
    const shipment = await this.prisma.shipment.findFirst({
      where: {
        OR: [
          { trackingNumber: trackingNumber.trim().toUpperCase() },
          { number: trackingNumber.trim().toUpperCase() },
        ],
      },
      include: this.defaultInclude,
    });

    if (!shipment) {
      throw new NotFoundException("Expédition introuvable.");
    }

    if (
      !user.isGlobalScope &&
      user.agencyId &&
      shipment.originAgencyId !== user.agencyId &&
      shipment.destinationAgencyId !== user.agencyId
    ) {
      await this.auditService.logEvent({
        eventType: AuditEventType.SECURITY_VIOLATION_AGENCY_BYPASS_ATTEMPT,
        userId: user.id,
        identifier: user.email,
        metadata: {
          action: "SHIPMENT_READ_BY_TRACKING_ATTEMPT",
          trackingNumber,
          userAgencyId: user.agencyId,
        },
      });

      throw new ForbiddenException(
        "Accès refusé : l'expédition demandée n'appartient pas à votre périmètre d'agence.",
      );
    }

    return shipment as unknown as ShipmentWithRelations;
  }

  async findAll(
    query: ShipmentQueryDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedResult<ShipmentWithRelations>> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.ShipmentWhereInput = {
      deletedAt: null,
      ...(query.destinationAgencyId
        ? { destinationAgencyId: query.destinationAgencyId }
        : {}),
      ...(query.senderCustomerId
        ? { senderCustomerId: query.senderCustomerId }
        : {}),
      ...(query.globalStatus ? { globalStatus: query.globalStatus } : {}),
    };

    // Agency isolation: for local agents, only shipments where origin OR destination matches user agency
    if (!user.isGlobalScope && user.agencyId) {
      where.OR = [
        { originAgencyId: user.agencyId },
        { destinationAgencyId: user.agencyId },
      ];
    } else if (query.originAgencyId) {
      where.originAgencyId = query.originAgencyId;
    }

    if (query.search) {
      const searchFilter = {
        contains: query.search,
        mode: "insensitive" as const,
      };
      where.AND = [
        {
          OR: [
            { trackingNumber: searchFilter },
            { number: searchFilter },
            { recipientName: searchFilter },
            { recipientPhone: searchFilter },
            { recipientAddress: searchFilter },
          ],
        },
      ];
    }

    const [total, data] = await Promise.all([
      this.prisma.shipment.count({ where }),
      this.prisma.shipment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: this.defaultInclude,
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: data as unknown as ShipmentWithRelations[],
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  async updateParcelStatus(
    parcelId: string,
    dto: UpdateParcelStatusDto,
    user: AuthenticatedUser,
  ): Promise<ShipmentWithRelations> {
    const parcel = await this.prisma.parcel.findUnique({
      where: { id: parcelId, deletedAt: null },
      include: { shipment: true },
    });

    if (!parcel) {
      throw new NotFoundException("Colis introuvable.");
    }

    // Verify agency access on parent shipment
    await this.verifyShipmentAgencyAccess(
      parcel.shipmentId,
      "PARCEL_STATUS_UPDATE_ATTEMPT",
      user,
    );

    // Validate state machine transition rules
    validateParcelTransition(parcel.status, dto.status);

    return this.prisma.$transaction(async (tx) => {
      // 1. Update the parcel status
      await tx.parcel.update({
        where: { id: parcelId },
        data: {
          status: dto.status,
          ...(dto.notes ? { notes: dto.notes.trim() } : {}),
        },
      });

      // 2. Fetch all sibling parcel statuses for this shipment
      const allParcels = await tx.parcel.findMany({
        where: { shipmentId: parcel.shipmentId, deletedAt: null },
        select: { status: true },
      });

      // 3. Compute derived global shipment status
      const updatedStatuses = allParcels.map((p) => p.status);
      const newGlobalStatus = computeGlobalShipmentStatus(updatedStatuses);

      // 4. Update parent shipment status
      await tx.shipment.update({
        where: { id: parcel.shipmentId },
        data: { globalStatus: newGlobalStatus },
      });

      return tx.shipment.findUniqueOrThrow({
        where: { id: parcel.shipmentId },
        include: this.defaultInclude,
      });
    });
  }
}
