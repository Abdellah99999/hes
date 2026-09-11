import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../../../../prisma/prisma.service";
import { AuthenticatedUser } from "../../../auth/domain/auth.types";
import { RequestCollectionDto } from "../../dto/request-collection.dto";
import { CollectionStatus } from "@prisma/client";

@Injectable()
export class RequestCollectionUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(dto: RequestCollectionDto, user: AuthenticatedUser) {
    // 1. Resolve Customer ID and enforce customer isolation
    let effectiveCustomerId: string;

    if (user.role === "CUSTOMER") {
      // If client portal user, customerId is mandatory and enforced from token/user
      if (!user.customerId) {
        // Fallback: look up Customer where email matches user email
        const matchedCustomer = await this.prisma.customer.findFirst({
          where: { email: user.email, deletedAt: null },
        });
        if (!matchedCustomer) {
          throw new ForbiddenException(
            "Votre compte utilisateur n'est associé à aucun compte client valide.",
          );
        }
        effectiveCustomerId = matchedCustomer.id;
      } else {
        effectiveCustomerId = user.customerId;
      }
    } else {
      // Internal operator or admin creating on behalf of a customer
      if (dto.pickupAddressId) {
        const addr = await this.prisma.address.findUnique({
          where: { id: dto.pickupAddressId },
        });
        if (!addr || !addr.customerId) {
          throw new BadRequestException(
            "Adresse introuvable ou non associée à un client.",
          );
        }
        effectiveCustomerId = addr.customerId;
      } else {
        const customer = await this.prisma.customer.findFirst({
          where: {
            agencyId: user.agencyId ?? undefined,
            deletedAt: null,
          },
        });
        if (!customer) {
          throw new NotFoundException(
            "Aucun client trouvé pour rattacher cette collecte.",
          );
        }
        effectiveCustomerId = customer.id;
      }
    }

    // 2. Fetch and validate Customer
    const customer = await this.prisma.customer.findUnique({
      where: { id: effectiveCustomerId },
      include: { agency: true },
    });

    if (!customer || customer.deletedAt) {
      throw new NotFoundException("Client introuvable ou inactif.");
    }

    // 3. Resolve Agency and Zone for pickup
    let agencyId = customer.agencyId;
    let zoneId: string | null = null;

    if (dto.pickupAddressId) {
      const address = await this.prisma.address.findUnique({
        where: { id: dto.pickupAddressId },
      });
      if (address) {
        if (address.customerId && address.customerId !== effectiveCustomerId) {
          throw new ForbiddenException(
            "L'adresse de ramassage sélectionnée n'appartient pas à votre compte client.",
          );
        }
        agencyId = address.agencyId || agencyId;
        zoneId = address.zoneId || null;
      }
    }

    const agency = await this.prisma.agency.findUnique({
      where: { id: agencyId },
    });
    if (!agency) {
      throw new NotFoundException("Agence de rattachement introuvable.");
    }

    // 4. Generate collection number (COL-XXX-YEAR-NNNNN)
    const currentYear = new Date().getFullYear();
    const count = await this.prisma.collection.count({
      where: { agencyId },
    });
    const seq = String(count + 1).padStart(5, "0");
    const collectionNumber = `COL-${agency.code}-${currentYear}-${seq}`;

    // Format metadata in notes
    const noteSegments: string[] = [];
    if (dto.timeSlotStart || dto.timeSlotEnd) {
      noteSegments.push(
        `[Créneau: ${dto.timeSlotStart || ""} - ${dto.timeSlotEnd || ""}]`,
      );
    }
    if (dto.clientNotes?.trim()) {
      noteSegments.push(dto.clientNotes.trim());
    }
    const combinedNotes =
      noteSegments.length > 0 ? noteSegments.join(" ") : null;

    // 5. Transactional persistence
    return this.prisma.$transaction(async (tx) => {
      const collection = await tx.collection.create({
        data: {
          number: collectionNumber,
          collectionNumber,
          customerId: effectiveCustomerId,
          agencyId,
          zoneId,
          pickupAddressId: dto.pickupAddressId ?? null,
          pickupContactName: dto.pickupContactName.trim(),
          pickupPhone: dto.pickupPhone.trim(),
          pickupStreet: dto.pickupStreet.trim(),
          pickupCity: dto.pickupCity.trim(),
          scheduledDate: new Date(dto.scheduledDate),
          status: CollectionStatus.REQUESTED,
          notes: combinedNotes,
          createdByUserId: user.id,
        },
      });

      // Insert collection items
      for (let i = 0; i < dto.items.length; i++) {
        const itemDto = dto.items[i];
        await tx.collectionItem.create({
          data: {
            collectionId: collection.id,
            itemIndex: i + 1,
            declaredWeightKg: itemDto.declaredWeightKg ?? 1.0,
            description: itemDto.description?.trim() ?? null,
            recipientName: itemDto.recipientName.trim(),
            recipientPhone: itemDto.recipientPhone.trim(),
            recipientAddress: itemDto.recipientAddress.trim(),
            recipientCity: itemDto.recipientCity.trim(),
            codAmount: itemDto.codAmount ?? null,
            declaredValue: itemDto.declaredValue ?? null,
            notes: itemDto.notes?.trim() ?? null,
          },
        });
      }

      return collection;
    });
  }
}
