import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import {
  IDocumentGenerator,
  DocumentGenerationContext,
  GeneratedDocumentResult,
  DocumentType,
} from "../domain/document.types";
import { createMinimalPdf, computeSha256 } from "./pdf-builder.helper";

@Injectable()
export class DeliveryNoteGenerator implements IDocumentGenerator {
  constructor(private readonly prisma: PrismaService) {}

  supports(type: DocumentType | string): boolean {
    return (
      type === DocumentType.BILL_OF_LADING ||
      type === "BILL_OF_LADING" ||
      type === ("DELIVERY_NOTE" as any)
    );
  }

  async generate(
    context: DocumentGenerationContext,
  ): Promise<GeneratedDocumentResult> {
    const shipment = await this.prisma.shipment.findFirst({
      where: {
        OR: [{ id: context.entityId }, { trackingNumber: context.entityId }],
      },
      include: {
        originAgency: true,
        destinationAgency: true,
        senderCustomer: true,
        parcels: true,
      },
    });

    if (!shipment) {
      throw new NotFoundException(
        `Expédition introuvable pour BL : "${context.entityId}".`,
      );
    }

    const copies = Math.max(1, context.copiesCount || 3);
    const title = `BORDEREAU DE LIVRAISON (BL) - ${shipment.trackingNumber}`;
    const senderName = shipment.senderCustomer?.legalName || "Expéditeur HES";
    const senderIce = shipment.senderCustomer?.ice || "N/A";
    const destCity = (shipment as any).recipientCity || shipment.destinationAgency?.city || "Destination";
    const destAgency = shipment.destinationAgency?.name || "Agence Dest";
    const origAgency = shipment.originAgency?.name || "Agence Orig";

    const lines = [
      `EXPEDITEUR   : ${senderName} (ICE: ${senderIce})`,
      `DESTINATAIRE : ${shipment.recipientName} - Tel: ${shipment.recipientPhone}`,
      `ADRESSE      : ${shipment.recipientAddress}, ${destCity}`,
      `AGENCES      : ${origAgency} -> ${destAgency}`,
      `NB COLIS     : ${shipment.parcels.length} colis (Poids Total: ${shipment.totalWeightKg ?? "N/A"} kg)`,
      `MONTANT COD  : ${shipment.codAmount ? Number(shipment.codAmount).toFixed(2) + " MAD" : "SANS COD"}`,
      `EXEMPLAIRES  : Édité en ${copies} exemplaires (Quai / Livreur / Client)`,
      `EMARGEMENT   : Signature & Cachet obligatoire à la réception avec relevé CIN`,
    ];

    const buffer = createMinimalPdf(title, lines);

    return {
      buffer,
      mimeType: "application/pdf",
      filename: `BL_${shipment.trackingNumber}.pdf`,
      checksumSha256: computeSha256(buffer),
      pageCount: copies,
    };
  }
}

