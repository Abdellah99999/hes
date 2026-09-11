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
export class RunSheetGenerator implements IDocumentGenerator {
  constructor(private readonly prisma: PrismaService) {}

  supports(type: DocumentType): boolean {
    return type === DocumentType.DELIVERY_RUN_SHEET;
  }

  async generate(
    context: DocumentGenerationContext,
  ): Promise<GeneratedDocumentResult> {
    const run: any = await this.prisma.deliveryRun.findFirst({
      where: {
        OR: [{ id: context.entityId }, { number: context.entityId }],
      } as any,
      include: {
        agency: true,
        courier: { include: { user: true } },
        runItems: true,
      } as any,
    });

    if (!run) {
      throw new NotFoundException(
        `Tournée introuvable pour feuille de route : "${context.entityId}".`,
      );
    }

    const runNumber = run.number || run.runNumber || context.entityId;
    const courierName = run.courier?.user
      ? `${run.courier.user.firstName} ${run.courier.user.lastName}`
      : "Livreur non assigné";
    const totalCod =
      run.totalCodAmount ??
      run.totalCodToCollect ??
      run.collectedCodAmount ??
      0;
    const totalParcels =
      run.totalParcels ??
      run.runItems?.length ??
      run.items?.length ??
      0;
    const runDateStr = run.runDate
      ? new Date(run.runDate).toISOString().slice(0, 10)
      : "N/A";
    const shiftStr = run.shift || run.slot || "N/A";
    const agencyName = run.agency?.name || "N/A";
    const agencyCode = run.agency?.code || "N/A";

    const title = `FEUILLE DE TOURNEE LIVREUR - ${runNumber}`;
    const lines = [
      `LIVREUR          : ${courierName}`,
      `AGENCE BASE      : ${agencyName} (${agencyCode})`,
      `DATE TOURNEE     : ${runDateStr} [Créneau: ${shiftStr}]`,
      `COLIS A LIVRER   : ${totalParcels} colis assignés`,
      `MONTANT COD THEORIQUE: ${Number(totalCod).toFixed(2)} MAD`,
      `CONSIGNES        : Capture POD (Signature ou Photo BL) obligatoire à chaque arrêt.`,
    ];

    const buffer = createMinimalPdf(title, lines);

    return {
      buffer,
      mimeType: "application/pdf",
      filename: `Tournee_${runNumber}.pdf`,
      checksumSha256: computeSha256(buffer),
      pageCount: 1,
    };
  }
}
