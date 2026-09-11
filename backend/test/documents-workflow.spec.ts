/* eslint-disable @typescript-eslint/no-explicit-any */
import { DocumentService } from "../src/modules/documents/application/document.service";
import { ParcelLabelGenerator } from "../src/modules/documents/generators/parcel-label.generator";
import { DeliveryNoteGenerator } from "../src/modules/documents/generators/delivery-note.generator";
import { InvoiceDocGenerator } from "../src/modules/documents/generators/invoice-doc.generator";
import { TransferManifestGenerator } from "../src/modules/documents/generators/transfer-manifest.generator";
import { RunSheetGenerator } from "../src/modules/documents/generators/run-sheet.generator";
import { CollectionReceiptGenerator } from "../src/modules/documents/generators/collection-receipt.generator";
import { AuthenticatedUser } from "../src/modules/auth/domain/auth.types";
import { DocumentType } from "../src/modules/documents/domain/document.types";
import { ForbiddenException } from "@nestjs/common";

describe("Phase 13 Backend Tests: DocumentService, PDF Validation, QR Code Encoding, Security Scoping & Signed URLs", () => {
  let documentService: DocumentService;
  let mockPrisma: any;
  let mockStorageService: any;
  let mockMinioClient: any;

  const CASA_AGENCY_ID = "ag-casa-uuid";
  const TANGER_AGENCY_ID = "ag-tng-uuid";

  const operatorUser: AuthenticatedUser = {
    id: "user-op-amine",
    email: "amine.quai@hes.ma",
    firstName: "Amine",
    lastName: "AgentQuai",
    role: "OPERATOR",
    agencyId: CASA_AGENCY_ID,
    isActive: true,
    tokenVersion: 1,
    permissions: ["documents:generate", "documents:download"],
    isGlobalScope: false,
  };

  const customerUserA: AuthenticatedUser = {
    id: "user-cust-a",
    email: "direction@client-a.ma",
    firstName: "Ali",
    lastName: "ClientA",
    role: "CUSTOMER",
    customerId: "cust-uuid-aaa",
    agencyId: null,
    isActive: true,
    tokenVersion: 1,
    permissions: ["documents:generate", "documents:download"],
    isGlobalScope: false,
  };

  const customerUserB: AuthenticatedUser = {
    ...customerUserA,
    id: "user-cust-b",
    customerId: "cust-uuid-bbb",
  };

  const shipmentA = {
    id: "shipment-uuid-1",
    trackingNumber: "HES-CAS-2026-000999",
    originAgencyId: CASA_AGENCY_ID,
    destinationAgencyId: TANGER_AGENCY_ID,
    senderCustomerId: "cust-uuid-aaa",
    recipientName: "Boutique Tanger",
    recipientPhone: "0661000000",
    recipientAddress: "Avenue Mohammed V",
    recipientCity: "Tanger",
    totalWeightKg: 4.5,
    codAmount: 850.0,
    originAgency: { code: "CAS", name: "Casablanca Hub" },
    destinationAgency: { code: "TNG", name: "Tanger Hub" },
    senderCustomer: {
      legalName: "Société Distribution A SARL",
      ice: "001928374000088",
    },
    parcels: [
      {
        id: "parcel-uuid-1-01",
        trackingNumber: "HES-CAS-2026-000999-01",
        barcode: "BL-999-01",
        weightKg: 4.5,
      },
    ],
  };

  let generatedDocsRecord: any[];

  beforeEach(() => {
    generatedDocsRecord = [];

    mockMinioClient = {
      putObject: jest.fn().mockResolvedValue({ etag: "mock-etag" }),
      presignedGetObject: jest
        .fn()
        .mockResolvedValue(
          "https://s3.hes.ma/hes-documents/mock-signed-url?token=xyz123",
        ),
    };

    mockStorageService = {
      getClient: jest.fn().mockReturnValue(mockMinioClient),
    };

    mockPrisma = {
      parcel: {
        findFirst: jest.fn().mockImplementation(async ({ where }) => {
          if (
            where.OR?.some(
              (c: any) =>
                c.id === shipmentA.parcels[0].id ||
                c.trackingNumber === shipmentA.parcels[0].trackingNumber,
            )
          ) {
            return {
              ...shipmentA.parcels[0],
              shipment: shipmentA,
            };
          }
          return null;
        }),
      },
      shipment: {
        findFirst: jest.fn().mockImplementation(async ({ where }) => {
          if (
            where.OR?.some(
              (c: any) =>
                c.id === shipmentA.id ||
                c.trackingNumber === shipmentA.trackingNumber,
            )
          ) {
            return shipmentA;
          }
          return null;
        }),
      },
      invoice: {
        findFirst: jest.fn().mockImplementation(async ({ where }) => {
          if (
            where.OR?.some(
              (c: any) =>
                c.id === "inv-1" || c.invoiceNumber === "FACT-202609-0001",
            )
          ) {
            return {
              id: "inv-1",
              invoiceNumber: "FACT-202609-0001",
              customerId: "cust-uuid-aaa",
              subtotalAmount: 100,
              taxRate: 20,
              taxAmount: 20,
              totalAmount: 120,
              paidAmount: 0,
              remainingAmount: 120,
              issueDate: new Date("2026-09-01"),
              dueDate: new Date("2026-10-01"),
              customer: { legalName: "Client A", code: "CLI-A" },
              items: [
                {
                  description: "Fret Casa",
                  quantity: 1,
                  unitPrice: 100,
                  totalPrice: 100,
                },
              ],
            };
          }
          return null;
        }),
      },
      transfer: {
        findFirst: jest.fn().mockResolvedValue({
          id: "trans-1",
          transferNumber: "TRF-CAS-TNG-202609-001",
          originAgency: { code: "CAS", name: "Casablanca" },
          destinationAgency: { code: "TNG", name: "Tanger" },
          status: "IN_TRANSIT",
          totalParcels: 10,
          totalWeightKg: 50,
          items: [],
        }),
      },
      deliveryRun: {
        findFirst: jest.fn().mockResolvedValue({
          id: "run-1",
          runNumber: "RUN-CAS-20260902-M1",
          runDate: new Date("2026-09-02"),
          slot: "MORNING",
          totalParcels: 15,
          totalCodAmount: 3400,
          agency: { code: "CAS", name: "Casablanca" },
          courier: { user: { firstName: "Rachid", lastName: "Livreur" } },
          items: [],
        }),
      },
      collection: {
        findFirst: jest.fn().mockResolvedValue({
          id: "col-1",
          collectionNumber: "COL-CAS-20260902-001",
          customer: { legalName: "Client A", code: "CLI-A" },
          agency: { code: "CAS", name: "Casablanca" },
          actualParcels: 5,
          actualWeightKg: 20,
          status: "COMPLETED",
          requestedDate: new Date(),
          items: [],
        }),
      },
      generatedDocument: {
        create: jest.fn().mockImplementation(async ({ data }) => {
          const doc = {
            id: `doc-${Date.now()}`,
            ...data,
            createdAt: new Date(),
          };
          generatedDocsRecord.push(doc);
          return doc;
        }),
        findFirst: jest.fn().mockImplementation(async ({ where }) => {
          return (
            generatedDocsRecord
              .filter(
                (d) =>
                  d.documentType === where.documentType &&
                  d.entityId === where.entityId,
              )
              .sort((a, b) => b.version - a.version)[0] || null
          );
        }),
        findUnique: jest.fn().mockImplementation(async ({ where }) => {
          return generatedDocsRecord.find((d) => d.id === where.id) || null;
        }),
      },
    };

    const parcelLabelGen = new ParcelLabelGenerator(mockPrisma);
    const deliveryNoteGen = new DeliveryNoteGenerator(mockPrisma);
    const invoiceDocGen = new InvoiceDocGenerator(mockPrisma);
    const transferManifestGen = new TransferManifestGenerator(mockPrisma);
    const runSheetGen = new RunSheetGenerator(mockPrisma);
    const collectionReceiptGen = new CollectionReceiptGenerator(mockPrisma);

    documentService = new DocumentService(
      mockPrisma,
      mockStorageService,
      parcelLabelGen,
      deliveryNoteGen,
      invoiceDocGen,
      transferManifestGen,
      runSheetGen,
      collectionReceiptGen,
    );
  });

  it("PDF Generation & QR Code Integrity: Generates valid PDF with QR encoding and checksum", async () => {
    const result = await documentService.generateAndStore(
      DocumentType.PARCEL_LABEL,
      "HES-CAS-2026-000999-01",
      1,
      operatorUser,
    );

    // 1. Assert PDF header signature
    const pdfHeader = result.buffer.toString("utf8", 0, 8);
    expect(pdfHeader).toContain("%PDF-1.4");

    // 2. Assert QR content is encoded in the buffer
    const pdfContent = result.buffer.toString("utf8");
    expect(pdfContent).toContain("tracking:HES-CAS-2026-000999-01");
    expect(pdfContent).toContain("agency:TNG");

    // 3. Assert Checksum and S3 presigned URL
    expect(result.document.checksumSha256).toBeDefined();
    expect(result.downloadUrl).toContain("https://s3.hes.ma/");
    expect(mockMinioClient.putObject).toHaveBeenCalled();
  });

  it("Multi-Copy BL Generation: Generates Delivery Note with specified copies count", async () => {
    const result = await documentService.generateAndStore(
      DocumentType.DELIVERY_NOTE,
      "HES-CAS-2026-000999",
      3,
      operatorUser,
    );

    expect(result.document.copiesCount).toBe(3);
    expect(result.fileName).toBe("BL_HES-CAS-2026-000999.pdf");
  });

  it("Security Scoping: Customer A can generate their BL, but Customer B is rejected with ForbiddenException", async () => {
    // Customer A has access to shipmentA
    const resA = await documentService.generateAndStore(
      DocumentType.DELIVERY_NOTE,
      "HES-CAS-2026-000999",
      1,
      customerUserA,
    );
    expect(resA.document).toBeDefined();

    // Customer B attempts to generate shipmentA -> ForbiddenException
    await expect(
      documentService.generateAndStore(
        DocumentType.DELIVERY_NOTE,
        "HES-CAS-2026-000999",
        1,
        customerUserB,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it("Versioning on Regeneration: Successive generations increment version number", async () => {
    const res1 = await documentService.generateAndStore(
      DocumentType.DELIVERY_NOTE,
      "HES-CAS-2026-000999",
      1,
      operatorUser,
    );
    expect(res1.document.version).toBe(1);

    const res2 = await documentService.generateAndStore(
      DocumentType.DELIVERY_NOTE,
      "HES-CAS-2026-000999",
      1,
      operatorUser,
    );
    expect(res2.document.version).toBe(2);
    expect(res2.document.s3Key).toContain("_v2.pdf");
  });

  it("Event-Driven Generation: Auto-generates invoice PDF upon InvoiceCreatedEvent publication", async () => {
    const { EventBusService } = await import(
      "../src/common/events/event-bus.service"
    );
    const { InvoiceCreatedEvent } = await import(
      "../src/common/events/billing.events"
    );
    const { OnInvoiceCreatedHandler } = await import(
      "../src/modules/documents/application/handlers/on-invoice-created.handler"
    );

    const eventBus = new EventBusService();
    const handler = new OnInvoiceCreatedHandler(eventBus, documentService);
    handler.onModuleInit();

    await eventBus.publish(
      new InvoiceCreatedEvent({
        invoiceId: "inv-1",
        invoiceNumber: "FACT-202609-0001",
        customerId: "cust-uuid-aaa",
        agencyId: CASA_AGENCY_ID,
        subtotal: 100,
        taxAmount: 20,
        totalAmount: 120,
        dueDate: new Date("2026-10-01"),
        createdAt: new Date(),
      }),
    );

    const invoiceDoc = generatedDocsRecord.find(
      (d) => d.documentType === DocumentType.INVOICE && d.entityId === "inv-1",
    );
    expect(invoiceDoc).toBeDefined();
    expect(invoiceDoc.fileName).toBe("Facture_FACT-202609-0001.pdf");
  });
});
