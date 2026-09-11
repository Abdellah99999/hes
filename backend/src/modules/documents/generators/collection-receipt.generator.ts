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
export class CollectionReceiptGenerator implements IDocumentGenerator {
  constructor(private readonly prisma: PrismaService) {}

  supports(type: DocumentType | string): boolean {
    return (
      type === DocumentType.COLLECTION_BORDEREAU ||
      type === DocumentType.RECEIPT ||
      type === "COLLECTION_BORDEREAU" ||
      type === "RECEIPT" ||
      type === ("COLLECTION_RECEIPT" as any)
    );
  }

  async generate(
    context: DocumentGenerationContext,
  ): Promise<GeneratedDocumentResult> {
    const col: any = await this.prisma.collection.findFirst({
      where: {
        OR: [
          { id: context.entityId },
          { collectionNumber: context.entityId },
          { number: context.entityId },
        ],
      } as any,
      include: {
        customer: true,
        agency: true,
        items: true,
      } as any,
    });

    if (!col) {
      throw new NotFoundException(
        `Collecte introuvable pour récépissé : "${context.entityId}".`,
      );
    }

    const parcelsCount =
      col.actualParcelsCount ??
      (col as any).actualParcels ??
      col.declaredParcelsCount ??
      0;
    const totalWeight =
      col.actualTotalWeight ??
      (col as any).actualWeightKg ??
      col.declaredTotalWeight ??
      0;
    const completedDate = col.completedAt
      ? col.completedAt.toISOString()
      : col.scheduledDate
        ? col.scheduledDate.toISOString()
        : (col as any).requestedDate
          ? new Date((col as any).requestedDate).toISOString()
          : new Date().toISOString();

    const title = `RECEPISSE DE COLLECTE - ${col.collectionNumber}`;
    const lines = [
      `DONNEUR D'ORDRE  : ${col.customer?.legalName || "N/A"} (Code: ${col.customer?.code || "N/A"})`,
      `AGENCE GESTIONNAIRE: ${col.agency?.name || "N/A"} (${col.agency?.code || "N/A"})`,
      `COLIS ENLEVES    : ${parcelsCount} colis constatés`,
      `POIDS TOTAL      : ${totalWeight} kg`,
      `STATUT MISSION   : ${col.status}`,
      `DATE ENLEVEMENT  : ${completedDate}`,
      `DOUBLE RECEPISSE : Un exemplaire conservé par le chargeur, un exemplaire quai`,
    ];

    const buffer = createMinimalPdf(title, lines);

    return {
      buffer,
      mimeType: "application/pdf",
      filename: `Recepisse_${col.collectionNumber}.pdf`,
      checksumSha256: computeSha256(buffer),
      pageCount: 2,
    };
  }
}
