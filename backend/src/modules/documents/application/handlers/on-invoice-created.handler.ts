import { Injectable, OnModuleInit, Logger } from "@nestjs/common";
import { EventBusService } from "../../../../common/events/event-bus.service";
import { InvoiceCreatedEvent } from "../../../../common/events/billing.events";
import { DocumentService } from "../document.service";
import { DocumentType } from "../../domain/document.types";
import { AuthenticatedUser } from "../../../auth/domain/auth.types";

@Injectable()
export class OnInvoiceCreatedHandler implements OnModuleInit {
  private readonly logger = new Logger(OnInvoiceCreatedHandler.name);

  constructor(
    private readonly eventBus: EventBusService,
    private readonly documentService: DocumentService,
  ) {}

  onModuleInit() {
    this.eventBus.subscribe<InvoiceCreatedEvent>(
      InvoiceCreatedEvent.EVENT_NAME,
      async (event) => this.handle(event),
    );
  }

  async handle(event: InvoiceCreatedEvent): Promise<void> {
    this.logger.log(
      `[OnInvoiceCreatedHandler] Received event for invoice ${event.payload.invoiceId} (${event.payload.invoiceNumber})`,
    );

    const systemUser: AuthenticatedUser = {
      id: "system-auto-generator",
      email: "system@hes.ma",
      firstName: "System",
      lastName: "AutoDocument",
      role: "ADMIN",
      agencyId: null,
      isActive: true,
      tokenVersion: 1,
      permissions: ["documents:generate", "documents:download"],
      isGlobalScope: true,
    };

    try {
      await this.documentService.generateAndStore(
        DocumentType.INVOICE,
        event.payload.invoiceId,
        1,
        systemUser,
      );
      this.logger.log(
        `[OnInvoiceCreatedHandler] Successfully auto-generated PDF for invoice ${event.payload.invoiceId}`,
      );
    } catch (err) {
      this.logger.error(
        `[OnInvoiceCreatedHandler] Failed to generate PDF for invoice ${event.payload.invoiceId}: ${(err as Error).message}`,
        (err as Error).stack,
      );
    }
  }
}
