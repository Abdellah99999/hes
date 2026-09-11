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
export class TransferManifestGenerator implements IDocumentGenerator {
  constructor(private readonly prisma: PrismaService) {}

  supports(type: DocumentType | string): boolean {
    return (
      type === DocumentType.TRANSFER_BORDEREAU ||
      type === "TRANSFER_BORDEREAU" ||
      type === ("TRANSFER_MANIFEST" as any)
    );
  }

  async generate(
    context: DocumentGenerationContext,
  ): Promise<GeneratedDocumentResult> {
    const transfer = await this.prisma.transfer.findFirst({
      where: {
        OR: [{ id: context.entityId }, { transferNumber: context.entityId }],
      },
      include: {
        originAgency: true,
        destinationAgency: true,
        items: true,
      },
    });

    if (!transfer) {
      throw new NotFoundException(
        `Transfert introuvable pour manifeste : "${context.entityId}".`,
      );
    }

    const totalParcels =
      transfer.totalExpectedParcels ??
      (transfer as any).totalParcels ??
      transfer.items?.length ??
      0;
    const originName = transfer.originAgency?.name || "Origine";
    const originCode = transfer.originAgency?.code || "CAS";
    const destName = transfer.destinationAgency?.name || "Destination";
    const destCode = transfer.destinationAgency?.code || "TNG";

    const transferNum = transfer.transferNumber || transfer.number || context.entityId;
    const title = `MANIFESTE DE TRANSFERT NAVETTE - ${transferNum}`;
    const lines = [
      `ROUTAGE          : ${originName} (${originCode}) -> ${destName} (${destCode})`,
      `STATUT TRANSFERT : ${transfer.status}`,
      `NB COLIS EN NAVETTE: ${totalParcels} colis répertoriés`,
      `POIDS TOTAL      : ${(transfer as any).totalWeightKg ?? 0} kg`,
      `DATE DE DEPART   : ${transfer.dispatchedAt ? transfer.dispatchedAt.toISOString() : "En préparation"}`,
      `CHAUFFEUR/VEHICULE: ${transfer.driverName || "Non renseigné"} [Immat: ${transfer.vehiclePlate || "N/A"}]`,
      `DOUBLE EXEMPLAIRE: Remis au chauffeur navette et contrôlé au quai de réception`,
    ];

    const buffer = createMinimalPdf(title, lines);

    return {
      buffer,
      mimeType: "application/pdf",
      filename: `Manifeste_${transferNum}.pdf`,
      checksumSha256: computeSha256(buffer),
      pageCount: 2,
    };
  }
}
