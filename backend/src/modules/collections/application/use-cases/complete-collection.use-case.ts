import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../../../../prisma/prisma.service";
import { AuthenticatedUser } from "../../../auth/domain/auth.types";
import { CompleteCollectionDto } from "../../dto/complete-collection.dto";
import { CreateShipmentUseCase } from "../../../shipments/application/use-cases/create-shipment.use-case";
import {
  CreateShipmentDto,
  ServiceType,
} from "../../../shipments/dto/create-shipment.dto";
import { EventBusService } from "../../../../common/events/event-bus.service";
import { CollectionCompletedEvent } from "../../../../common/events/collection.events";
import {
  CollectionStatus,
  ParcelStatus,
  PaymentMethod,
  TrackingEventSource,
} from "@prisma/client";

@Injectable()
export class CompleteCollectionUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly createShipmentUseCase: CreateShipmentUseCase,
    private readonly eventBus: EventBusService,
  ) {}

  async execute(
    collectionId: string,
    dto: CompleteCollectionDto,
    user: AuthenticatedUser,
  ) {
    const collection = await this.prisma.collection.findUnique({
      where: { id: collectionId },
      include: {
        customer: true,
        agency: true,
        items: true,
      },
    });

    if (!collection) {
      throw new NotFoundException("Demande de collecte introuvable.");
    }

    // 1. Check courier security: assigned courier or supervisor of same agency
    if (
      user.role === "COURIER" &&
      collection.assignedCourierId &&
      collection.assignedCourierId !== user.id
    ) {
      throw new ForbiddenException(
        "Vous ne pouvez clôturer qu'une mission de collecte qui vous est assignée.",
      );
    }

    if (
      !user.isGlobalScope &&
      user.agencyId &&
      user.agencyId !== collection.agencyId
    ) {
      throw new ForbiddenException(
        "Vous ne pouvez clôturer que les collectes rattachées à votre agence.",
      );
    }

    // 2. Validate current status
    if (
      collection.status !== CollectionStatus.ASSIGNED &&
      collection.status !== CollectionStatus.IN_PROGRESS
    ) {
      throw new BadRequestException(
        `Impossible de clôturer une collecte au statut '${collection.status}' (statut requis : ASSIGNED ou IN_PROGRESS).`,
      );
    }

    // 3. Resolve default parcel type
    const defaultParcelType = await this.prisma.parcelType.findFirst({
      where: { isActive: true },
    });
    const parcelTypeId = defaultParcelType?.id || "default-parcel-type";

    // 4. Resolve destination agency based on recipient city of first item
    const firstItem = dto.items[0];
    const destinationAgency =
      (await this.prisma.agency.findFirst({
        where: {
          city: {
            contains: firstItem.recipientCity || "",
            mode: "insensitive",
          },
          deletedAt: null,
          isActive: true,
        },
      })) || collection.agency;

    const totalCodAmount = dto.items.reduce(
      (sum, i) => sum + (i.codAmount || 0),
      0,
    );
    const totalDeclaredValue = dto.items.reduce(
      (sum, i) => sum + (i.declaredValue || 0),
      0,
    );
    const totalActualWeightKg =
      Math.round(
        dto.items.reduce((sum, i) => sum + i.actualWeightKg, 0) * 100,
      ) / 100;

    // 5. Build CreateShipmentDto reusing Phase 4 standard shipment creation
    const createShipmentDto: CreateShipmentDto = {
      originAgencyId: collection.agencyId,
      destinationAgencyId: destinationAgency.id,
      senderCustomerId: collection.customerId,
      senderAddressId: collection.pickupAddressId ?? undefined,
      recipientName:
        firstItem.recipientName?.trim() ||
        collection.pickupContactName ||
        "Destinataire",
      recipientPhone:
        firstItem.recipientPhone?.trim() ||
        collection.pickupPhone ||
        "+212600000000",
      recipientAddress:
        firstItem.recipientAddress?.trim() ||
        collection.pickupStreet ||
        "Adresse de livraison",
      recipientCity:
        firstItem.recipientCity?.trim() ||
        collection.pickupCity ||
        "Casablanca",
      serviceType: ServiceType.STANDARD,
      paymentMethod:
        totalCodAmount > 0 ? PaymentMethod.CASH_ON_DELIVERY : PaymentMethod.CASH,
      shippingFee: 50.0,
      declaredValue: totalDeclaredValue > 0 ? totalDeclaredValue : undefined,
      codAmount: totalCodAmount > 0 ? totalCodAmount : undefined,
      notes:
        `Généré automatiquement depuis la collecte ${collection.collectionNumber || collection.number}. ${dto.driverNotes || ""}`.trim(),
      parcels: dto.items.map((item) => ({
        parcelTypeId,
        weightKg: item.actualWeightKg,
        notes: item.notes?.trim() || undefined,
      })),
    };

    // 6. Execute Phase 4 CreateShipmentUseCase directly (Zero code duplication)
    const shipment = await this.createShipmentUseCase.execute(
      createShipmentDto,
      user,
    );

    // 7. Update collection and link collection items to created parcels
    const updatedCollection = await this.prisma.$transaction(async (tx) => {
      const coll = await tx.collection.update({
        where: { id: collectionId },
        data: {
          status: CollectionStatus.COMPLETED,
          completedAt: new Date(),
          completedByUserId: user.id,
          shipmentId: shipment.id,
          notes: dto.driverNotes
            ? `${collection.notes || ""}\n[Complétion] ${dto.driverNotes}`.trim()
            : collection.notes,
        },
      });

      const createdParcels = shipment.parcels || [];
      for (let i = 0; i < dto.items.length; i++) {
        const itemDto = dto.items[i];
        const matchingCollectionItem = collection.items.find(
          (ci) => ci.itemIndex === itemDto.itemIndex,
        );
        const correspondingParcel = createdParcels[i];

        if (matchingCollectionItem) {
          await tx.collectionItem.update({
            where: { id: matchingCollectionItem.id },
            data: {
              actualWeightKg: itemDto.actualWeightKg,
              generatedParcelId: correspondingParcel?.id ?? null,
              recipientName:
                itemDto.recipientName ?? matchingCollectionItem.recipientName,
              recipientCity:
                itemDto.recipientCity ?? matchingCollectionItem.recipientCity,
            },
          });
        }

        if (correspondingParcel) {
          await tx.parcel.update({
            where: { id: correspondingParcel.id },
            data: {
              status: ParcelStatus.PICKED_UP,
              currentAgencyId: collection.agencyId,
            },
          });

          await tx.trackingEvent.create({
            data: {
              shipmentId: shipment.id,
              parcelId: correspondingParcel.id,
              agencyId: collection.agencyId,
              userId: user.id,
              eventType: "PARCEL_PICKED_UP_ON_COLLECTION",
              source: TrackingEventSource.SCAN,
              status: ParcelStatus.PICKED_UP,
              previousStatus: ParcelStatus.REGISTERED,
              notes: `Colis enlevé chez le client (${collection.pickupContactName || "Expéditeur"}) par l'agent de collecte`,
            },
          });
        }
      }

      return coll;
    });

    // 8. Publish CollectionCompletedEvent via EventBus
    await this.eventBus.publish(
      new CollectionCompletedEvent({
        collectionId: collection.id,
        collectionNumber: collection.collectionNumber || collection.number,
        customerId: collection.customerId,
        agencyId: collection.agencyId,
        courierId: user.id,
        generatedShipmentId: shipment.id,
        shipmentTrackingNumber: shipment.trackingNumber || shipment.number,
        parcelsCount: dto.items.length,
        totalActualWeightKg,
        completedAt: new Date(),
      }),
    );

    return {
      collection: {
        ...updatedCollection,
        generatedShipmentId: shipment.id,
        actualParcelsCount: dto.items.length,
      },
      shipment,
      parcelsCount: dto.items.length,
      totalWeightKg: totalActualWeightKg,
    };
  }
}
