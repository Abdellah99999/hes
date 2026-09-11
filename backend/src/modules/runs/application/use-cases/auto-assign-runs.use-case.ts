import {
  Injectable,
  ForbiddenException,
  BadRequestException,
  Optional,
} from "@nestjs/common";
import { PrismaService } from "../../../../prisma/prisma.service";
import { AuthenticatedUser } from "../../../auth/domain/auth.types";
import { AutoAssignRunsDto } from "../../dto/auto-assign-runs.dto";
import {
  ParcelStatus,
  RunShift,
  DeliveryRunStatus,
  RunItemStatus,
  CourierStatus,
  AgencyStatus,
} from "@prisma/client";
import { EventBusService } from "../../../../common/events/event-bus.service";
import { ShipmentAssignedToCourierEvent } from "../../../../common/events/run.events";

export interface UnzonedParcelSummary {
  parcelId: string;
  trackingNumber: string;
  recipientAddress: string;
  recipientCity: string;
  weightKg: number;
}

export interface AutoAssignResult {
  agencyId: string;
  runDate: string;
  shift: RunShift;
  assignedParcelsCount: number;
  unzonedParcelsCount: number;
  createdRunsCount: number;
  unzonedParcels: UnzonedParcelSummary[];
}

@Injectable()
export class AutoAssignRunsUseCase {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly eventBus?: EventBusService,
  ) {}

  async execute(
    dto: AutoAssignRunsDto,
    user: AuthenticatedUser,
  ): Promise<AutoAssignResult> {
    const effectiveAgencyId = dto.agencyId || user.agencyId;
    if (!effectiveAgencyId) {
      throw new BadRequestException(
        "Une agence doit être spécifiée pour lancer l'affectation.",
      );
    }

    if (
      !user.isGlobalScope &&
      user.agencyId &&
      user.agencyId !== effectiveAgencyId
    ) {
      throw new ForbiddenException(
        "Vous ne pouvez lancer l'affectation que pour votre propre agence.",
      );
    }

    const shift = dto.shift || RunShift.MORNING;
    const runDateObj = new Date(dto.runDate);

    // 1. Fetch eligible parcels in hub quai
    const parcels = await this.prisma.parcel.findMany({
      where: {
        currentAgencyId: effectiveAgencyId,
        status: { in: [ParcelStatus.AT_HUB, ParcelStatus.REGISTERED] },
        deletedAt: null,
      },
      include: {
        shipment: true,
      },
    });

    // 2. Fetch active agency zones
    const zones = await this.prisma.zone.findMany({
      where: {
        agencyId: effectiveAgencyId,
        status: AgencyStatus.ACTIVE,
        deletedAt: null,
      },
    });

    // 3. Fetch available couriers with their profiles and current runs on this date/shift
    const couriers = await this.prisma.courierProfile.findMany({
      where: {
        agencyId: effectiveAgencyId,
        isActive: true,
        status: { in: [CourierStatus.AVAILABLE, CourierStatus.ON_RUN] },
      },
      include: {
        user: true,
        runs: {
          where: {
            runDate: runDateObj,
            shift,
            status: { in: [DeliveryRunStatus.PLANNED] },
          },
          include: { runItems: true },
        },
      } as any,
    });

    const unzonedParcels: UnzonedParcelSummary[] = [];
    const assignedParcels: {
      parcelId: string;
      courierId: string;
      zoneId: string;
    }[] = [];

    // Map each parcel to zone and courier
    for (const parcel of parcels) {
      let matchedZoneId: string | null =
        (parcel as any).zoneId ??
        (parcel as any).shipment?.recipientZoneId ??
        (parcel as any).shipment?.destinationAddress?.zoneId ??
        null;

      const recipientCity =
        (parcel.shipment as any)?.recipientCity ||
        (parcel.shipment as any)?.destinationAddress?.city ||
        "";

      if (!matchedZoneId) {
        const fullAddr =
          `${parcel.shipment?.recipientAddress || ""} ${recipientCity}`.toLowerCase();
        for (const zone of zones) {
          const zoneName = zone.name.toLowerCase();
          const zoneCode = zone.code.toLowerCase();
          const postalCodes = (zone as any).postalCodes
            ? (zone as any).postalCodes.toLowerCase()
            : "";

          if (
            fullAddr.includes(zoneName) ||
            fullAddr.includes(zoneCode) ||
            (postalCodes &&
              postalCodes
                .split(",")
                .some((p: string) => fullAddr.includes(p.trim())))
          ) {
            matchedZoneId = zone.id;
            break;
          }
        }
      }

      // Explicit handling of UNZONED case
      if (!matchedZoneId) {
        unzonedParcels.push({
          parcelId: parcel.id,
          trackingNumber:
            parcel.trackingNumber || parcel.number || parcel.id,
          recipientAddress: parcel.shipment?.recipientAddress || "",
          recipientCity,
          weightKg: Number(parcel.weightKg ?? 0),
        });
        continue;
      }

      // Select candidate courier for this zone
      const primaryCouriers = couriers.filter(
        (c: any) =>
          c.primaryZoneId === matchedZoneId ||
          c.user?.zoneId === matchedZoneId,
      );
      const secondaryCouriers = couriers.filter((c: any) =>
        c.secondaryZones?.some(
          (sz: any) => sz.id === matchedZoneId || sz === matchedZoneId,
        ),
      );
      const candidateCouriers =
        primaryCouriers.length > 0 ? primaryCouriers : secondaryCouriers;

      if (candidateCouriers.length === 0) {
        // No courier assigned to this zone -> keep in unzoned / manual pool
        unzonedParcels.push({
          parcelId: parcel.id,
          trackingNumber:
            parcel.trackingNumber || parcel.number || parcel.id,
          recipientAddress: parcel.shipment?.recipientAddress || "",
          recipientCity,
          weightKg: Number(parcel.weightKg ?? 0),
        });
        continue;
      }

      // Pick courier with highest remaining capacity
      candidateCouriers.sort((a: any, b: any) => {
        const aRuns = a.deliveryRuns || a.runs || [];
        const bRuns = b.deliveryRuns || b.runs || [];
        const aRun = aRuns[0];
        const bRun = bRuns[0];
        const aCount = aRun
          ? (aRun.items || aRun.runItems || []).length
          : 0;
        const bCount = bRun
          ? (bRun.items || bRun.runItems || []).length
          : 0;
        const aCap = a.maxParcelsCapacity ?? a.maxDailyParcels ?? 50;
        const bCap = b.maxParcelsCapacity ?? b.maxDailyParcels ?? 50;
        return aCap - aCount - (bCap - bCount);
      });

      const selectedCourier = candidateCouriers[candidateCouriers.length - 1];
      assignedParcels.push({
        parcelId: parcel.id,
        courierId: selectedCourier.id,
        zoneId: matchedZoneId,
      });
    }

    // Persist runs and items in transaction
    const createdRuns = await this.prisma.$transaction(async (tx) => {
      const runsMap = new Map<string, any>(); // courierId -> run

      // Ensure runs exist for selected couriers
      for (const item of assignedParcels) {
        if (!runsMap.has(item.courierId)) {
          let existingRun = await tx.deliveryRun.findFirst({
            where: {
              courierId: item.courierId,
              runDate: runDateObj,
              shift,
              status: {
                in: [DeliveryRunStatus.PLANNED],
              },
            },
          });

          if (!existingRun) {
            const agency = await tx.agency.findUnique({
              where: { id: effectiveAgencyId },
            });
            const agencyCode = agency?.code || "AGY";
            const dateStr = dto.runDate.replace(/-/g, "");
            const count = await tx.deliveryRun.count({
              where: { agencyId: effectiveAgencyId },
            });
            const runNumber = `RUN-${agencyCode}-${dateStr}-${String(count + 1).padStart(3, "0")}`;

            existingRun = await tx.deliveryRun.create({
              data: {
                number: runNumber,
                runNumber,
                agencyId: effectiveAgencyId,
                zoneId: item.zoneId,
                courierId: item.courierId,
                shift,
                runDate: runDateObj,
                status: DeliveryRunStatus.PLANNED,
                createdByUserId: user.id,
              } as any,
            });
          }
          runsMap.set(item.courierId, existingRun);
        }
      }

      // Attach items to runs
      for (let i = 0; i < assignedParcels.length; i++) {
        const assign = assignedParcels[i];
        const run = runsMap.get(assign.courierId)!;
        const courier = couriers.find((c: any) => c.id === assign.courierId);

        await tx.deliveryRunItem.upsert({
          where: {
            deliveryRunId_parcelId: {
              deliveryRunId: run.id,
              parcelId: assign.parcelId,
            },
          },
          create: {
            deliveryRunId: run.id,
            parcelId: assign.parcelId,
            sequenceOrder: i + 1,
            status: RunItemStatus.PENDING,
          },
          update: {},
        });

        if (courier?.userId) {
          await tx.parcel.update({
            where: { id: assign.parcelId },
            data: {
              courierId: courier.userId,
            },
          });
        }
      }

      // Update total counters on runs
      const finalRuns: any[] = [];
      for (const [, run] of runsMap.entries()) {
        const items = await tx.deliveryRunItem.findMany({
          where: { deliveryRunId: run.id },
          include: { parcel: { include: { shipment: true } } },
        });

        const totalWeightKg = items.reduce(
          (sum: number, it: any) => sum + Number(it.parcel?.weightKg ?? 0),
          0,
        );
        const totalCod = items.reduce(
          (sum: number, it: any) =>
            sum +
            (it.parcel?.shipment?.codAmount
              ? Number(it.parcel.shipment.codAmount)
              : 0),
          0,
        );

        const updatedRun = await tx.deliveryRun.update({
          where: { id: run.id },
          data: {
            totalParcels: items.length,
            totalWeightKg,
            totalCodToCollect: totalCod,
          } as any,
        });

        finalRuns.push(updatedRun || run);
      }

      return finalRuns;
    });

    // Publish ShipmentAssignedToCourier events via EventBus
    if (this.eventBus) {
      for (const assign of assignedParcels) {
        const courier = couriers.find((c: any) => c.id === assign.courierId);
        const run = createdRuns.find(
          (r: any) => r.courierId === assign.courierId,
        );
        const parcel = parcels.find((p: any) => p.id === assign.parcelId);
        if (courier && run && parcel) {
          const runNum =
            (run as any).number || (run as any).runNumber || run.id;
          const trackingNum =
            parcel.trackingNumber || parcel.number || parcel.id;
          const courierUser = (courier as any)?.user;
          const courierFullName = courierUser
            ? `${courierUser.firstName || ""} ${courierUser.lastName || ""}`.trim()
            : "Livreur";

          await this.eventBus.publish(
            new ShipmentAssignedToCourierEvent({
              shipmentId:
                parcel.shipmentId ||
                (parcel.shipment as any)?.id ||
                parcel.id,
              parcelId: parcel.id,
              trackingNumber: trackingNum,
              deliveryRunId: run.id,
              deliveryRunNumber: runNum,
              courierId: courier.id,
              courierUserId: courier.userId,
              courierName: courierFullName,
              agencyId: effectiveAgencyId,
              zoneId: assign.zoneId,
              isOutOfZone: false,
              assignedAt: new Date(),
              assignedByUserId: user.id,
            }),
          );
        }
      }
    }

    return {
      agencyId: effectiveAgencyId,
      runDate: dto.runDate,
      shift,
      assignedParcelsCount: assignedParcels.length,
      unzonedParcelsCount: unzonedParcels.length,
      createdRunsCount: createdRuns.length,
      unzonedParcels,
    };
  }
}
