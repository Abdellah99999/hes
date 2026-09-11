import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Optional,
} from "@nestjs/common";
import { PrismaService } from "../../../../prisma/prisma.service";
import { AuthenticatedUser } from "../../../auth/domain/auth.types";
import { CreateReturnDto } from "../../dto/create-return.dto";
import {
  ReturnStatus,
  ReturnItemStatus,
  ParcelStatus,
  ReturnType,
} from "@prisma/client";
import { EventBusService } from "../../../../common/events/event-bus.service";
import { ReturnCreatedEvent } from "../../../../common/events/return.events";

@Injectable()
export class CreateReturnUseCase {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly eventBus?: EventBusService,
  ) {}

  async execute(dto: CreateReturnDto, user: AuthenticatedUser) {
    // 1. Fetch shipment and associated parcels
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: dto.shipmentId },
      include: { parcels: true, originAgency: true, destinationAgency: true },
    });

    if (!shipment) {
      throw new NotFoundException("Expédition d'origine introuvable.");
    }

    // 2. Validate parcels belonging to shipment
    const validParcels = shipment.parcels.filter(
      (p) =>
        dto.parcelIds.includes(p.id) ||
        (p.trackingNumber && dto.parcelIds.includes(p.trackingNumber)),
    );

    if (validParcels.length === 0) {
      throw new BadRequestException(
        "Aucun colis valide de cette expédition n'a été sélectionné pour le retour.",
      );
    }

    const originAgencyId =
      user.agencyId ||
      shipment.destinationAgencyId ||
      shipment.originAgencyId;
    const destinationAgencyId =
      dto.destinationAgencyId || shipment.originAgencyId;

    // 3. Generate unique return sequence number RET-{AGENCY}-{YYYYMMDD}-{SEQ}
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
    const agencyCode =
      (shipment.destinationAgency as any)?.code ||
      (shipment.originAgency as any)?.code ||
      "HUB";
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const returnNumber = `RET-${agencyCode}-${dateStr}-${randomSuffix}`;

    const returnType = dto.returnType || ReturnType.REFUSAL_RETURN;

    const result = await this.prisma.$transaction(async (tx) => {
      // 3.1 Create Return root entity
      const returnDoc = await tx.return.create({
        data: {
          number: returnNumber,
          returnNumber,
          shipmentId: shipment.id,
          originAgencyId,
          destinationAgencyId,
          status: ReturnStatus.INITIATED,
          handledByUserId: dto.assignedCourierId || null,
          createdByUserId: user.id,
          reason: dto.reasonNotes?.trim() || null,
        } as any,
      });

      // 3.2 Create ReturnItem for each parcel and update parcel status to RETURNED
      const items = await Promise.all(
        validParcels.map(async (parcel) => {
          await tx.parcel.update({
            where: { id: parcel.id },
            data: { status: ParcelStatus.RETURNED },
          });

          return tx.returnItem.create({
            data: {
              returnId: returnDoc.id,
              parcelId: parcel.id,
              status: ReturnItemStatus.PENDING,
              reason: dto.reasonNotes?.trim() || null,
            } as any,
          });
        }),
      );

      return {
        ...returnDoc,
        returnNumber: (returnDoc as any).number || (returnDoc as any).returnNumber,
        items,
      };
    });

    // 4. Publish ReturnCreatedEvent via EventBus
    if (this.eventBus) {
      await this.eventBus.publish(
        new ReturnCreatedEvent({
          returnId: result.id,
          returnNumber: result.returnNumber,
          shipmentId: shipment.id,
          originAgencyId,
          destinationAgencyId,
          parcelIds: validParcels.map((p) => p.id),
          returnType,
          reason: dto.reasonNotes?.trim() || null,
          createdByUserId: user.id,
          assignedCourierId: dto.assignedCourierId || null,
          createdAt: new Date(),
        }),
      );
    }

    return result;
  }
}
