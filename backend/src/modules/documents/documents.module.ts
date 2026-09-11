import { Module } from "@nestjs/common";
import { DocumentsController } from "./documents.controller";
import { DocumentService } from "./application/document.service";
import { ParcelLabelGenerator } from "./generators/parcel-label.generator";
import { DeliveryNoteGenerator } from "./generators/delivery-note.generator";
import { InvoiceDocGenerator } from "./generators/invoice-doc.generator";
import { TransferManifestGenerator } from "./generators/transfer-manifest.generator";
import { RunSheetGenerator } from "./generators/run-sheet.generator";
import { CollectionReceiptGenerator } from "./generators/collection-receipt.generator";
import { PrismaModule } from "../../prisma/prisma.module";
import { StorageModule } from "../storage/storage.module";
import { AuthModule } from "../auth/auth.module";
import { EventBusModule } from "../../common/events/event-bus.module";
import { OnInvoiceCreatedHandler } from "./application/handlers/on-invoice-created.handler";

@Module({
  imports: [PrismaModule, StorageModule, AuthModule, EventBusModule],
  controllers: [DocumentsController],
  providers: [
    DocumentService,
    ParcelLabelGenerator,
    DeliveryNoteGenerator,
    InvoiceDocGenerator,
    TransferManifestGenerator,
    RunSheetGenerator,
    CollectionReceiptGenerator,
    OnInvoiceCreatedHandler,
  ],
  exports: [DocumentService, OnInvoiceCreatedHandler],
})
export class DocumentsModule {}
