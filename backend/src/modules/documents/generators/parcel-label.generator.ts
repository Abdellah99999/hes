import { Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../../prisma/prisma.service";
import {
  IDocumentGenerator,
  DocumentGenerationContext,
  GeneratedDocumentResult,
  DocumentType,
} from "../domain/document.types";
import { createMinimalPdf, computeSha256 } from "./pdf-builder.helper";

@Injectable()
export class ParcelLabelGenerator implements IDocumentGenerator {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService?: ConfigService,
  ) {}

  supports(type: DocumentType): boolean {
    return type === DocumentType.PARCEL_LABEL;
  }

  async generate(
    context: DocumentGenerationContext,
  ): Promise<GeneratedDocumentResult> {
    const parcel = await this.prisma.parcel.findFirst({
      where: {
        OR: [{ id: context.entityId }, { trackingNumber: context.entityId }],
      },
      include: {
        shipment: {
          include: {
            originAgency: true,
            destinationAgency: true,
            senderCustomer: true,
          },
        },
      },
    });

    if (!parcel) {
      throw new NotFoundException(
        `Colis introuvable pour étiquette : "${context.entityId}".`,
      );
    }

    const appName =
      this.configService?.get<string>("appName", "HES Logistics Platform") ||
      "HES Logistics Platform";
    const title = `ETIQUETTE COLIS - ${appName}`;
    const senderName = parcel.shipment?.senderCustomer?.legalName || "Expéditeur HES";
    const destCity = (parcel.shipment as any)?.recipientCity || parcel.shipment?.destinationAgency?.city || "Destination";
    const destAgencyCode = parcel.shipment?.destinationAgency?.code || "TNG";
    const origAgencyCode = parcel.shipment?.originAgency?.code || "CAS";

    const lines = [
      `NUMERO TRACKING : ${parcel.trackingNumber}`,
      `CODE-BARRES 1D   : ${parcel.barcode}`,
      `EXPEDITEUR       : ${senderName}`,
      `DESTINATAIRE     : ${parcel.shipment?.recipientName} (${parcel.shipment?.recipientPhone})`,
      `DESTINATION      : ${destCity} [Hub: ${destAgencyCode}]`,
      `ORIGINE          : Hub ${origAgencyCode}`,
      `POIDS REEL       : ${parcel.weightKg} kg`,
      `QR ENCODING      : tracking:${parcel.trackingNumber}|bl:${parcel.barcode}|agency:${destAgencyCode}`,
    ];

    const buffer = createMinimalPdf(title, lines);

    return {
      buffer,
      mimeType: "application/pdf",
      filename: `Label_${parcel.trackingNumber}.pdf`,
      checksumSha256: computeSha256(buffer),
      pageCount: 1,
    };
  }
}

