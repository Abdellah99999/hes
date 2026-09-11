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
export class InvoiceDocGenerator implements IDocumentGenerator {
  constructor(private readonly prisma: PrismaService) {}

  supports(type: DocumentType): boolean {
    return type === DocumentType.INVOICE;
  }

  async generate(
    context: DocumentGenerationContext,
  ): Promise<GeneratedDocumentResult> {
    const invoice = await this.prisma.invoice.findFirst({
      where: {
        OR: [
          { id: context.entityId },
          { number: context.entityId },
          { invoiceNumber: context.entityId },
        ],
      } as any,
      include: { customer: true, items: true },
    });

    if (!invoice) {
      throw new NotFoundException(
        `Facture introuvable pour PDF : "${context.entityId}".`,
      );
    }

    const invoiceNum =
      (invoice as any).number || (invoice as any).invoiceNumber || context.entityId;
    const clientName = invoice.customer?.legalName || "Client HES";
    const clientCode = invoice.customer?.code || "CLI";
    const clientIce = invoice.customer?.ice || "Non renseigné";
    const subtotal = Number(
      (invoice as any).subtotal ?? (invoice as any).subtotalAmount ?? 0,
    );
    const taxRate = Number((invoice as any).taxRate ?? 20);
    const taxAmount = Number((invoice as any).taxAmount ?? 0);
    const totalAmount = Number((invoice as any).totalAmount ?? 0);
    const remaining = Number(
      (invoice as any).remainingAmount ??
        totalAmount - Number((invoice as any).paidAmount ?? 0),
    );

    const title = `FACTURE OFFICIELLE - ${invoiceNum}`;
    const lines = [
      `CLIENT           : ${clientName} (Code: ${clientCode})`,
      `ICE CLIENT       : ${clientIce}`,
      `DATE EMISSION    : ${invoice.issueDate ? invoice.issueDate.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)}`,
      `DATE ECHEANCE    : ${invoice.dueDate ? invoice.dueDate.toISOString().slice(0, 10) : "A réception"}`,
      `SOUS-TOTAL HT    : ${subtotal.toFixed(2)} MAD`,
      `TVA (${taxRate}%)       : ${taxAmount.toFixed(2)} MAD`,
      `TOTAL TTC        : ${totalAmount.toFixed(2)} MAD`,
      `RESTE A PAYER    : ${remaining.toFixed(2)} MAD`,
      `NB PRESTATIONS   : ${invoice.items.length} lignes de facturation certifiées`,
    ];

    const buffer = createMinimalPdf(title, lines);

    return {
      buffer,
      mimeType: "application/pdf",
      filename: `Facture_${invoiceNum}.pdf`,
      checksumSha256: computeSha256(buffer),
      pageCount: 1,
    };
  }
}

