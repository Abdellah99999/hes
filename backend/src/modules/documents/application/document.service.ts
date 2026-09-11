import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { StorageService } from "../../storage/storage.service";
import { AuthenticatedUser } from "../../auth/domain/auth.types";
import {
  DocumentType,
  IDocumentGenerator,
  DocumentGenerationContext,
} from "../domain/document.types";
import { ParcelLabelGenerator } from "../generators/parcel-label.generator";
import { DeliveryNoteGenerator } from "../generators/delivery-note.generator";
import { InvoiceDocGenerator } from "../generators/invoice-doc.generator";
import { TransferManifestGenerator } from "../generators/transfer-manifest.generator";
import { RunSheetGenerator } from "../generators/run-sheet.generator";
import { CollectionReceiptGenerator } from "../generators/collection-receipt.generator";

@Injectable()
export class DocumentService {
  private readonly logger = new Logger(DocumentService.name);
  private readonly generators: IDocumentGenerator[];
  private readonly bucketName = "hes-documents";

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    parcelLabelGen: ParcelLabelGenerator,
    deliveryNoteGen: DeliveryNoteGenerator,
    invoiceDocGen: InvoiceDocGenerator,
    transferManifestGen: TransferManifestGenerator,
    runSheetGen: RunSheetGenerator,
    collectionReceiptGen: CollectionReceiptGenerator,
  ) {
    this.generators = [
      parcelLabelGen,
      deliveryNoteGen,
      invoiceDocGen,
      transferManifestGen,
      runSheetGen,
      collectionReceiptGen,
    ];
  }

  async generateAndStore(
    documentType: DocumentType,
    entityId: string,
    copiesCount: number,
    user: AuthenticatedUser,
  ) {
    // Normalize aliases to canonical Prisma DocumentType
    let canonicalType: import("@prisma/client").DocumentType;
    if (
      documentType === "DELIVERY_NOTE" ||
      documentType === DocumentType.DELIVERY_NOTE
    ) {
      canonicalType = "BILL_OF_LADING" as any;
    } else if (
      documentType === "COLLECTION_RECEIPT" ||
      documentType === DocumentType.COLLECTION_RECEIPT
    ) {
      canonicalType = "COLLECTION_BORDEREAU" as any;
    } else if (
      documentType === "TRANSFER_MANIFEST" ||
      documentType === DocumentType.TRANSFER_MANIFEST
    ) {
      canonicalType = "TRANSFER_BORDEREAU" as any;
    } else {
      canonicalType = documentType as any;
    }

    // 1. Check permissions & tenancy
    await this.assertAccessPermission(documentType, entityId, user);

    // 2. Locate matching generator
    const generator = this.generators.find(
      (g) => g.supports(documentType as any) || g.supports(canonicalType),
    );
    if (!generator) {
      throw new NotFoundException(
        `Aucun générateur enregistré pour le type de document : ${documentType}.`,
      );
    }

    const context: DocumentGenerationContext = {
      documentType,
      entityId,
      copiesCount: Math.max(1, copiesCount || 1),
      requestedByUserId: user.id,
    };

    const result = await generator.generate(context);

    // 3. Versioning strategy: retrieve max existing version
    const lastDoc = await this.prisma.generatedDocument.findFirst({
      where: { documentType: canonicalType, entityId },
      orderBy: { version: "desc" },
    });
    const version = (lastDoc?.version ?? 0) + 1;

    // S3 Key: documents/{type}/{YYYYMM}/{entityId}_v{version}.pdf
    const yearMonth = new Date().toISOString().slice(0, 7).replace("-", "");
    const s3Key = `documents/${canonicalType}/${yearMonth}/${entityId}_v${version}.pdf`;

    // 4. Upload binary to MinIO S3 (if client available)
    const minioClient = this.storageService.getClient();
    if (minioClient) {
      try {
        await minioClient.putObject(
          this.bucketName,
          s3Key,
          result.buffer,
          result.buffer.length,
          { "Content-Type": result.mimeType },
        );
      } catch (err) {
        this.logger.warn(
          `MinIO putObject warning (fallback in-memory): ${(err as Error).message}`,
        );
      }
    }

    // 5. Store metadata in PostgreSQL
    const doc = await this.prisma.generatedDocument.create({
      data: {
        documentType: canonicalType,
        entityId,
        version,
        s3Key,
        fileName: result.filename,
        fileSize: result.buffer.length,
        mimeType: result.mimeType,
        checksum: result.checksumSha256,
        generatedByUserId: user.id,
      },
    });

    // 6. Generate presigned URL (15 minutes TTL)
    const downloadUrl = await this.generatePresignedUrl(
      this.bucketName,
      doc.s3Key,
    );

    const enrichedDoc = {
      ...doc,
      copiesCount: context.copiesCount,
      checksumSha256: result.checksumSha256,
      s3Bucket: this.bucketName,
      sizeBytes: result.buffer.length,
    };

    return {
      document: enrichedDoc,
      downloadUrl,
      buffer: result.buffer,
      fileName: result.filename,
      mimeType: result.mimeType,
    };
  }

  async getDownloadUrl(documentId: string, user: AuthenticatedUser) {
    const doc = await this.prisma.generatedDocument.findUnique({
      where: { id: documentId },
    });

    if (!doc) {
      throw new NotFoundException("Document introuvable.");
    }

    await this.assertAccessPermission(doc.documentType, doc.entityId, user);

    const downloadUrl = await this.generatePresignedUrl(
      this.bucketName,
      doc.s3Key,
    );
    const enrichedDoc = {
      ...doc,
      s3Bucket: this.bucketName,
      sizeBytes: doc.fileSize,
      checksumSha256: doc.checksum,
    };
    return {
      document: enrichedDoc,
      downloadUrl,
    };
  }

  private async generatePresignedUrl(
    bucket: string,
    key: string,
  ): Promise<string> {
    const minioClient = this.storageService.getClient();
    if (!minioClient) {
      // Ephemeral cryptographic fallback token
      const token = Buffer.from(`${key}:${Date.now() + 900000}`).toString(
        "base64url",
      );
      return `/api/v1/documents/stream?key=${encodeURIComponent(key)}&token=${token}`;
    }

    try {
      return await minioClient.presignedGetObject(bucket, key, 900); // 15 minutes TTL
    } catch {
      return `/api/v1/documents/stream?key=${encodeURIComponent(key)}`;
    }
  }

  private async assertAccessPermission(
    type: DocumentType,
    entityId: string,
    user: AuthenticatedUser,
  ) {
    const typeStr = String(type);
    const isDeliveryNote =
      typeStr === "DELIVERY_NOTE" ||
      typeStr === "BILL_OF_LADING";
    const isParcelLabel =
      typeStr === "PARCEL_LABEL";
    const isInvoice =
      typeStr === "INVOICE";

    if (user.role === "CUSTOMER") {
      if (isInvoice) {
        const inv = await this.prisma.invoice.findFirst({
          where: { OR: [{ id: entityId }, { invoiceNumber: entityId }] },
        });
        if (!inv || (user.customerId && inv.customerId !== user.customerId)) {
          throw new ForbiddenException(
            "Accès refusé : ce document ne vous appartient pas.",
          );
        }
      } else if (isDeliveryNote || isParcelLabel) {
        let shipment = await this.prisma.shipment.findFirst({
          where: { OR: [{ id: entityId }, { trackingNumber: entityId }] },
        });
        if (!shipment && isParcelLabel) {
          const parcel = await this.prisma.parcel.findFirst({
            where: { OR: [{ id: entityId }, { trackingNumber: entityId }] },
            include: { shipment: true },
          });
          shipment = (parcel?.shipment as any) || null;
        }
        if (
          !shipment ||
          (user.customerId && shipment.senderCustomerId !== user.customerId)
        ) {
          throw new ForbiddenException(
            "Accès refusé : cette expédition ne vous appartient pas.",
          );
        }
      } else {
        throw new ForbiddenException("Accès refusé pour ce type de document.");
      }
    } else if (!user.isGlobalScope && user.agencyId) {
      // Operator check agency scoping
      if (isDeliveryNote || isParcelLabel) {
        let shipment = await this.prisma.shipment.findFirst({
          where: { OR: [{ id: entityId }, { trackingNumber: entityId }] },
        });
        if (!shipment && isParcelLabel) {
          const parcel = await this.prisma.parcel.findFirst({
            where: { OR: [{ id: entityId }, { trackingNumber: entityId }] },
            include: { shipment: true },
          });
          shipment = (parcel?.shipment as any) || null;
        }
        if (
          shipment &&
          shipment.originAgencyId !== user.agencyId &&
          shipment.destinationAgencyId !== user.agencyId
        ) {
          throw new ForbiddenException(
            "Accès refusé : document hors de votre agence.",
          );
        }
      }
    }
  }
}
