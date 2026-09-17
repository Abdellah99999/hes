import { Module } from "@nestjs/common";
import { InvoicesController } from "./invoices.controller";
import { CreateInvoiceUseCase } from "./application/use-cases/create-invoice.use-case";
import { ListInvoicesUseCase } from "./application/use-cases/list-invoices.use-case";
import { RecordPaymentUseCase } from "./application/use-cases/record-payment.use-case";
import { PrismaModule } from "../../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { EventBusModule } from "../../common/events/event-bus.module";

@Module({
  imports: [PrismaModule, AuthModule, EventBusModule],
  controllers: [InvoicesController],
  providers: [CreateInvoiceUseCase, ListInvoicesUseCase, RecordPaymentUseCase],
  exports: [CreateInvoiceUseCase, ListInvoicesUseCase, RecordPaymentUseCase],
})
export class BillingModule {}
