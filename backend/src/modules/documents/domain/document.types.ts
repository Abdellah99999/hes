import { DocumentType as PrismaDocumentType } from "@prisma/client";

export const DocumentType = {
  ...PrismaDocumentType,
  DELIVERY_NOTE: PrismaDocumentType.BILL_OF_LADING,
  COLLECTION_RECEIPT: PrismaDocumentType.COLLECTION_BORDEREAU,
  TRANSFER_MANIFEST: PrismaDocumentType.TRANSFER_BORDEREAU,
} as const;

export type DocumentType =
  | PrismaDocumentType
  | "DELIVERY_NOTE"
  | "COLLECTION_RECEIPT"
  | "TRANSFER_MANIFEST";

export interface DocumentGenerationContext {
  documentType: DocumentType;
  entityId: string;
  copiesCount: number;
  requestedByUserId: string;
}

export interface GeneratedDocumentResult {
  buffer: Buffer;
  mimeType: string;
  filename: string;
  checksumSha256: string;
  pageCount: number;
}

export interface IDocumentGenerator {
  supports(type: import("@prisma/client").DocumentType): boolean;
  generate(
    context: DocumentGenerationContext,
  ): Promise<GeneratedDocumentResult>;
}
